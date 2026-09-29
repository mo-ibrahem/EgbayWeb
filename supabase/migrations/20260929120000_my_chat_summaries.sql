-- One call for every conversation and its latest message, shared by web and
-- mobile. Both apps fetched the room list, then ran one "latest message" query
-- per room -- up to 40 requests for a busy inbox. Web's bottom-nav badge ran
-- that on every page change, so each tap on a phone could fire ~42 requests.
--
-- SECURITY INVOKER: it runs under the caller's existing RLS on chat_rooms and
-- messages, so it adds no new trust surface. The lateral lookup is served by
-- messages_room_id_created_at_idx (room_id, created_at DESC).
CREATE OR REPLACE FUNCTION public.my_chat_summaries()
RETURNS TABLE(room_id uuid, product_id uuid, other_user_id uuid,
              last_content text, last_created_at timestamptz, last_sender_id uuid,
              last_msg_type text, last_offer_amount_egp numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_catalog AS $fn$
  SELECT r.id, r.product_id,
         (SELECT p FROM unnest(r.participant_ids) p WHERE p <> auth.uid() LIMIT 1),
         m.content, m.created_at, m.sender_id, m.msg_type, m.offer_amount_egp
  FROM public.chat_rooms r
  LEFT JOIN LATERAL (
    SELECT content, created_at, sender_id, msg_type, offer_amount_egp
    FROM public.messages WHERE messages.room_id = r.id
    ORDER BY created_at DESC LIMIT 1
  ) m ON true
  WHERE auth.uid() = ANY (r.participant_ids)
    AND NOT (auth.uid() = ANY (coalesce(r.deleted_for, '{}')))
  ORDER BY m.created_at DESC NULLS LAST;
$fn$;
REVOKE ALL ON FUNCTION public.my_chat_summaries() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_chat_summaries() TO authenticated;
