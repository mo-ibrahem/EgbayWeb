-- 20260901194228_restrict_orders_pin_columns.sql
--
-- NOTE: remote migration history (supabase_migrations.schema_migrations)
-- also has an entry at version 20260901194126 named
-- "restrict_orders_pin_columns" -- that was this migration's first,
-- ineffective attempt (see below: a column-level REVOKE that a
-- pre-existing table-level GRANT silently overrode). It made no real
-- schema change, so there is no corresponding file for it; this file
-- (20260901194228, "_v2" in the recorded name) is the one that actually
-- changed anything.
--
-- orders' RLS SELECT policy ("Users can view own orders") is row-scoped
-- (buyer_id = auth.uid() OR seller_id = auth.uid()) but not column-scoped,
-- so a seller could directly SELECT handover_pin_hash for their own order
-- via PostgREST and brute-force the 6-digit PIN offline (bcrypt cost 10,
-- 10^6 keyspace -- feasible on commodity GPU hardware in hours), then
-- submit it through the legitimate release endpoint without ever handing
-- over the item. Confirmed before this migration: no client-side code
-- path actually needs to read these columns -- the one direct client
-- select('*') on orders (app/orders/success/page.tsx) was already
-- narrowed to an explicit column list that excludes them, and the only
-- code that decrypts/serves the buyer's PIN is the /api/orders route,
-- which uses the service-role key and is unaffected by any of this.
--
-- A first attempt at this migration used a column-level
-- `REVOKE SELECT (handover_pin_hash, handover_pin_encrypted) ... FROM
-- authenticated, anon`, but that had no effect: a broader table-level
-- `GRANT SELECT ON orders TO authenticated/anon` already existed (visible
-- in pg_class.relacl as authenticated=arwdDxt, anon=arwdDxt), and Postgres
-- privilege checks are the UNION of table-level and column-level grants --
-- revoking only the column-level grant record does not override a
-- pre-existing table-level grant that already covers that column. This
-- migration instead revokes the table-level SELECT entirely and re-grants
-- it only for the explicit allowlist of non-PIN columns.

REVOKE SELECT ON public.orders FROM authenticated, anon;

GRANT SELECT (
  id, payment_id, product_id, buyer_id, seller_id, status,
  shipping_address, tracking_number, notes, created_at, updated_at,
  shipped_at, delivered_at, paymob_transaction_id, amount,
  product_snapshot, handover_method
) ON public.orders TO authenticated, anon;
