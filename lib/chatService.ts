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
