-- Fix ambiguous function overload for checkout_with_wallet
-- Drop the text version so only the UUID version remains

DROP FUNCTION IF EXISTS public.checkout_with_wallet(uuid, text);
DROP FUNCTION IF EXISTS public.checkout_with_wallet(uuid, uuid); -- Drop the simplified one if it exists

-- Ensure the remaining UUID version is up-to-date and secure with FULL LEDGER LOGIC
CREATE OR REPLACE FUNCTION public.checkout_with_wallet(
    p_user_id UUID,
    p_order_id UUID
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
    WHERE id = p_order_id;

    INSERT INTO public.order_events (order_id, event_type, created_at)
    VALUES (p_order_id, 'payment_completed', NOW());
    
    INSERT INTO public.order_events (order_id, event_type, created_at)
    VALUES (p_order_id, 'escrow_secured', NOW());

    -- Atomic double-entry logging
    INSERT INTO public.wallet_transactions (
        wallet_id, order_id, type, amount, status, description, delta_available, delta_pending, order_fk
    ) VALUES (
        v_wallet_id, p_order_id::text, 'purchase', v_amount, 'completed', 'Order Payment', -v_amount, 0, p_order_id
    );

    INSERT INTO public.wallet_transactions (
        wallet_id, order_id, type, amount, status, description, delta_available, delta_pending, fee_amount, order_fk
    ) VALUES (
        v_seller_wallet_id, p_order_id::text, 'escrow_hold', v_net_escrow, 'completed', 'Escrow Hold for Order', 0, v_net_escrow, v_total_deductions, p_order_id
    );

    RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.checkout_with_wallet(UUID, UUID) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.checkout_with_wallet(UUID, UUID) TO authenticated, service_role;

COMMIT;
