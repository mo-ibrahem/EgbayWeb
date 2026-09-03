-- Every user gets a wallet, and a card payment never fails for the want
-- of one.
--
-- Buyer paid 188 EGP for order 4ade5e95 (Paymob tx 527715072, Success).
-- paymob-webhook verified the HMAC, called process_paymob_order_payment,
-- and the RPC raised 'Seller wallet not found' -- so the whole
-- transaction rolled back and the order sat at pending_payment while
-- Paymob had the money. The buyer saw "Payment Pending..." forever.
--
-- The seller had no row in user_wallets because nothing creates one at
-- signup: on_auth_user_created -> create_user_profile inserts a profile
-- only. Wallets were created lazily by other paths (a first top-up), so
-- any seller who never topped up had none. 17 of 26 users were in that
-- state, including 1 of 9 currently-active sellers.
--
-- Three parts: create wallets at signup, backfill the ones missing, and
-- stop the Paymob path raising over it. A wallet row is an empty ledger
-- container -- every column but user_id defaults, balances to 0.00 -- so
-- creating one records no money and moves none.

-- 1. Signup creates the wallet alongside the profile.
CREATE OR REPLACE FUNCTION public.create_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    -- Use the full_name if it exists, otherwise fallback to the email
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );

  -- Balances all default to 0.00. ON CONFLICT so this stays idempotent
  -- if a wallet was somehow already created for this id.
  INSERT INTO public.user_wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 2. Backfill the users who never got one.
INSERT INTO public.user_wallets (user_id)
SELECT u.id
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_wallets w WHERE w.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

-- 3. By the time this RPC runs, Paymob has already taken the buyer's
--    money. It must never fail for a missing row we control, so create
--    the seller's wallet rather than raising. Unchanged otherwise.
CREATE OR REPLACE FUNCTION public.process_paymob_order_payment(p_merchant_order_id text, p_paymob_tx_id bigint, p_amount_cents bigint, p_currency text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_order_id UUID;
    v_buyer_id UUID;
    v_seller_id UUID;
    v_amount NUMERIC(12, 2);
    v_status TEXT;
    v_paymob_transaction_id BIGINT;
    v_amount_egp NUMERIC(12, 2);
    v_seller_wallet_id UUID;
    v_tier INT;
    v_platform_fee_rate NUMERIC;
    v_platform_commission NUMERIC;
    v_paymob_fee NUMERIC;
    v_total_deductions NUMERIC;
    v_net_escrow NUMERIC(12, 2);
BEGIN
    v_amount_egp := p_amount_cents / 100.0;

    SELECT id, buyer_id, seller_id, amount, status, paymob_transaction_id
    INTO v_order_id, v_buyer_id, v_seller_id, v_amount, v_status, v_paymob_transaction_id
    FROM public.orders
    WHERE id = p_merchant_order_id::UUID
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

    IF v_status = 'escrow_secured' THEN
        IF v_paymob_transaction_id = p_paymob_tx_id THEN
            PERFORM 1 FROM public.wallet_transactions
            WHERE order_fk = v_order_id
              AND type = 'escrow_hold'
              AND paymob_transaction_id = p_paymob_tx_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'CRITICAL ALARM: Order % is escrow_secured but missing ledger hold for Paymob TX %', v_order_id, p_paymob_tx_id;
            END IF;

            RETURN jsonb_build_object('success', true, 'message', 'Idempotent completion');
        ELSE
            RAISE EXCEPTION 'Order % already paid by different Paymob TX %', v_order_id, v_paymob_transaction_id;
        END IF;
    END IF;

    IF v_status != 'pending_payment' THEN RAISE EXCEPTION 'Order not pending_payment'; END IF;
    IF v_amount != v_amount_egp THEN RAISE EXCEPTION 'Amount mismatch: expected %, got %', v_amount, v_amount_egp; END IF;

    SELECT id INTO v_seller_wallet_id
    FROM public.user_wallets WHERE user_id = v_seller_id FOR UPDATE;

    IF v_seller_wallet_id IS NULL THEN
        INSERT INTO public.user_wallets (user_id)
        VALUES (v_seller_id)
        ON CONFLICT (user_id) DO NOTHING
        RETURNING id INTO v_seller_wallet_id;

        -- Lost the race to a concurrent insert: re-read and lock it.
        IF v_seller_wallet_id IS NULL THEN
            SELECT id INTO v_seller_wallet_id
            FROM public.user_wallets WHERE user_id = v_seller_id FOR UPDATE;
        END IF;

        IF v_seller_wallet_id IS NULL THEN
            RAISE EXCEPTION 'Could not create seller wallet for %', v_seller_id;
        END IF;
    END IF;

    SELECT tier INTO v_tier FROM public.user_profiles WHERE id = v_seller_id;

    IF v_tier = 1 THEN v_platform_fee_rate := 0.035;
    ELSIF v_tier = 2 THEN v_platform_fee_rate := 0.025;
    ELSIF v_tier = 3 THEN v_platform_fee_rate := 0.015;
    ELSE v_platform_fee_rate := 0.035;
    END IF;

    v_platform_commission := v_amount * v_platform_fee_rate;
    v_paymob_fee := (v_amount * 0.0275) + 3.00;
    v_total_deductions := v_platform_commission + v_paymob_fee;
    v_net_escrow := v_amount - v_total_deductions;

    IF v_net_escrow <= 0 THEN RAISE EXCEPTION 'Net escrow amount is negative or zero'; END IF;

    UPDATE public.orders
    SET status = 'escrow_secured',
        paymob_transaction_id = p_paymob_tx_id,
        updated_at = NOW()
    WHERE id = v_order_id;

    UPDATE public.user_wallets
    SET pending_balance = pending_balance + v_net_escrow,
        updated_at = NOW()
    WHERE id = v_seller_wallet_id;

    INSERT INTO public.order_events (order_id, event_type, created_at)
    VALUES (v_order_id, 'payment_completed', NOW());

    INSERT INTO public.order_events (order_id, event_type, created_at)
    VALUES (v_order_id, 'escrow_secured', NOW());

    BEGIN
        INSERT INTO public.wallet_transactions (
            wallet_id, order_id, type, amount, status, description,
            delta_available, delta_pending, order_fk, paymob_transaction_id, fee_amount
        ) VALUES (
            v_seller_wallet_id, v_order_id::TEXT, 'escrow_hold', v_net_escrow, 'completed', 'Escrow Hold for Order (Paymob)',
            0, v_net_escrow, v_order_id, p_paymob_tx_id, v_total_deductions
        );
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Duplicate Paymob transaction ID % globally rejected', p_paymob_tx_id;
    END;

    RETURN jsonb_build_object('success', true);
END;
$function$;
