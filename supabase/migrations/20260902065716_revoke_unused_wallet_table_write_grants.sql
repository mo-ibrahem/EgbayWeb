-- 20260902065716_revoke_unused_wallet_table_write_grants.sql
--
-- user_wallets and wallet_transactions both had full table-level
-- INSERT/UPDATE/DELETE grants to anon and authenticated, with only a
-- read-only RLS policy defined on either table. This "worked" only
-- because Postgres RLS defaults to deny for any command with no
-- matching policy -- a single safety net, not two: any future policy
-- added to either table (even one unrelated to balance, written without
-- extreme care) would immediately reopen direct wallet-balance
-- manipulation, and it would not show up as a new grant in review, only
-- as a new policy. All real balance changes already go through
-- SECURITY DEFINER RPCs (checkout_with_wallet, release_escrow,
-- request_wallet_payout, purchase_boost, book_live_session,
-- admin_resolve_dispute, process_paymob_*), none of which need this
-- grant since they run as their owner (postgres), not as the caller's
-- role. Matches the same fix already applied to live_sessions.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.user_wallets FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.wallet_transactions FROM anon, authenticated;
