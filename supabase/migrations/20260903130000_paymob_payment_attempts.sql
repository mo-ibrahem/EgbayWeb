-- Record what Paymob told us, so a payment can never vanish silently.
--
-- Two holes closed here, both found after a buyer paid 188 EGP for order
-- 4ade5e95 and the order sat at pending_payment:
--
-- 1. When process_paymob_order_payment raised, the whole transaction
--    rolled back and nothing was written anywhere. The only trace was a
--    console.error in the edge function logs. cancel_abandoned_orders
--    then cancelled the order an hour later on age alone -- it never asks
--    whether Paymob actually took the money -- and the payment was
--    orphaned with nothing linking it to anything.
--
-- 2. A declined payment was ignored outright (webhook returned early on
--    success !== true), so a dead order held the item out of stock for a
--    full hour. There is no resume-payment path in the UI, so nobody was
--    served by that wait.
--
-- The attempts table is the record. The webhook writes a row for both
-- outcomes, and the cron reads it: never cancel an order Paymob says was
-- paid, and cancel a declined one sooner.

CREATE TABLE IF NOT EXISTS public.paymob_payment_attempts (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_order_id      TEXT NOT NULL,
    -- Null when merchant_order_id wasn't a marketplace order uuid (a
    -- top-up, or something unroutable we still want a record of).
    order_id               UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    paymob_transaction_id  BIGINT,
    amount_cents           BIGINT,
    currency               TEXT,
    -- 'declined'         : Paymob reported success=false. No money taken.
    -- 'processing_failed': Paymob reported success=true and our RPC threw.
    --                      Money IS taken. Needs reconciliation.
    outcome                TEXT NOT NULL CHECK (outcome IN ('declined', 'processing_failed')),
    error_message          TEXT,
    payload                JSONB,
    resolved_at            TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The cron's lookup, and the "needs reconciliation" list.
CREATE INDEX IF NOT EXISTS idx_paymob_attempts_unresolved
    ON public.paymob_payment_attempts (order_id, outcome)
    WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_paymob_attempts_tx
    ON public.paymob_payment_attempts (paymob_transaction_id);

-- Service-role only: written by the webhook, read by the cron and by an
-- operator. RLS on with no policy means no client role can read it --
-- it holds Paymob payloads and belongs nowhere near a browser.
ALTER TABLE public.paymob_payment_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.paymob_payment_attempts FROM PUBLIC, anon, authenticated;

-- Any exit from pending_payment settles that order's outstanding
-- attempts: secured means the payment landed, cancelled means the
-- declined attempts are moot. Done as a trigger rather than inside
-- process_paymob_order_payment so it holds however the order moves --
-- the RPC, a manual reconciliation, or an admin action.
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

-- The cron stops deciding on age alone.
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
          -- Never cancel an order Paymob says was paid. The money is
          -- real; this needs reconciling, and cancelling would restore
          -- the stock and leave the payment attached to nothing.
          AND NOT EXISTS (
              SELECT 1 FROM public.paymob_payment_attempts a
              WHERE a.order_id = o.id
                AND a.outcome = 'processing_failed'
                AND a.resolved_at IS NULL
          )
          AND (
              o.created_at < NOW() - INTERVAL '1 hour'
              -- A decline frees the item sooner than the blanket hour.
              -- The 15 minutes is grace for a buyer retrying after a
              -- mistyped OTP within the same checkout.
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
$function$;
