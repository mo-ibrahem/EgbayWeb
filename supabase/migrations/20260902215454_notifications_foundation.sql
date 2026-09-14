CREATE TABLE public.notifications (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type        text NOT NULL,
    payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
    link        text,
    read_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread
    ON public.notifications (user_id, created_at DESC)
    WHERE read_at IS NULL;

CREATE INDEX idx_notifications_user_recent
    ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read only their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

REVOKE ALL ON public.notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

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
SELECT cron.schedule('cleanup_old_notifications_job', '0 3 * * *', 'SELECT public.cleanup_old_notifications();');;
