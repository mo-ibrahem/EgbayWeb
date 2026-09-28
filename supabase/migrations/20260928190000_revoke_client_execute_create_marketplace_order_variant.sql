-- The 8-argument create_marketplace_order (p_variant_id), added 2026-09-16 by
-- create_order_with_variant, never revoked the default PUBLIC EXECUTE that
-- CREATE FUNCTION grants. It takes p_buyer_id as a parameter and never checks
-- it against auth.uid() -- it was designed for web's /api/orders to call with
-- the service role after verifying the JWT.
--
-- Result: anon, with no JWT, could create orders in any user's name and take
-- any listing's stock to zero. Proven exploitable in a rolled-back transaction
-- before this fix.
REVOKE ALL ON FUNCTION public.create_marketplace_order(uuid,uuid,text,text,text,jsonb,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_marketplace_order(uuid,uuid,text,text,text,jsonb,uuid,uuid) TO service_role;

-- Records the 2026-09-10 public_profiles write revoke, which was applied via
-- execute_sql and never entered migration history. Idempotent.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.public_profiles FROM anon, authenticated;
