-- 20260901201204_correct_wallet_62fbcba2_escrow_release_drift.sql
--
-- One-time financial correction, applied only after a full investigation
-- (see the earlier audit finding H3) and explicit approval from the
-- platform owner.
--
-- Order de56e674-234c-4f5d-8451-492e323a9477 released escrow on
-- 2026-08-31 14:49:47 through a buggy earlier version of release_escrow
-- (materially different from any version in this migration history --
-- consistent with this project's established pattern of undocumented
-- manual RPC edits). It correctly cleared the seller's pending_balance
-- (64.1825 -> 0, matching the escrow_hold amount exactly) but the
-- resulting `earning` ledger row recorded amount=0.00 / delta_available=0
-- / delta_pending=0, and the wallet's available_balance was never
-- credited. Confirmed via the wallet's complete transaction history
-- (exactly 2 rows, ever -- the escrow_hold and this earning row) and its
-- current real balance (available_balance still 0.00 today) that the
-- money was not merely mis-logged: it was never credited anywhere.
--
-- This does not edit or delete the original (wrong) ledger row -- it
-- adds a new, clearly-labeled correcting entry, per standard practice:
-- historical financial records are never rewritten, only offset.

DO $$
DECLARE
  v_wallet_id UUID := '62fbcba2-15c4-40c8-803f-ccce0d38df3f';
  v_order_id UUID := 'de56e674-234c-4f5d-8451-492e323a9477';
  v_correction_amount NUMERIC(12,2) := 64.1825;
  v_original_tx_id UUID;
BEGIN
  SELECT id INTO v_original_tx_id
  FROM public.wallet_transactions
  WHERE wallet_id = v_wallet_id AND order_fk = v_order_id AND type = 'earning'
  ORDER BY created_at LIMIT 1;

  IF v_original_tx_id IS NULL THEN
    RAISE EXCEPTION 'Expected original earning row not found -- aborting correction to avoid acting on unexpected state';
  END IF;

  -- Safety check: only proceed if the wallet is still in the exact
  -- drifted state this correction was investigated against.
  PERFORM 1 FROM public.user_wallets
  WHERE id = v_wallet_id AND available_balance = 0.00 AND pending_balance = 0.00;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet state has changed since this correction was investigated -- aborting';
  END IF;

  UPDATE public.user_wallets
  SET available_balance = available_balance + v_correction_amount,
      updated_at = NOW()
  WHERE id = v_wallet_id;

  INSERT INTO public.wallet_transactions (
    wallet_id, order_id, type, amount, status, description,
    delta_available, delta_pending, order_fk
  ) VALUES (
    v_wallet_id, v_order_id::TEXT, 'earning', v_correction_amount, 'completed',
    'Correction: escrow release on 2026-08-31 credited $0.00 instead of the ' ||
    'correct net amount due to a bug in an earlier release_escrow version ' ||
    '(pending_balance was correctly cleared but available_balance was never ' ||
    'credited). Original wrong ledger entry: ' || v_original_tx_id::TEXT ||
    ' (left unmodified). Applied ' || NOW()::TEXT || ' after investigation and ' ||
    'explicit platform-owner approval.',
    v_correction_amount, 0, v_order_id
  );
END $$;
