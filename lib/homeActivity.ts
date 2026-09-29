import { supabase } from '@/lib/supabase';

export interface RecentReply {
  room_id: string;
  other_user_name: string;
  other_user_avatar_url: string;
  message: string;
  created_at: string;
  product_title?: string;
  is_offer: boolean;
  offer_amount_egp?: number | null;
}

async function getMyRooms() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, rooms: [] };
  const { data, error } = await supabase
    .from('chat_rooms')
    .select('id, participant_ids, product_id')
    .not('deleted_for', 'cs', `{${user.id}}`)
    .contains('participant_ids', [user.id])
    .limit(40);
  if (error) throw error;
  return { user, rooms: data ?? [] };
}

/** A conversation counts when its latest message came from the other person. */
export async function getWaitingReplyCount(): Promise<number> {
  const { user, rooms } = await getMyRooms();
  if (!user || !rooms.length) return 0;
  const latest = await Promise.all(rooms.map(async room => {
    const { data, error } = await supabase.from('messages')
      .select('sender_id').eq('room_id', room.id)
      .order('created_at', { ascending: false }).limit(1);
    if (error) throw error;
    return data?.[0]?.sender_id;
  }));
  return latest.filter(sender => sender && sender !== user.id).length;
}

/** Up to two recent replies for the home activity panel, using real messages. */
export async function getRecentReplies(limit = 2): Promise<RecentReply[]> {
  const { user, rooms } = await getMyRooms();
  if (!user || !rooms.length) return [];
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const candidates = await Promise.all(rooms.map(async room => {
    const { data, error } = await supabase.from('messages')
      .select('sender_id, content, created_at, msg_type, offer_amount_egp')
      .eq('room_id', room.id).order('created_at', { ascending: false }).limit(1);
    if (error) throw error;
    const last = data?.[0];
    const otherId = (room.participant_ids as string[]).find(id => id !== user.id);
    return last && otherId && last.sender_id !== user.id && last.created_at >= since
      ? { room, last, otherId } : null;
  }));
  const hits = candidates.filter((hit): hit is NonNullable<typeof hit> => hit !== null)
    .sort((a, b) => b.last.created_at.localeCompare(a.last.created_at)).slice(0, limit);
  if (!hits.length) return [];
  const profileIds = [...new Set(hits.map(hit => hit.otherId))];
  const productIds = [...new Set(hits.map(hit => hit.room.product_id).filter(Boolean))] as string[];
  const [{ data: profiles }, { data: products }] = await Promise.all([
    supabase.from('public_profiles').select('id, full_name, avatar_url').in('id', profileIds),
    productIds.length
      ? supabase.from('products').select('id, title').in('id', productIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);
  return hits.map(({ room, last, otherId }) => ({
    room_id: room.id,
    other_user_name: profiles?.find(p => p.id === otherId)?.full_name || 'Egbay User',
    other_user_avatar_url: profiles?.find(p => p.id === otherId)?.avatar_url || '',
    message: last.content,
    created_at: last.created_at,
    product_title: products?.find(p => p.id === room.product_id)?.title,
    is_offer: last.msg_type === 'offer',
    offer_amount_egp: last.offer_amount_egp,
  }));
}

/** Aggregate RPC shared with mobile; no private room details enter listing cards. */
export async function getAskCounts(productIds: string[]): Promise<Record<string, number>> {
  if (!productIds.length) return {};
  const { data, error } = await supabase.rpc('product_ask_counts', { p_product_ids: productIds });
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((row: { product_id: string; ask_count: number }) => [row.product_id, row.ask_count]));
}
