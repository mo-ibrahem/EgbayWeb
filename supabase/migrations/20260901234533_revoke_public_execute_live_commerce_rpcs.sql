-- 20260901234533_revoke_public_execute_live_commerce_rpcs.sql
--
-- The previous migration granted EXECUTE on create_marketplace_order(...,
-- uuid) and book_live_session(...) to service_role, but Postgres grants
-- EXECUTE on every newly created function to PUBLIC by default -- that
-- grant is additive, not replaced by a later GRANT to a specific role.
-- Both functions were therefore directly callable by any authenticated
-- (and anon) client via PostgREST, bypassing the server-side PIN
-- generation (create_marketplace_order) and the caller-identity check
-- (book_live_session takes p_seller_id as a plain argument, not derived
-- from auth.uid(), so any caller could charge/book on someone else's
-- behalf). Every other financial RPC in this schema is service_role-only
-- for the same reason (see revoke_direct_checkout_with_wallet); this
-- migration brings these two in line with that pattern.
REVOKE EXECUTE ON FUNCTION public.create_marketplace_order(uuid, uuid, text, text, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.book_live_session(uuid, text, text, text, text, text, timestamptz, text) FROM PUBLIC, anon, authenticated;
