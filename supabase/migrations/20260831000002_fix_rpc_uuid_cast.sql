-- Fix RPC parameter casting

BEGIN;

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
    
    -- Order-level Idempotency Check (Happens FIRST)
    IF v_status = 'escrow_secured' THEN 
        IF v_paymob_transaction_id = p_paymob_tx_id THEN
            -- Verify ledger integrity before reporting idempotent success
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

    IF NOT FOUND THEN RAISE EXCEPTION 'Seller wallet not found'; END IF;

    -- Dynamic Escrow Calculations
    SELECT seller_tier INTO v_tier FROM public.user_profiles WHERE id = v_seller_id;
    
    IF v_tier = 1 THEN v_platform_fee_rate := 0.08;
    ELSIF v_tier = 2 THEN v_platform_fee_rate := 0.06;
    ELSE v_platform_fee_rate := 0.10;
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

    -- EXACT INSERT: Paymob marketplace payment (Dual-write compatible)
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
$$;
REVOKE ALL ON FUNCTION public.process_paymob_order_payment(TEXT, BIGINT, BIGINT, TEXT) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.process_paymob_order_payment(TEXT, BIGINT, BIGINT, TEXT) TO service_role;


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
    v_order_uuid UUID;
    
    v_tier INT;
    v_platform_fee_rate NUMERIC;
    v_platform_commission NUMERIC;
    v_paymob_fee NUMERIC;
    v_total_deductions NUMERIC;
    v_net_escrow NUMERIC(12, 2);
BEGIN
    v_order_uuid := p_order_id::UUID;
    SELECT buyer_id, seller_id, amount, status
    INTO v_buyer_id, v_seller_id, v_amount, v_status
    FROM public.orders WHERE id = v_order_uuid FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
    IF v_buyer_id != p_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    IF v_status != 'pending_payment' THEN RAISE EXCEPTION 'Order not pending_payment'; END IF;

    SELECT id, available_balance INTO v_wallet_id, v_available_balance
    FROM public.user_wallets WHERE user_id = p_user_id FOR UPDATE;

    IF NOT FOUND OR v_available_balance < v_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

    SELECT id INTO v_seller_wallet_id
    FROM public.user_wallets WHERE user_id = v_seller_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Seller wallet not found'; END IF;

    SELECT seller_tier INTO v_tier FROM public.user_profiles WHERE id = v_seller_id;
    
    IF v_tier = 1 THEN v_platform_fee_rate := 0.08;
    ELSIF v_tier = 2 THEN v_platform_fee_rate := 0.06;
    ELSE v_platform_fee_rate := 0.10;
    END IF;

    v_platform_commission := v_amount * v_platform_fee_rate;
    v_paymob_fee := 0; -- No external gateway fee for pure wallet payment
    v_total_deductions := v_platform_commission + v_paymob_fee;
    v_net_escrow := v_amount - v_total_deductions;

    IF v_net_escrow <= 0 THEN RAISE EXCEPTION 'Net escrow amount is negative or zero'; END IF;

    UPDATE public.user_wallets
    SET available_balance = available_balance - v_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;

    UPDATE public.user_wallets
    SET pending_balance = pending_balance + v_net_escrow,
        updated_at = NOW()
    WHERE id = v_seller_wallet_id;

    UPDATE public.orders 
    SET status = 'escrow_secured', updated_at = NOW()
    WHERE id = v_order_uuid;

    INSERT INTO public.order_events (order_id, event_type, created_at)
    VALUES (v_order_uuid, 'payment_completed', NOW());
    
    INSERT INTO public.order_events (order_id, event_type, created_at)
    VALUES (v_order_uuid, 'escrow_secured', NOW());

    -- Atomic double-entry logging
    INSERT INTO public.wallet_transactions (
        wallet_id, order_id, type, amount, status, description, delta_available, delta_pending, order_fk
    ) VALUES (
        v_wallet_id, p_order_id, 'purchase', v_amount, 'completed', 'Order Payment', -v_amount, 0, v_order_uuid
    );

    INSERT INTO public.wallet_transactions (
        wallet_id, order_id, type, amount, status, description, delta_available, delta_pending, fee_amount, order_fk
    ) VALUES (
        v_seller_wallet_id, p_order_id, 'escrow_hold', v_net_escrow, 'completed', 'Escrow Hold for Order', 0, v_net_escrow, v_total_deductions, v_order_uuid
    );

    RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.checkout_with_wallet(UUID, TEXT) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.checkout_with_wallet(UUID, TEXT) TO authenticated, service_role;

COMMIT;
