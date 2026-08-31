BEGIN;

-- Drop all ambiguous overloads
DROP FUNCTION IF EXISTS public.release_escrow(UUID, TEXT);
DROP FUNCTION IF EXISTS public.release_escrow(UUID, UUID);

-- Recreate with exact signature and internal UUID cast fixes
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
    v_handover_method TEXT;
    v_seller_wallet_id UUID;
    v_seller_pending_balance NUMERIC(12, 2);
    v_net_escrow NUMERIC(12, 2);
    v_order_uuid UUID;
BEGIN
    v_order_uuid := p_order_id::UUID;

    SELECT seller_id, buyer_id, status, handover_method
    INTO v_seller_id, v_buyer_id, v_status, v_handover_method
    FROM public.orders WHERE id = v_order_uuid FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

    -- Security hardening: Enforce the actor based on the handover_method
    IF v_handover_method = 'qr_meetup' THEN
        IF p_user_id != v_seller_id THEN 
            RAISE EXCEPTION 'Unauthorized: Only the seller can release escrow for meetup orders'; 
        END IF;
    ELSIF v_handover_method = 'courier' THEN
        IF p_user_id IN (v_buyer_id, v_seller_id) THEN 
            RAISE EXCEPTION 'Unauthorized: Buyers and sellers cannot manually release courier escrow. Only the courier can submit the PIN.'; 
        END IF;
    ELSE
        -- Fallback for any other/legacy methods
        IF p_user_id NOT IN (v_seller_id, v_buyer_id) THEN 
            RAISE EXCEPTION 'Unauthorized'; 
        END IF;
    END IF;
    
    IF v_status = 'completed' THEN RAISE EXCEPTION 'Order already completed and escrow released'; END IF;
    IF v_status NOT IN ('escrow_secured', 'shipped', 'out_for_delivery') THEN 
        RAISE EXCEPTION 'Order is not in a valid state for escrow release (current state: %)', v_status; 
    END IF;

    SELECT id, pending_balance INTO v_seller_wallet_id, v_seller_pending_balance 
    FROM public.user_wallets WHERE user_id = v_seller_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Seller wallet not found'; END IF;

    -- Fetch the EXACT net escrow placed into pending_balance without LIMIT 1 (strictly expects unique)
    SELECT delta_pending INTO STRICT v_net_escrow
    FROM public.wallet_transactions
    WHERE order_fk = v_order_uuid AND type = 'escrow_hold' AND wallet_id = v_seller_wallet_id;
    
    IF v_seller_pending_balance < v_net_escrow THEN
        RAISE EXCEPTION 'Seller pending balance is less than required escrow release amount';
    END IF;

    UPDATE public.user_wallets
    SET pending_balance = pending_balance - v_net_escrow,
        available_balance = available_balance + v_net_escrow,
        updated_at = NOW()
    WHERE id = v_seller_wallet_id;

    UPDATE public.orders SET status = 'completed' WHERE id = v_order_uuid;

    INSERT INTO public.order_events (order_id, event_type, created_at)
    VALUES (v_order_uuid, 'escrow_released', NOW());

    INSERT INTO public.order_events (order_id, event_type, created_at)
    VALUES (v_order_uuid, 'completed', NOW());

    -- EXACT INSERT: escrow release
    INSERT INTO public.wallet_transactions (
        wallet_id, order_id, type, amount, status, description,
        delta_available, delta_pending, order_fk
    ) VALUES (
        v_seller_wallet_id, p_order_id, 'earning', v_net_escrow, 'completed', 'Escrow Released',
        v_net_escrow, -v_net_escrow, v_order_uuid
    );

    RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.release_escrow(UUID, TEXT) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.release_escrow(UUID, TEXT) TO service_role;

COMMIT;
