-- 20260901195855_fix_commission_rates_and_tier_column.sql
--
-- Two confirmed bugs, fixed together since they're both in these two
-- functions:
--
-- 1. process_paymob_order_payment reads `seller_tier` from user_profiles.
--    That column has never existed (the real column is `tier` -- already
--    correctly used in checkout_with_wallet, per its own comment "Fixed
--    column name: user_profiles uses tier"). This makes every card-paid
--    marketplace order fail at the database layer with "column
--    seller_tier does not exist" once the order-id webhook routing bug
--    (fixed by the accompanying edge function redeploy) is corrected --
--    without this fix, card payments would still be completely broken.
--
-- 2. Both functions charge 8% / 6% / 10% commission by tier (with tier 3,
--    the "Pro / Store" tier, landing in the ELSE branch alongside NULL
--    tier and therefore paying the WORST rate of the three -- an
--    inversion bug). Every other part of the app -- the seller-facing
--    SELLER_TIERS UI constant, the tier descriptions, the original
--    phase4_rpcs.sql migration -- says 3.5% / 2.5% / 1.5%. Confirmed with
--    the platform owner that 3.5/2.5/1.5% is the intended pricing.
--    Fixed to explicit per-tier branches so tier 3 correctly gets the
--    lowest rate, and unset/unknown tier falls back to tier 1's rate
--    (3.5%) rather than silently landing on whatever the last branch
--    happens to be.

CREATE OR REPLACE FUNCTION public.checkout_with_wallet(p_user_id uuid, p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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

    SELECT id INTO v_seller_wallet_id
    FROM public.user_wallets WHERE user_id = v_seller_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Seller wallet not found'; END IF;

    SELECT tier INTO v_tier FROM public.user_profiles WHERE id = v_seller_id;

    IF v_tier = 1 THEN v_platform_fee_rate := 0.035;
    ELSIF v_tier = 2 THEN v_platform_fee_rate := 0.025;
    ELSIF v_tier = 3 THEN v_platform_fee_rate := 0.015;
    ELSE v_platform_fee_rate := 0.035;
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
    WHERE id = p_order_id;

    INSERT INTO public.order_events (order_id, event_type, created_at)
    VALUES (p_order_id, 'payment_completed', NOW());

    INSERT INTO public.order_events (order_id, event_type, created_at)
    VALUES (p_order_id, 'escrow_secured', NOW());

    INSERT INTO public.wallet_transactions (
        wallet_id, order_id, type, amount, status, description, delta_available, delta_pending, order_fk
    ) VALUES (
        v_wallet_id, p_order_id::TEXT, 'purchase', v_amount, 'completed', 'Order Payment', -v_amount, 0, p_order_id
    );

    INSERT INTO public.wallet_transactions (
        wallet_id, order_id, type, amount, status, description, delta_available, delta_pending, fee_amount, order_fk
    ) VALUES (
        v_seller_wallet_id, p_order_id::TEXT, 'escrow_hold', v_net_escrow, 'completed', 'Escrow Hold for Order', 0, v_net_escrow, v_total_deductions, p_order_id
    );

    RETURN jsonb_build_object('success', true);
END;
$function$;

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

    IF NOT FOUND THEN RAISE EXCEPTION 'Seller wallet not found'; END IF;

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
