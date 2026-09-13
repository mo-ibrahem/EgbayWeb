CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_recipient_id uuid;
    v_sender_name text;
BEGIN
    SELECT p INTO v_recipient_id
    FROM unnest(
        (SELECT participant_ids FROM public.chat_rooms WHERE id = NEW.room_id)
    ) AS p
    WHERE p != NEW.sender_id
    LIMIT 1;

    IF v_recipient_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT full_name INTO v_sender_name
    FROM public.public_profiles
    WHERE id = NEW.sender_id;

    PERFORM public.create_notification(
        v_recipient_id,
        'new_message',
        jsonb_build_object(
            'room_id', NEW.room_id,
            'sender_name', COALESCE(v_sender_name, 'EgyBay User'),
            'preview', left(NEW.content, 120)
        ),
        '/chat/' || NEW.room_id::text
    );

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_on_new_message ON public.messages;
CREATE TRIGGER trg_notify_on_new_message
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_on_new_message();

CREATE OR REPLACE FUNCTION public.notify_on_wallet_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_user_id uuid;
BEGIN
    IF NEW.type NOT IN ('top_up', 'withdrawal') THEN
        RETURN NEW;
    END IF;

    SELECT user_id INTO v_user_id
    FROM public.user_wallets
    WHERE id = NEW.wallet_id;

    IF v_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    PERFORM public.create_notification(
        v_user_id,
        NEW.type,
        jsonb_build_object('amount', abs(NEW.amount)),
        '/wallet'
    );

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_on_wallet_transaction ON public.wallet_transactions;
CREATE TRIGGER trg_notify_on_wallet_transaction
    AFTER INSERT ON public.wallet_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_on_wallet_transaction();;
