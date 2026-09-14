ALTER TABLE public.chat_rooms
  ADD COLUMN deleted_for uuid[] NOT NULL DEFAULT '{}'::uuid[];

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
    EXECUTE FUNCTION public.unhide_chat_room_on_new_message();;
