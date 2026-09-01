-- 20260901192636_secure_payout_requests.sql
--
-- payout_requests was created out-of-band (no prior migration represents
-- it) with RLS disabled and full anon/authenticated grants -- i.e. any
-- unauthenticated caller with the public anon key could SELECT, INSERT,
-- UPDATE, or DELETE every payout request on the platform via PostgREST.
-- It also has no user_id column, even though request_wallet_payout(uuid,
-- numeric, uuid) inserts one -- every payout request has been failing
-- silently at the database layer (0 rows exist today; the table is
-- otherwise empty, so no backfill is required).
--
-- This migration:
--   1. Adds the missing user_id column the RPC already tries to write.
--   2. Enables RLS with an owner-scoped SELECT policy (matching the
--      pattern already used by orders/wallet_transactions/user_wallets/
--      wallet_topups).
--   3. Revokes direct table access from anon/authenticated. Writes are
--      only ever performed by request_wallet_payout, a SECURITY DEFINER
--      function owned by `postgres` (which has BYPASSRLS and full table
--      privileges as owner), so this does not affect the RPC path -- it
--      only closes the direct PostgREST access path.

ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Table is empty in production today; safe to enforce NOT NULL directly.
ALTER TABLE public.payout_requests
  ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payout_requests_user_id ON public.payout_requests(user_id);

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payout requests" ON public.payout_requests;
CREATE POLICY "Users can view own payout requests"
  ON public.payout_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.payout_requests FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.payout_requests FROM authenticated;
GRANT SELECT ON public.payout_requests TO authenticated;
