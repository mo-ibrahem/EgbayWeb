-- Phase 3: extend notifications to chat messages and wallet activity,
-- same server-side-trigger shape as the order_events trigger in
-- notifications_foundation.
--
-- Chat notification suppression (skip notifying someone who currently
-- has the room open) is an open decision, not implemented here -- it
-- needs presence tracking, a meaningfully bigger feature than a
-- trigger, and the plan flagged it as something to weigh in on rather
-- than silently resolve. Known limitation: an active conversation adds
-- an unread badge increment alongside the message the chat page's own
-- realtime subscription already shows live.

-- ============================================================
-- messages -> notifies the OTHER participant. A second trigger on this
-- table, not a modification of trg_unhide_chat_room_on_new_message --
-- that one's job is exclusively resurfacing a hidden room and stays
-- untouched.
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

-- ============================================================
-- wallet_transactions -> notifies the wallet owner.
--
-- top_up rows are only ever inserted by process_paymob_topup AFTER
-- Paymob confirms payment, always with status = 'completed' at insert
-- time -- so "wallet topped up" is accurate the moment this row exists.
--
-- withdrawal rows are inserted by request_wallet_payout with
-- status = 'pending', and nothing in this codebase currently marks one
-- 'completed' -- there is no fulfillment pipeline yet. The copy MUST
-- say "payout request received", never "sent" or "on its way": this
-- system does not lie about money having moved when it hasn't, and a
-- payout row existing is not evidence a payout happened.
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
    EXECUTE FUNCTION public.notify_on_wallet_transaction();
