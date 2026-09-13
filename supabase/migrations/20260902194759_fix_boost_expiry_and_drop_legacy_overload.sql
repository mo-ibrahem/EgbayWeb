DROP FUNCTION IF EXISTS public.purchase_boost(uuid, uuid, text, integer);

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
SELECT cron.schedule('expire_promoted_products_job', '*/10 * * * *', 'SELECT public.expire_promoted_products();');;
