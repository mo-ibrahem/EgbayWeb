-- 20260902065825_fix_user_wallets_self_service_creation.sql
--
-- The previous migration (revoke_unused_wallet_table_write_grants) revoked
-- INSERT on user_wallets from authenticated, but getUserWallet() in the
-- app client-side inserts a zero-balance wallet row the first time a
-- user is read and none exists yet -- there is no signup trigger that
-- creates it server-side (create_user_profile() only creates
-- user_profiles). That INSERT is the only place a wallet row is ever
-- created, for every user, so revoking it broke first-time wallet
-- creation entirely.
--
-- Fix: restore INSERT, but gate it with an RLS policy that only allows a
-- user to insert their OWN wallet row, and only with a starting balance
-- of exactly zero -- so this stays safe (nobody can insert a wallet with
-- a nonzero balance or for someone else) without needing a schema change
-- to move creation server-side. UPDATE/DELETE remain revoked with no
-- policy, so once created a wallet row can never be changed by a client
-- directly, only through the SECURITY DEFINER RPCs.
GRANT INSERT ON public.user_wallets TO authenticated;

CREATE POLICY "Users can create own zero-balance wallet"
ON public.user_wallets
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND pending_balance = 0
  AND available_balance = 0
);
