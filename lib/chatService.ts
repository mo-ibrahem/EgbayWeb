import { supabase } from '@/lib/supabase';

/**
 * Finds the chat room between two users about a specific item, creating
 * one if it doesn't exist yet. Rooms are scoped per (participant pair,
 * product) rather than one merged thread per pair -- messaging a seller
 * about a PS5 and messaging them later about a phone are different
 * conversations, each with its own item context. productId is required
 * so every call site stays explicit about which item a conversation is
 * about; there is no "general" chat entry point in the app.
 */
export async function getOrCreateChatRoom(userId: string, otherUserId: string, productId: string): Promise<string> {
  const participants = [userId, otherUserId].sort();

  const { data: existing } = await supabase
    .from('chat_rooms')
    .select('id')
    .contains('participant_ids', participants)
    .eq('product_id', productId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('chat_rooms')
    .insert({ participant_ids: participants, product_id: productId })
    .select('id')
    .single();

  if (error || !created) throw error || new Error('Failed to create chat room');
  return created.id;
}

/**
 * Removes a chat room from the caller's own inbox without touching the
 * other participant's view or the message history -- delete-for-me, not
 * delete-for-both. Chat history can matter if a report or dispute comes up,
 * so nothing here ever destroys data; it only stops the
 * room from being listed for this user. If either side sends a new
 * message into the same room afterward, it resurfaces automatically
 * (server-side, via unhide_chat_room_on_new_message) rather than staying
 * silently hidden from someone who's actively being messaged.
 */
export async function hideChatRoomForUser(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('hide_chat_room_for_user', { p_room_id: roomId });
  if (error) throw error;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  msg_type: 'text' | 'offer';
  offer_amount_egp: number | null;
  offer_status: 'pending' | 'accepted' | 'declined' | null;
}

export const formatOfferText = (amountEgp: number) => `Offer: EGP ${Math.round(amountEgp).toLocaleString('en-US')}`;

/** Inbox / last-message preview: offers read "Offer: EGP X", never the raw content. */
export const messagePreview = (m?: { content?: string | null; msg_type?: string | null; offer_amount_egp?: number | null } | null) =>
  !m ? undefined : m.msg_type === 'offer' && m.offer_amount_egp ? formatOfferText(Number(m.offer_amount_egp)) : m.content ?? undefined;

export interface ChatSummary {
  room_id: string;
  product_id: string | null;
  other_user_id: string | null;
  last_content: string | null;
  last_created_at: string | null;
  last_sender_id: string | null;
  last_msg_type: 'text' | 'offer' | null;
  last_offer_amount_egp: number | null;
}

/** Every visible conversation with its latest message, newest first, in one request (RLS-scoped). */
export async function getMyChatSummaries(): Promise<ChatSummary[]> {
  const { data, error } = await supabase.rpc('my_chat_summaries');
  if (error) throw error;
  return (data ?? []) as ChatSummary[];
}

/**
 * Sends a structured price offer. It is a handshake for an in-person
 * handover -- no payment is created or implied. The database enforces the
 * shape (msg_type/offer_amount_egp/offer_status check constraint).
 */
export async function sendOffer(roomId: string, senderId: string, amountEgp: number, variantNote?: string): Promise<ChatMessage> {
  const amount = Math.round(amountEgp);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter an amount');
  const { data, error } = await supabase
    .from('messages')
    .insert({
      room_id: roomId,
      sender_id: senderId,
      content: `${formatOfferText(amount)}${variantNote ? ` · ${variantNote.slice(0, 160)}` : ''}`,
      msg_type: 'offer',
      offer_amount_egp: amount,
      offer_status: 'pending',
    })
    .select('*')
    .single();
  if (error || !data) throw error || new Error('No row returned');
  return data as ChatMessage;
}

/**
 * Accept or decline an offer from the other participant. Only offer_status
 * is granted; validate_offer_response rejects the sender, non-pending
 * offers and every other column. Zero returned rows means nothing changed.
 */
export async function respondToOffer(messageId: string, response: 'accepted' | 'declined'): Promise<void> {
  const { data, error } = await supabase.from('messages').update({ offer_status: response }).eq('id', messageId).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Could not respond to this offer');
}

// --- Safety: report / block ---
// Each call throws unless the RPC succeeded; callers must not show
// "reported" / "blocked" before the promise resolves.

export type ReportTargetType = 'listing' | 'user' | 'message' | 'live_message';

export async function reportContent(targetType: ReportTargetType, targetId: string, reason: string): Promise<void> {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error('A reason is required');
  const { error } = await supabase.rpc('report_content', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: trimmed.slice(0, 1000),
  });
  if (error) throw error;
}

export async function blockUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('block_user', { p_user_id: userId });
  if (error) throw error;
}

export async function unblockUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('unblock_user', { p_user_id: userId });
  if (error) throw error;
}

/** Ids the signed-in user has blocked (RLS only lets you read your own block list). */
export async function getBlockedUserIds(myId: string): Promise<string[]> {
  const { data, error } = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', myId);
  if (error) throw error;
  return (data ?? []).map(r => String(r.blocked_id));
}

/** True when a failed insert was refused by row-level security (can_interact_with: either side blocked). */
export const isBlockedInsertError = (err: unknown) =>
  (err as { code?: string } | null)?.code === '42501' || /row-level security/i.test(String((err as { message?: string } | null)?.message ?? ''));
