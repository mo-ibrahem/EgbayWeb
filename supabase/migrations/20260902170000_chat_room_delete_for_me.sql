-- "Delete" is delete-for-me, not delete-for-both. This is a peer-to-peer
-- escrow marketplace: chat history can matter to a dispute, so one party
-- clearing clutter from their own inbox must never destroy the other
-- party's copy or the underlying message history. This is exactly how
-- WhatsApp/Messenger/iMessage handle it, and it's the behavior a user
-- actually expects from "delete this chat."
ALTER TABLE public.chat_rooms
  ADD COLUMN deleted_for uuid[] NOT NULL DEFAULT '{}'::uuid[];

-- Self-service hide, scoped tightly: a participant can only ever add
-- THEIR OWN id, never anyone else's -- p_user_id is asserted against the
-- caller's own JWT-derived uid inside the function, not trusted from the
-- argument alone, so this can't be used to hide the chat for the other
-- participant. Idempotent (WHERE guard) so repeat calls are harmless.
CREATE OR REPLACE FUNCTION public.hide_chat_room_for_user(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    UPDATE public.chat_rooms
    SET deleted_for = deleted_for || v_uid
    WHERE id = p_room_id
      AND v_uid = ANY(participant_ids)
      AND NOT (v_uid = ANY(deleted_for));
END;
$function$;

REVOKE ALL ON FUNCTION public.hide_chat_room_for_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hide_chat_room_for_user(uuid) TO authenticated, service_role;

-- A hidden chat resurfaces the moment either side sends into it again --
-- a new message means the conversation is active, and silently keeping
-- it hidden from someone who's actively being messaged would bury real
-- order-related communication. Reset is unconditional on both
-- participants rather than just the recipient, since the sender may have
-- reached this same room via a stale link after deleting it themselves.
CREATE OR REPLACE FUNCTION public.unhide_chat_room_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
    UPDATE public.chat_rooms
    SET deleted_for = '{}'::uuid[]
    WHERE id = NEW.room_id
      AND deleted_for <> '{}'::uuid[];
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_unhide_chat_room_on_new_message ON public.messages;
CREATE TRIGGER trg_unhide_chat_room_on_new_message
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.unhide_chat_room_on_new_message();
