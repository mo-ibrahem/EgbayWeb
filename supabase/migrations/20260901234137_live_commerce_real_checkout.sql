-- 20260901234137_live_commerce_real_checkout.sql
--
-- Live commerce redesign, part 1: extend create_marketplace_order so an
-- in-stream purchase can (a) honor a seller's live-only display_price on
-- an actively pinned product, never exceeding the real listed price, and
-- (b) atomically update the live session's sales counters. Also drops the
-- fabricated 'Bosta Express' courier_name (Egbay has no such partnership;
-- the app layer's Bosta references were already removed, this DB default
-- was missed).
DROP FUNCTION IF EXISTS public.create_marketplace_order(uuid, uuid, text, text, text, jsonb);

CREATE FUNCTION public.create_marketplace_order(
  p_product_id uuid,
  p_buyer_id uuid,
  p_handover_method text,
  p_handover_pin_hash text,
  p_handover_pin_encrypted text,
  p_shipping_address jsonb,
  p_live_session_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_seller_id UUID;
    v_price NUMERIC;
    v_hardened_price NUMERIC;
    v_title TEXT;
    v_images TEXT[];
    v_condition TEXT;
    v_category TEXT;
    v_order_id UUID;
    v_product_snapshot JSONB;
    v_handover_method TEXT;
    v_live_display_price NUMERIC;
BEGIN
    v_handover_method := COALESCE(p_handover_method, 'courier');

    IF v_handover_method NOT IN ('courier', 'qr_meetup') THEN
        RAISE EXCEPTION 'Unsupported handover method';
    END IF;

    IF p_handover_pin_hash IS NULL OR p_handover_pin_encrypted IS NULL THEN
        RAISE EXCEPTION 'Secure handover PIN data is required';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.orders
        WHERE buyer_id = p_buyer_id
          AND product_id = p_product_id
          AND status = 'pending_payment'
          AND created_at > NOW() - INTERVAL '5 minutes'
    ) THEN
        RAISE EXCEPTION 'You already have a pending order for this item.';
    END IF;

    UPDATE public.products
    SET stock = stock - 1, updated_at = NOW()
    WHERE id = p_product_id AND stock >= 1 AND status = 'active'
    RETURNING seller_id, price, title, images, condition, category
    INTO v_seller_id, v_price, v_title, v_images, v_condition, v_category;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product is out of stock, unavailable, or does not exist.';
    END IF;

    v_hardened_price := COALESCE(v_price, 0);

    IF p_live_session_id IS NOT NULL THEN
        SELECT display_price INTO v_live_display_price
        FROM public.live_pinned_products
        WHERE session_id = p_live_session_id
          AND product_id = p_product_id
          AND unpinned_at IS NULL
        LIMIT 1;

        IF v_live_display_price IS NOT NULL THEN
            v_hardened_price := LEAST(v_hardened_price, v_live_display_price);
        END IF;
    END IF;

    IF v_handover_method = 'courier' THEN
        v_hardened_price := v_hardened_price + 65;
    END IF;

    v_product_snapshot := jsonb_build_object(
        'id', p_product_id,
        'title', v_title,
        'price', v_hardened_price,
        'images', COALESCE(v_images, ARRAY[]::TEXT[]),
        'condition', COALESCE(v_condition, 'Used'),
        'category', COALESCE(v_category, 'General')
    );

    INSERT INTO public.orders (
        product_id, buyer_id, seller_id, status, amount, product_snapshot,
        handover_method, handover_pin_hash, handover_pin_encrypted, notes,
        shipping_address, created_at
    )
    VALUES (
        p_product_id, p_buyer_id, v_seller_id, 'pending_payment', v_hardened_price,
        v_product_snapshot, v_handover_method, p_handover_pin_hash, p_handover_pin_encrypted,
        jsonb_build_object(
            'amount', v_hardened_price,
            'live_session_id', p_live_session_id,
            'courier_name', NULL
        ),
        p_shipping_address, NOW()
    )
    RETURNING id INTO v_order_id;

    INSERT INTO public.order_events (order_id, event_type, payload)
    VALUES (v_order_id, 'order_placed', jsonb_build_object('amount', v_hardened_price));

    IF p_live_session_id IS NOT NULL THEN
        UPDATE public.live_sessions
        SET total_sales_egp = COALESCE(total_sales_egp, 0) + v_hardened_price::integer
        WHERE id = p_live_session_id;

        UPDATE public.live_pinned_products
        SET units_sold = COALESCE(units_sold, 0) + 1
        WHERE session_id = p_live_session_id
          AND product_id = p_product_id
          AND unpinned_at IS NULL;
    END IF;

    RETURN v_order_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_marketplace_order(uuid, uuid, text, text, text, jsonb, uuid) TO service_role;

