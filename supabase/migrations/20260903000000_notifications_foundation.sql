-- Notification foundation. Backend only -- no client UI reads this yet.
--
-- lib/notificationService.ts (deleted alongside this migration) looked
-- like a notification system but wrote to localStorage keyed by
-- recipient id while actually writing to whichever browser was open --
-- a seller's "item sold" notification would land in the buyer's
-- browser. Nothing imported it. This replaces it with the real thing:
-- server-side triggers on tables that already record the truth, so the
-- client is never trusted to notify someone other than itself.
--
-- order_events already gets written by every path that moves an order
-- (both checkout RPCs, release_escrow, admin dispute actions, the
-- courier simulator, /api/orders). One trigger on it covers the whole
-- order lifecycle instead of touching every write site, and anything
-- that moves an order in future gets notifications for free.

CREATE TABLE public.notifications (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type        text NOT NULL,
    payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
    link        text,
    read_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT NOW()
);

-- Unread-badge and panel queries both hit this shape.
CREATE INDEX idx_notifications_user_unread
    ON public.notifications (user_id, created_at DESC)
    WHERE read_at IS NULL;

CREATE INDEX idx_notifications_user_recent
    ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read only their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policy at all: rows are written exclusively
-- by SECURITY DEFINER functions below. CREATE FUNCTION grants EXECUTE
-- to PUBLIC by default -- this codebase has shipped that gap before --
-- so every function here gets an explicit REVOKE.
REVOKE ALL ON public.notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- Internal helper, not exposed to clients directly (no EXECUTE grant to
-- authenticated). Triggers call this; nothing else should.
CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id uuid,
    p_type text,
    p_payload jsonb DEFAULT '{}'::jsonb,
    p_link text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO public.notifications (user_id, type, payload, link)
    VALUES (p_user_id, p_type, p_payload, p_link);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_notification(uuid, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, jsonb, text) TO service_role, postgres;

-- ============================================================
-- order_events -> notifications
--
-- Recipient is whoever DIDN'T cause the event -- the actor already
-- knows what they just did. escrow_secured is the single source for
-- "payment secured" even though checkout_with_wallet and
-- process_paymob_order_payment also write payment_completed /
-- payment_secured in the same call -- notifying on all three would
-- triple-fire the same moment to the seller.
--
-- 'completed' is the single source for "funds released" even though
-- release_escrow writes both escrow_released and completed for the
-- same release -- notifying on both would double-fire.
--
-- Cancellations never reach this trigger at all: cancel_and_restore_order
-- (the abandoned-order cron's per-row cleanup) updates orders.status
-- directly and never writes to order_events, so there's nothing to
-- suppress for bulk cron cancellations -- they simply don't generate
-- an event here.
CREATE OR REPLACE FUNCTION public.notify_on_order_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_order RECORD;
    v_product_title text;
    v_link text;
BEGIN
    SELECT buyer_id, seller_id, amount, product_snapshot
    INTO v_order
    FROM public.orders
    WHERE id = NEW.order_id;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    v_product_title := COALESCE(v_order.product_snapshot->>'title', 'your order');
    v_link := '/orders/' || NEW.order_id::text;

    IF NEW.event_type = 'order_placed' THEN
        PERFORM public.create_notification(
            v_order.seller_id, 'order_placed',
            jsonb_build_object('order_id', NEW.order_id, 'product_title', v_product_title, 'amount', v_order.amount),
            v_link
        );

    ELSIF NEW.event_type = 'escrow_secured' THEN
        PERFORM public.create_notification(
            v_order.seller_id, 'escrow_secured',
            jsonb_build_object('order_id', NEW.order_id, 'product_title', v_product_title, 'amount', v_order.amount),
            v_link
        );

    ELSIF NEW.event_type = 'shipped' THEN
        PERFORM public.create_notification(
            v_order.buyer_id, 'shipped',
            jsonb_build_object('order_id', NEW.order_id, 'product_title', v_product_title),
            v_link
        );

    ELSIF NEW.event_type = 'out_for_delivery' THEN
        PERFORM public.create_notification(
            v_order.buyer_id, 'out_for_delivery',
            jsonb_build_object('order_id', NEW.order_id, 'product_title', v_product_title),
            v_link
        );

    ELSIF NEW.event_type = 'delivered' THEN
        PERFORM public.create_notification(
            v_order.buyer_id, 'delivered',
            jsonb_build_object('order_id', NEW.order_id, 'product_title', v_product_title),
            v_link
        );

    ELSIF NEW.event_type = 'completed' THEN
        PERFORM public.create_notification(
            v_order.seller_id, 'completed',
            jsonb_build_object('order_id', NEW.order_id, 'product_title', v_product_title, 'amount', v_order.amount),
            v_link
        );

    ELSIF NEW.event_type = 'disputed' THEN
        -- Payload from /api/orders doesn't record who filed it, so both
        -- sides are notified -- the filer gets a confirmation, the other
        -- party gets alerted. No admin recipient list exists yet, so
        -- admin notification is intentionally not implemented here.
        PERFORM public.create_notification(
            v_order.buyer_id, 'disputed',
            jsonb_build_object('order_id', NEW.order_id, 'product_title', v_product_title),
            v_link
        );
        PERFORM public.create_notification(
            v_order.seller_id, 'disputed',
            jsonb_build_object('order_id', NEW.order_id, 'product_title', v_product_title),
            v_link
        );
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_on_order_event ON public.order_events;
CREATE TRIGGER trg_notify_on_order_event
    AFTER INSERT ON public.order_events
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_on_order_event();

-- ============================================================
-- Self-service read state. Same shape as hide_chat_room_for_user:
-- the acting user is derived from auth.uid() inside the function,
-- never trusted from an argument, so a caller can only ever mark
-- their OWN notifications read.
CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
    UPDATE public.notifications
    SET read_at = NOW()
    WHERE id = ANY(p_ids)
      AND user_id = auth.uid()
      AND read_at IS NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_notifications_read(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
    UPDATE public.notifications
    SET read_at = NOW()
    WHERE user_id = auth.uid()
      AND read_at IS NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated, service_role;

-- ============================================================
-- Retention. Joins the two existing pg_cron jobs (abandoned orders,
-- promotion expiry). Without this the table grows forever and the
-- unread-count index degrades.
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
    DELETE FROM public.notifications
    WHERE (read_at IS NOT NULL AND read_at < NOW() - INTERVAL '60 days')
       OR created_at < NOW() - INTERVAL '180 days';
END;
$function$;

REVOKE ALL ON FUNCTION public.cleanup_old_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_notifications() TO service_role, postgres;

SELECT cron.unschedule('cleanup_old_notifications_job') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup_old_notifications_job'
);
SELECT cron.schedule('cleanup_old_notifications_job', '0 3 * * *', 'SELECT public.cleanup_old_notifications();');
