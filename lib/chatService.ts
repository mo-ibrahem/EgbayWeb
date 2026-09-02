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
 * delete-for-both. Chat history can matter to a dispute on an escrow
 * marketplace, so nothing here ever destroys data; it only stops the
 * room from being listed for this user. If either side sends a new
 * message into the same room afterward, it resurfaces automatically
 * (server-side, via unhide_chat_room_on_new_message) rather than staying
 * silently hidden from someone who's actively being messaged.
 */
export async function hideChatRoomForUser(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('hide_chat_room_for_user', { p_room_id: roomId });
  if (error) throw error;
}
