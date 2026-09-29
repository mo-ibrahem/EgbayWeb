-- Sellers could give themselves a free, permanent paid boost.
--
-- check_product_promotion_update guards the promotion columns on UPDATE only,
-- but authenticated holds INSERT on them. Proven in a rolled-back transaction:
-- a signed-in seller inserted a listing with is_promoted = true,
-- promotion_tier = 'turbo', promoted_until = 2099 -- exactly what boosts are
-- sold for -- plus view_count = 999999 and created_at = 2099. Every feed sorts
-- by created_at desc, so a future date also pins a listing to the top forever;
-- view_count is shown publicly as a popularity signal. Both are editable on
-- UPDATE too.
--
-- One trigger, rather than narrowing the column grants: both apps insert
-- through a spread payload, so a narrower grant risks breaking a field nobody
-- traced. This only overrides values no legitimate client sends.
--
-- current_user, not the JWT role: inside a SECURITY DEFINER function such as
-- increment_product_view or purchase_boost (both owned by postgres) the JWT
-- still says 'authenticated', but current_user is the owner -- so real view
-- counting and paid boosts keep working.
CREATE OR REPLACE FUNCTION public.guard_product_client_writes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_catalog AS $fn$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_promoted := false; NEW.is_promoted_on_sale := false; NEW.promotion_tier := NULL;
      NEW.promoted_until := NULL; NEW.promoted_ad_rate := 0.00;
      NEW.view_count := 0; NEW.created_at := now();
    ELSIF NEW.view_count IS DISTINCT FROM OLD.view_count OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'A listing''s view count and creation date cannot be edited' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $fn$;

REVOKE ALL ON FUNCTION public.guard_product_client_writes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_product_client_writes ON public.products;
CREATE TRIGGER trg_guard_product_client_writes BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.guard_product_client_writes();