-- Live commerce redesign, part 2: atomic seller-pays-platform live pass
-- fee + session creation. Previously the client deducted the wallet fee
-- via deductWalletSpendableFunds() with a fake order id
-- (live_pass_<timestamp>) passed as p_order_id into checkout_with_wallet,
-- which requires a real orders.id and always failed with a uuid cast
-- error -- live session booking was guaranteed to fail. Worse, the
-- session row itself was insertable directly by any authenticated client
-- (RLS only checked seller_id = auth.uid(), with no relationship at all
-- to payment), so a client could bypass the JS wallet check entirely and
-- insert a free session. This RPC makes charge + creation one atomic,
-- server-authoritative operation, and the REVOKE below closes the direct
-- insert path.
CREATE OR REPLACE FUNCTION public.book_live_session(
  p_seller_id uuid,
  p_title text,
  p_title_ar text,
  p_description text,
  p_tier text,
  p_category text,
  p_scheduled_at timestamptz,
  p_thumbnail_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_price NUMERIC;
    v_max_viewers INTEGER;
    v_wallet_id UUID;
    v_available NUMERIC;
    v_tx_id UUID;
    v_channel TEXT;
    v_session RECORD;
BEGIN
    IF p_tier = 'flash' THEN v_price := 79; v_max_viewers := 30;
    ELSIF p_tier = 'pro' THEN v_price := 149; v_max_viewers := 100;
    ELSIF p_tier = 'mega' THEN v_price := 299; v_max_viewers := 300;
    ELSE RAISE EXCEPTION 'Invalid live pass tier';
    END IF;

    IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
        RAISE EXCEPTION 'Title is required';
    END IF;

    SELECT id, available_balance INTO v_wallet_id, v_available
    FROM public.user_wallets WHERE user_id = p_seller_id FOR UPDATE;

    IF NOT FOUND OR v_available < v_price THEN
        RAISE EXCEPTION 'Insufficient wallet balance. Required: % EGP', v_price;
    END IF;

    UPDATE public.user_wallets
    SET available_balance = available_balance - v_price, updated_at = NOW()
    WHERE id = v_wallet_id;

    INSERT INTO public.wallet_transactions (
        wallet_id, type, amount, status, description, delta_available, delta_pending, reference_id_text
    ) VALUES (
        v_wallet_id, 'live_pass', v_price, 'completed',
        'Live Pass Fee (' || p_tier || ')', -v_price, 0, NULL
    ) RETURNING id INTO v_tx_id;

    v_channel := 'egbay_live_' || extract(epoch from now())::bigint || '_' || substr(p_seller_id::text, 1, 8);

    INSERT INTO public.live_sessions (
        seller_id, title, title_ar, description, pass_tier, pass_price_egp,
        max_viewers, agora_channel, status, scheduled_at, category, thumbnail_url,
        wallet_charge_id
    ) VALUES (
        p_seller_id, p_title, p_title_ar, p_description, p_tier, v_price,
        v_max_viewers, v_channel, 'scheduled', p_scheduled_at, p_category, p_thumbnail_url,
        v_tx_id
    ) RETURNING * INTO v_session;

    UPDATE public.wallet_transactions SET reference_id_text = v_session.id::text WHERE id = v_tx_id;

    RETURN to_jsonb(v_session);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.book_live_session(uuid, text, text, text, text, text, timestamptz, text) TO service_role;

-- Live commerce redesign, part 3: close the direct-insert bypass. Session
-- creation (and its payment) now only happens through book_live_session,
-- which runs as postgres (owner) and does not need this grant itself.
REVOKE INSERT ON public.live_sessions FROM authenticated, anon;
