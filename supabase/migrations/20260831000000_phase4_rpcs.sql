-- Phase 4 RPCs for Egbay Wallet and Escrow System

-- 1. process_paymob_topup (Wallet Top-Up Only)
CREATE OR REPLACE FUNCTION public.process_paymob_topup(
    p_merchant_order_id TEXT,
    p_paymob_tx_id BIGINT,
    p_amount_cents BIGINT,
    p_currency TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_topup_id UUID;
    v_user_id UUID;
    v_amount NUMERIC(12, 2);
    v_currency TEXT;
    v_status TEXT;
    v_paymob_transaction_id BIGINT;
    v_wallet_id UUID;
    v_amount_egp NUMERIC(12, 2);
BEGIN
    v_amount_egp := p_amount_cents / 100.0;

    SELECT id, user_id, amount, currency, status, paymob_transaction_id
    INTO v_topup_id, v_user_id, v_amount, v_currency, v_status, v_paymob_transaction_id
    FROM public.wallet_topups
    WHERE merchant_order_id = p_merchant_order_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Top-up not found: %', p_merchant_order_id; END IF;
    
    -- Order-level Idempotency Check (Happens FIRST)
    IF v_status = 'paid' THEN 
        IF v_paymob_transaction_id = p_paymob_tx_id THEN
            -- Verify ledger integrity before reporting idempotent success
            PERFORM 1 FROM public.wallet_transactions 
            WHERE topup_fk = v_topup_id 
              AND type = 'top_up' 
              AND paymob_transaction_id = p_paymob_tx_id;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Integrity Error: Top-up is paid but ledger record is missing/mismatched';
            END IF;

            RETURN jsonb_build_object('success', true, 'message', 'Already processed'); 
        ELSIF v_paymob_transaction_id IS NOT NULL THEN
            RAISE EXCEPTION 'Top-up already settled with a different transaction ID';
        END IF;
    END IF;
    
    IF v_status != 'pending' THEN RAISE EXCEPTION 'Top-up is not pending'; END IF;
    IF v_amount != v_amount_egp THEN RAISE EXCEPTION 'Amount mismatch'; END IF;
    IF v_currency != p_currency THEN RAISE EXCEPTION 'Currency mismatch'; END IF;

    SELECT id INTO v_wallet_id FROM public.user_wallets WHERE user_id = v_user_id FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.user_wallets (user_id, available_balance, pending_balance, currency)
        VALUES (v_user_id, v_amount, 0, 'EGP') RETURNING id INTO v_wallet_id;
    ELSE
        UPDATE public.user_wallets
        SET available_balance = available_balance + v_amount, updated_at = NOW()
        WHERE id = v_wallet_id;
    END IF;

    -- EXACT INSERT: Paymob top-up with Unique Violation catching for concurrency
    BEGIN
        INSERT INTO public.wallet_transactions (
            wallet_id, type, amount, status, description, 
            delta_available, delta_pending, topup_fk, paymob_transaction_id
        ) VALUES (
            v_wallet_id, 'top_up', v_amount, 'completed', 'Wallet Deposit via Paymob', 
            v_amount, 0, v_topup_id, p_paymob_tx_id
        );
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Duplicate Paymob transaction ID % globally rejected', p_paymob_tx_id;
    END;

    UPDATE public.wallet_topups
    SET status = 'paid', paymob_transaction_id = p_paymob_tx_id, paid_at = NOW()
    WHERE id = v_topup_id;

    RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.process_paymob_topup(TEXT, BIGINT, BIGINT, TEXT) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.process_paymob_topup(TEXT, BIGINT, BIGINT, TEXT) TO service_role;


-- 2. process_paymob_order_payment (Marketplace Payment)
CREATE OR REPLACE FUNCTION public.process_paymob_order_payment(
    p_merchant_order_id TEXT,
    p_paymob_tx_id BIGINT,
    p_amount_cents BIGINT,
    p_currency TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_order_id TEXT;
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
    WHERE id = p_merchant_order_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
    
    -- Order-level Idempotency Check (Happens FIRST)
    IF v_status = 'escrow_secured' THEN 
        IF v_paymob_transaction_id = p_paymob_tx_id THEN
            -- Verify ledger integrity before reporting idempotent success
            PERFORM 1 FROM public.wallet_transactions 
            WHERE order_fk = v_order_id 
              AND type = 'escrow_hold' 
              AND paymob_transaction_id = p_paymob_tx_id;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Integrity Error: Order is escrow_secured but matching ledger record is missing';
            END IF;

            RETURN jsonb_build_object('success', true, 'message', 'Already processed'); 
        ELSIF v_paymob_transaction_id IS NOT NULL THEN
            RAISE EXCEPTION 'Order already paid with a different transaction ID';
        END IF;
    END IF;
    
    IF v_status != 'pending_payment' THEN RAISE EXCEPTION 'Order not pending_payment'; END IF;
    IF v_amount != v_amount_egp THEN RAISE EXCEPTION 'Amount mismatch'; END IF;
    IF p_currency != 'EGP' THEN RAISE EXCEPTION 'Currency mismatch'; END IF;

    -- Authoritative Marketplace Fee Calculation
    SELECT tier INTO v_tier FROM public.user_profiles WHERE id = v_seller_id;
    IF v_tier IS NULL THEN v_tier := 1; END IF;

    IF v_tier = 1 THEN v_platform_fee_rate := 0.035;
    ELSIF v_tier = 2 THEN v_platform_fee_rate := 0.025;
    ELSIF v_tier = 3 THEN v_platform_fee_rate := 0.015;
    ELSE v_platform_fee_rate := 0.035;
    END IF;

    v_paymob_fee := ROUND((v_amount * 0.0275) + 3);
    v_platform_commission := ROUND(v_amount * v_platform_fee_rate);
    v_total_deductions := v_platform_commission + v_paymob_fee;
    v_net_escrow := v_amount - v_total_deductions;

    UPDATE public.orders 
    SET status = 'escrow_secured',
        paymob_transaction_id = p_paymob_tx_id
    WHERE id = v_order_id;

    -- Create canonical order_events for Paymob Marketplace Payment
    INSERT INTO public.order_events (order_id, event_type, metadata, created_at)
    VALUES (v_order_id, 'payment_completed', '{"method": "paymob"}', NOW());

    INSERT INTO public.order_events (order_id, event_type, created_at)
    VALUES (v_order_id, 'escrow_secured', NOW());

    -- Credit seller pending
    SELECT id INTO v_seller_wallet_id FROM public.user_wallets WHERE user_id = v_seller_id FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.user_wallets (user_id, available_balance, pending_balance, currency)
        VALUES (v_seller_id, 0, v_net_escrow, 'EGP') RETURNING id INTO v_seller_wallet_id;
    ELSE
        UPDATE public.user_wallets SET pending_balance = pending_balance + v_net_escrow, updated_at = NOW()
        WHERE id = v_seller_wallet_id;
    END IF;

    -- EXACT INSERT: Paymob marketplace payment (Dual-write compatible)
    BEGIN
        INSERT INTO public.wallet_transactions (
            wallet_id, order_id, type, amount, status, description, 
            delta_available, delta_pending, order_fk, paymob_transaction_id, fee_amount
        ) VALUES (
            v_seller_wallet_id, v_order_id, 'escrow_hold', v_net_escrow, 'completed', 'Escrow Hold for Order (Paymob)', 
            0, v_net_escrow, v_order_id, p_paymob_tx_id, v_total_deductions
        );
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Duplicate Paymob transaction ID % globally rejected', p_paymob_tx_id;
    END;

    RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.process_paymob_order_payment(TEXT, BIGINT, BIGINT, TEXT) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.process_paymob_order_payment(TEXT, BIGINT, BIGINT, TEXT) TO service_role;


-- 3. checkout_with_wallet
CREATE OR REPLACE FUNCTION public.checkout_with_wallet(
    p_user_id UUID,
    p_order_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_buyer_id UUID;
    v_seller_id UUID;
    v_amount NUMERIC(12, 2);
    v_status TEXT;
    v_wallet_id UUID;
    v_available_balance NUMERIC(12, 2);
    v_seller_wallet_id UUID;
    
    v_tier INT;
    v_platform_fee_rate NUMERIC;
    v_platform_commission NUMERIC;
    v_paymob_fee NUMERIC;
    v_total_deductions NUMERIC;
    v_net_escrow NUMERIC(12, 2);
BEGIN
    SELECT buyer_id, seller_id, amount, status
    INTO v_buyer_id, v_seller_id, v_amount, v_status
    FROM public.orders WHERE id = p_order_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
    IF v_buyer_id != p_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    IF v_status != 'pending_payment' THEN RAISE EXCEPTION 'Order not pending_payment'; END IF;

    SELECT id, available_balance INTO v_wallet_id, v_available_balance
    FROM public.user_wallets WHERE user_id = p_user_id FOR UPDATE;

    IF NOT FOUND OR v_available_balance < v_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

    -- Authoritative Marketplace Fee Calculation
    SELECT tier INTO v_tier FROM public.user_profiles WHERE id = v_seller_id;
    IF v_tier IS NULL THEN v_tier := 1; END IF;

    IF v_tier = 1 THEN v_platform_fee_rate := 0.035;
    ELSIF v_tier = 2 THEN v_platform_fee_rate := 0.025;
    ELSIF v_tier = 3 THEN v_platform_fee_rate := 0.015;
    ELSE v_platform_fee_rate := 0.035;
    END IF;

    v_paymob_fee := ROUND((v_amount * 0.0275) + 3);
    v_platform_commission := ROUND(v_amount * v_platform_fee_rate);
    v_total_deductions := v_platform_commission + v_paymob_fee;
    v_net_escrow := v_amount - v_total_deductions;

    -- Debit buyer
    UPDATE public.user_wallets
    SET available_balance = available_balance - v_amount, updated_at = NOW()
    WHERE id = v_wallet_id;

    -- EXACT INSERT: wallet checkout (Buyer Debit)
    INSERT INTO public.wallet_transactions (
        wallet_id, order_id, type, amount, status, description, 
        delta_available, delta_pending, order_fk
    ) VALUES (
        v_wallet_id, p_order_id, 'fee_deduction', -v_amount, 'completed', 'Order Payment via Wallet', 
        -v_amount, 0, p_order_id
    );

    -- Credit seller
    SELECT id INTO v_seller_wallet_id FROM public.user_wallets WHERE user_id = v_seller_id FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.user_wallets (user_id, available_balance, pending_balance, currency)
        VALUES (v_seller_id, 0, v_net_escrow, 'EGP') RETURNING id INTO v_seller_wallet_id;
    ELSE
        UPDATE public.user_wallets
        SET pending_balance = pending_balance + v_net_escrow, updated_at = NOW()
        WHERE id = v_seller_wallet_id;
    END IF;

    -- EXACT INSERT: wallet checkout (Seller Escrow)
    INSERT INTO public.wallet_transactions (
        wallet_id, order_id, type, amount, status, description, 
        delta_available, delta_pending, order_fk, fee_amount
    ) VALUES (
        v_seller_wallet_id, p_order_id, 'escrow_hold', v_net_escrow, 'completed', 'Escrow Hold for Order (Wallet)', 
        0, v_net_escrow, p_order_id, v_total_deductions
    );

    UPDATE public.orders SET status = 'escrow_secured' WHERE id = p_order_id;
    
    -- Create canonical order_events for Wallet Checkout
    INSERT INTO public.order_events (order_id, event_type, metadata, created_at)
    VALUES (p_order_id, 'payment_completed', '{"method": "wallet"}', NOW());

    INSERT INTO public.order_events (order_id, event_type, created_at)
    VALUES (p_order_id, 'escrow_secured', NOW());

    RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.checkout_with_wallet(UUID, TEXT) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.checkout_with_wallet(UUID, TEXT) TO service_role;


-- 4. release_escrow (Authoritative Net Release)
CREATE OR REPLACE FUNCTION public.release_escrow(
    p_user_id UUID,
    p_order_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_seller_id UUID;
    v_buyer_id UUID;
    v_status TEXT;
    v_seller_wallet_id UUID;
    v_seller_pending_balance NUMERIC(12, 2);
    v_net_escrow NUMERIC(12, 2);
BEGIN
    SELECT seller_id, buyer_id, status
    INTO v_seller_id, v_buyer_id, v_status
    FROM public.orders WHERE id = p_order_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
    IF p_user_id NOT IN (v_seller_id, v_buyer_id) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    
    IF v_status = 'completed' THEN RAISE EXCEPTION 'Order already completed and escrow released'; END IF;
    IF v_status != 'escrow_secured' THEN RAISE EXCEPTION 'Order is not escrow_secured'; END IF;

    SELECT id, pending_balance INTO v_seller_wallet_id, v_seller_pending_balance 
    FROM public.user_wallets WHERE user_id = v_seller_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Seller wallet not found'; END IF;

    -- Fetch the EXACT net escrow placed into pending_balance without LIMIT 1 (strictly expects unique)
    SELECT delta_pending INTO STRICT v_net_escrow
    FROM public.wallet_transactions
    WHERE order_fk = p_order_id AND type = 'escrow_hold' AND wallet_id = v_seller_wallet_id;
    
    IF v_seller_pending_balance < v_net_escrow THEN
        RAISE EXCEPTION 'Seller pending balance is less than required escrow release amount';
    END IF;

    UPDATE public.user_wallets
    SET pending_balance = pending_balance - v_net_escrow,
        available_balance = available_balance + v_net_escrow,
        updated_at = NOW()
    WHERE id = v_seller_wallet_id;

    UPDATE public.orders SET status = 'completed' WHERE id = p_order_id;

    INSERT INTO public.order_events (order_id, event_type, created_at)
    VALUES (p_order_id, 'escrow_released', NOW());

    INSERT INTO public.order_events (order_id, event_type, created_at)
    VALUES (p_order_id, 'completed', NOW());

    -- EXACT INSERT: escrow release
    INSERT INTO public.wallet_transactions (
        wallet_id, order_id, type, amount, status, description,
        delta_available, delta_pending, order_fk
    ) VALUES (
        v_seller_wallet_id, p_order_id, 'earning', v_net_escrow, 'completed', 'Escrow Released',
        v_net_escrow, -v_net_escrow, p_order_id
    );

    RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.release_escrow(UUID, TEXT) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.release_escrow(UUID, TEXT) TO service_role;


-- 5. request_wallet_payout (Fixed Signature)
CREATE OR REPLACE FUNCTION public.request_wallet_payout(
    p_user_id UUID,
    p_amount NUMERIC,
    p_payout_method_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_wallet_id UUID;
    v_available_balance NUMERIC(12, 2);
    v_payout_id UUID;
BEGIN
    SELECT id, available_balance INTO v_wallet_id, v_available_balance
    FROM public.user_wallets WHERE user_id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
    IF p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
    IF v_available_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

    PERFORM 1 FROM public.payout_methods WHERE id = p_payout_method_id AND user_id = p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid payout method'; END IF;

    UPDATE public.user_wallets
    SET available_balance = available_balance - p_amount, updated_at = NOW()
    WHERE id = v_wallet_id;

    -- EXACT INSERT: Populating wallet_id for payout requests linkage (ASSUMING IT EXISTS IN SCHEMA)
    INSERT INTO public.payout_requests (
        user_id, wallet_id, amount, status, payout_method_id, created_at
    ) VALUES (
        p_user_id, v_wallet_id, p_amount, 'pending', p_payout_method_id, NOW()
    ) RETURNING id INTO v_payout_id;

    -- EXACT INSERT: payout
    INSERT INTO public.wallet_transactions (
        wallet_id, type, amount, status, description, 
        delta_available, delta_pending, payout_fk
    ) VALUES (
        v_wallet_id, 'withdrawal', -p_amount, 'pending', 'Payout Request', 
        -p_amount, 0, v_payout_id
    );

    RETURN jsonb_build_object('success', true, 'payoutRequestId', v_payout_id);
END;
$$;
REVOKE ALL ON FUNCTION public.request_wallet_payout(UUID, NUMERIC, UUID) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.request_wallet_payout(UUID, NUMERIC, UUID) TO service_role;


-- 6. purchase_boost (Authoritative Pricing & Duration)
CREATE OR REPLACE FUNCTION public.purchase_boost(
    p_user_id UUID,
    p_product_id UUID,
    p_package_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_wallet_id UUID;
    v_available_balance NUMERIC(12, 2);
    v_seller_id UUID;
    v_amount NUMERIC(12, 2);
    v_days INTEGER;
BEGIN
    SELECT seller_id INTO v_seller_id FROM public.products WHERE id = p_product_id;
    
    IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
    IF v_seller_id != p_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;

    -- Authoritative server-side pricing & duration
    IF p_package_id = 'urgent' THEN 
        v_amount := 50.00; v_days := 3;
    ELSIF p_package_id = 'featured' THEN 
        v_amount := 150.00; v_days := 7;
    ELSIF p_package_id = 'turbo' THEN 
        v_amount := 300.00; v_days := 14;
    ELSE RAISE EXCEPTION 'Invalid tier';
    END IF;

    SELECT id, available_balance INTO v_wallet_id, v_available_balance
    FROM public.user_wallets WHERE user_id = p_user_id FOR UPDATE;

    IF NOT FOUND OR v_available_balance < v_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

    UPDATE public.user_wallets
    SET available_balance = available_balance - v_amount, updated_at = NOW()
    WHERE id = v_wallet_id;

    UPDATE public.products
    SET is_promoted = true,
        promotion_tier = p_package_id,
        promoted_until = NOW() + (v_days || ' days')::INTERVAL,
        updated_at = NOW()
    WHERE id = p_product_id;

    -- EXACT INSERT: boost (Using reference_id_text for product tracking)
    INSERT INTO public.wallet_transactions (
        wallet_id, type, amount, status, description, delta_available, delta_pending, reference_id_text
    ) VALUES (
        v_wallet_id, 'boost', -v_amount, 'completed', 'Product Boost - ' || p_package_id, -v_amount, 0, p_product_id::TEXT
    );

    RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.purchase_boost(UUID, UUID, TEXT) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.purchase_boost(UUID, UUID, TEXT) TO service_role;
