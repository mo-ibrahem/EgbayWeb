CREATE TABLE IF NOT EXISTS public.paymob_payment_attempts (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_order_id      TEXT NOT NULL,
    order_id               UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    paymob_transaction_id  BIGINT,
    amount_cents           BIGINT,
    currency               TEXT,
    outcome                TEXT NOT NULL CHECK (outcome IN ('declined', 'processing_failed')),
    error_message          TEXT,
    payload                JSONB,
    resolved_at            TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paymob_attempts_unresolved
    ON public.paymob_payment_attempts (order_id, outcome)
    WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_paymob_attempts_tx
    ON public.paymob_payment_attempts (paymob_transaction_id);

ALTER TABLE public.paymob_payment_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.paymob_payment_attempts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.resolve_paymob_attempts_on_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
    IF OLD.status = 'pending_payment' AND NEW.status <> 'pending_payment' THEN
        UPDATE public.paymob_payment_attempts
        SET resolved_at = NOW()
        WHERE order_id = NEW.id
          AND resolved_at IS NULL;
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_resolve_paymob_attempts ON public.orders;
CREATE TRIGGER trg_resolve_paymob_attempts
    AFTER UPDATE OF status ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.resolve_paymob_attempts_on_status_change();

CREATE OR REPLACE FUNCTION public.cancel_abandoned_orders()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT o.id
        FROM public.orders o
        WHERE o.status = 'pending_payment'
          AND NOT EXISTS (
              SELECT 1 FROM public.paymob_payment_attempts a
              WHERE a.order_id = o.id
                AND a.outcome = 'processing_failed'
                AND a.resolved_at IS NULL
          )
          AND (
              o.created_at < NOW() - INTERVAL '1 hour'
              OR EXISTS (
                  SELECT 1 FROM public.paymob_payment_attempts a
                  WHERE a.order_id = o.id
                    AND a.outcome = 'declined'
                    AND a.created_at < NOW() - INTERVAL '15 minutes'
              )
          )
    LOOP
        PERFORM public.cancel_and_restore_order(r.id);
    END LOOP;
END;
$function$;;
