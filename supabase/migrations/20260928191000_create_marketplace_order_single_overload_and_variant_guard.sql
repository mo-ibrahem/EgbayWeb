-- Two bugs in order creation, both introduced when create_order_with_variant
-- (2026-09-16) added an 8-argument overload beside the original 7-argument one.
--
-- 1. Ambiguity. The 8-argument form defaults p_variant_id, so a call with the
--    original 7 named arguments matches both overloads and Postgres raises
--    42725 "function ... is not unique". That is exactly the call EgbayWeb's
--    /api/orders makes, so web order creation could not succeed. Dropping the
--    7-argument overload fixes it: the 8-argument form accepts every call shape
--    the old one did. Nothing else in the database calls it.
--
-- 2. Pricing. For a listing that has variants, products.price is only the
--    cheapest "from" price. The no-variant branch decremented products.stock and
--    charged that floor while recording no storage, colour or grade -- 73 of the
--    live listings were orderable that way. It now refuses and asks for an option.
--
-- Verified in a rolled-back transaction before applying: the 7-named-argument
-- call resolves; a pack listing without a variant is refused; a pack listing is
-- priced from its variant; a variant from another listing is refused; client
-- EXECUTE stays revoked (CREATE OR REPLACE preserves grants).

DROP FUNCTION IF EXISTS public.create_marketplace_order(uuid,uuid,text,text,text,jsonb,uuid);

CREATE OR REPLACE FUNCTION public.create_marketplace_order(p_product_id uuid, p_buyer_id uuid, p_handover_method text, p_handover_pin_hash text, p_handover_pin_encrypted text, p_shipping_address jsonb, p_live_session_id uuid DEFAULT NULL::uuid, p_variant_id uuid DEFAULT NULL::uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_seller_id UUID; v_price NUMERIC; v_hardened_price NUMERIC; v_title TEXT; v_images TEXT[];
    v_condition TEXT; v_category TEXT; v_order_id UUID; v_product_snapshot JSONB;
    v_handover_method TEXT; v_live_display_price NUMERIC; v_variant RECORD;
BEGIN
    v_handover_method := COALESCE(p_handover_method, 'courier');
    IF v_handover_method NOT IN ('courier', 'qr_meetup') THEN RAISE EXCEPTION 'Unsupported handover method'; END IF;
    IF p_handover_pin_hash IS NULL OR p_handover_pin_encrypted IS NULL THEN RAISE EXCEPTION 'Secure handover PIN data is required'; END IF;
    IF EXISTS (SELECT 1 FROM public.orders WHERE buyer_id = p_buyer_id AND product_id = p_product_id
               AND status = 'pending_payment' AND created_at > NOW() - INTERVAL '5 minutes') THEN
        RAISE EXCEPTION 'You already have a pending order for this item.';
    END IF;

    IF p_variant_id IS NOT NULL THEN
        UPDATE public.product_variants SET stock = stock - 1, updated_at = NOW()
        WHERE id = p_variant_id AND product_id = p_product_id AND stock >= 1
        RETURNING id, sku, storage, color, grade, price INTO v_variant;
        IF NOT FOUND THEN RAISE EXCEPTION 'That option is out of stock or does not belong to this listing.'; END IF;
        SELECT seller_id, title, images, condition, category INTO v_seller_id, v_title, v_images, v_condition, v_category
        FROM public.products WHERE id = p_product_id AND status = 'active';
        IF NOT FOUND THEN RAISE EXCEPTION 'Product is unavailable or does not exist.'; END IF;
        v_price := v_variant.price;
    ELSE
        -- A listing with variants has no single price or stock: products.price is
        -- only the cheapest "from" price. Ordering it without naming a variant would
        -- charge that floor and record no storage/colour/grade at all.
        IF EXISTS (SELECT 1 FROM public.product_variants WHERE product_id = p_product_id) THEN
            RAISE EXCEPTION 'Choose an option for this listing before ordering.';
        END IF;
        UPDATE public.products SET stock = stock - 1, updated_at = NOW()
        WHERE id = p_product_id AND stock >= 1 AND status = 'active'
        RETURNING seller_id, price, title, images, condition, category
        INTO v_seller_id, v_price, v_title, v_images, v_condition, v_category;
        IF NOT FOUND THEN RAISE EXCEPTION 'Product is out of stock, unavailable, or does not exist.'; END IF;
    END IF;

    v_hardened_price := COALESCE(v_price, 0);
    IF p_live_session_id IS NOT NULL THEN
        SELECT display_price INTO v_live_display_price FROM public.live_pinned_products
        WHERE session_id = p_live_session_id AND product_id = p_product_id AND unpinned_at IS NULL LIMIT 1;
        IF v_live_display_price IS NOT NULL THEN v_hardened_price := LEAST(v_hardened_price, v_live_display_price); END IF;
    END IF;
    IF v_handover_method = 'courier' THEN v_hardened_price := v_hardened_price + 65; END IF;

    v_product_snapshot := jsonb_build_object('id', p_product_id, 'title', v_title, 'price', v_hardened_price,
        'images', COALESCE(v_images, ARRAY[]::TEXT[]), 'condition', COALESCE(v_condition, 'Used'), 'category', COALESCE(v_category, 'General'));
    IF p_variant_id IS NOT NULL THEN
        v_product_snapshot := v_product_snapshot || jsonb_build_object('variant', jsonb_build_object(
            'id', v_variant.id, 'sku', v_variant.sku, 'storage', v_variant.storage,
            'color', v_variant.color, 'grade', v_variant.grade, 'price', v_variant.price));
    END IF;

    INSERT INTO public.orders (product_id, variant_id, buyer_id, seller_id, status, amount, product_snapshot,
        handover_method, handover_pin_hash, handover_pin_encrypted, notes, shipping_address, created_at)
    VALUES (p_product_id, p_variant_id, p_buyer_id, v_seller_id, 'pending_payment', v_hardened_price,
        v_product_snapshot, v_handover_method, p_handover_pin_hash, p_handover_pin_encrypted,
        jsonb_build_object('amount', v_hardened_price, 'live_session_id', p_live_session_id, 'courier_name', NULL),
        p_shipping_address, NOW())
    RETURNING id INTO v_order_id;

    INSERT INTO public.order_events (order_id, event_type, payload)
    VALUES (v_order_id, 'order_placed', jsonb_build_object('amount', v_hardened_price));

    IF p_live_session_id IS NOT NULL THEN
        UPDATE public.live_sessions SET total_sales_egp = COALESCE(total_sales_egp, 0) + v_hardened_price::integer WHERE id = p_live_session_id;
        UPDATE public.live_pinned_products SET units_sold = COALESCE(units_sold, 0) + 1
        WHERE session_id = p_live_session_id AND product_id = p_product_id AND unpinned_at IS NULL;
    END IF;
    RETURN v_order_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_marketplace_order(uuid,uuid,text,text,text,jsonb,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_marketplace_order(uuid,uuid,text,text,text,jsonb,uuid,uuid) TO service_role;
