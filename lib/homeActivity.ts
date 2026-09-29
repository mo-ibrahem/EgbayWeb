import { supabase } from '@/lib/supabase';
import { getMyChatSummaries } from '@/lib/chatService';

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

async function getMyId() {
  // Only used to filter/label; row-level security enforces access.
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

/** A conversation counts when its latest message came from the other person. */
export async function getWaitingReplyCount(): Promise<number> {
  const me = await getMyId();
  if (!me) return 0;
  return (await getMyChatSummaries()).filter(c => c.last_sender_id && c.last_sender_id !== me).length;
}

/** Up to two recent replies for the home activity panel, using real messages. */
export async function getRecentReplies(limit = 2): Promise<RecentReply[]> {
  const me = await getMyId();
  if (!me) return [];
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const hits = (await getMyChatSummaries())
    .filter(c => c.other_user_id && c.last_sender_id && c.last_sender_id !== me && c.last_created_at && c.last_created_at >= since)
    .slice(0, limit); // already newest first
  if (!hits.length) return [];
  const profileIds = [...new Set(hits.map(hit => hit.other_user_id as string))];
  const productIds = [...new Set(hits.map(hit => hit.product_id).filter(Boolean))] as string[];
  const [{ data: profiles }, { data: products }] = await Promise.all([
    supabase.from('public_profiles').select('id, full_name, avatar_url').in('id', profileIds),
    productIds.length
      ? supabase.from('products').select('id, title').in('id', productIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);
  return hits.map(c => ({
    room_id: c.room_id,
    other_user_name: profiles?.find(p => p.id === c.other_user_id)?.full_name || 'Egbay User',
    other_user_avatar_url: profiles?.find(p => p.id === c.other_user_id)?.avatar_url || '',
    message: c.last_content ?? '',
    created_at: c.last_created_at as string,
    product_title: products?.find(p => p.id === c.product_id)?.title,
    is_offer: c.last_msg_type === 'offer',
    offer_amount_egp: c.last_offer_amount_egp,
  }));
}

/** Aggregate RPC shared with mobile; no private room details enter listing cards. */
export async function getAskCounts(productIds: string[]): Promise<Record<string, number>> {
  if (!productIds.length) return {};
  const { data, error } = await supabase.rpc('product_ask_counts', { p_product_ids: productIds });
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((row: { product_id: string; ask_count: number }) => [row.product_id, row.ask_count]));
}
