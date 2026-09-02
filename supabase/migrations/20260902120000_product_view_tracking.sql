-- 20260902120000_product_view_tracking.sql
--
-- products.view_count existed as a column but nothing ever wrote to it --
-- every product sat at 0. The seller dashboard now surfaces views as the
-- primary "is my listing working?" signal (the most documented driver of
-- marketplace seller retention), so the counter needs to be real rather
-- than a permanently-zero vanity number.
--
-- Deliberately callable by anon and authenticated: view counting has to
-- work for logged-out browsers, which is the majority of marketplace
-- traffic. This is a non-financial vanity counter -- the worst case abuse
-- is someone inflating their own view number, which buys them nothing.
-- It is scoped to incrementing exactly one integer and cannot touch price,
-- stock, status, or any promotion field (those remain protected by
-- trg_prevent_promotion_tampering and the column grants).
CREATE OR REPLACE FUNCTION public.increment_product_view(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
    UPDATE public.products
    SET view_count = COALESCE(view_count, 0) + 1
    WHERE id = p_product_id
      AND status = 'active';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.increment_product_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_product_view(uuid) TO anon, authenticated, service_role;
