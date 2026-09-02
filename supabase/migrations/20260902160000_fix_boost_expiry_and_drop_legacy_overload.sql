-- 1. Drop the legacy purchase_boost(uuid, uuid, text, integer) overload.
-- It's unreachable from the app (the only caller, /api/boost, always
-- calls the 3-arg version) and only EXECUTE-granted to service_role, so
-- it isn't client-exploitable -- but it's live, dead, and buggy: it
-- deducts the wallet BEFORE checking that seller_id matches p_user_id,
-- so a mismatched call charges the wallet while its own UPDATE ...
-- WHERE seller_id = p_user_id silently affects zero rows. It also uses
-- a completely different pricing model (per-day rate, 'tier_1/2/3')
-- than the live one (flat package price, 'urgent/featured/turbo'),
-- which is confusing to encounter while reading the schema.
DROP FUNCTION IF EXISTS public.purchase_boost(uuid, uuid, text, integer);

-- 2. Expire promotions server-side. Nothing previously reset
-- is_promoted after promoted_until passed -- the badge and (new)
-- ranking boost would have kept applying forever. Mirrors the existing
-- cancel_abandoned_orders_job cron pattern (every 10 minutes).
CREATE OR REPLACE FUNCTION public.expire_promoted_products()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
    UPDATE public.products
    SET is_promoted = false,
        promotion_tier = NULL,
        updated_at = NOW()
    WHERE is_promoted = true
      AND promoted_until IS NOT NULL
      AND promoted_until < NOW();
END;
$function$;

REVOKE ALL ON FUNCTION public.expire_promoted_products() FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.expire_promoted_products() TO service_role, postgres;

SELECT cron.unschedule('expire_promoted_products_job') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'expire_promoted_products_job'
);
SELECT cron.schedule('expire_promoted_products_job', '*/10 * * * *', 'SELECT public.expire_promoted_products();');
