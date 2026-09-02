-- 20260901205912_escrow_hold_uniqueness_guard.sql
--
-- release_escrow does `SELECT delta_pending INTO STRICT v_net_escrow FROM
-- wallet_transactions WHERE order_fk = ... AND type = 'escrow_hold' AND
-- wallet_id = ...` -- STRICT requires exactly one matching row, or the
-- whole release fails. There are 30 legacy rows (type='escrow_hold',
-- negative delta_available -- from an earlier generation of wallet RPCs
-- that mislabeled buyer debits as 'escrow_hold') that all currently have
-- order_fk = NULL, so they can never match this lookup today. But
-- nothing in the schema actually prevents order_fk from being backfilled
-- onto one of them, or a future bug from inserting a second real
-- escrow_hold row for the same (order_fk, wallet_id) pair -- either of
-- which would make release_escrow's STRICT select throw
-- TOO_MANY_ROWS/ambiguous and fail an otherwise-legitimate release.
--
-- This does not touch the 30 legacy rows themselves (no historical data
-- modified) -- it only adds a constraint making that failure mode
-- structurally impossible going forward.

CREATE UNIQUE INDEX IF NOT EXISTS uq_escrow_hold_per_order_wallet
  ON public.wallet_transactions (order_fk, wallet_id)
  WHERE type = 'escrow_hold' AND order_fk IS NOT NULL;
