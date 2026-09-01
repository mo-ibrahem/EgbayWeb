BEGIN;

-- 20260901000001_add_encrypted_pin.sql
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS handover_pin_encrypted TEXT;

-- Drop the old 5-argument signature to prevent overload ambiguity
DROP FUNCTION IF EXISTS public.create_marketplace_order(UUID, UUID, TEXT, TEXT, JSONB);

-- Create the single, canonical 6-argument signature
CREATE OR REPLACE FUNCTION public.create_marketplace_order(
  p_product_id UUID,
  p_buyer_id UUID,
  p_handover_method TEXT,
  p_handover_pin_hash TEXT,
  p_handover_pin_encrypted TEXT,
  p_shipping_address JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
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
BEGIN
  -- 1. Normalize handover method once
  v_handover_method := COALESCE(p_handover_method, 'courier');

  -- 2. Validate supported methods
  IF v_handover_method NOT IN ('courier', 'qr_meetup') THEN
    RAISE EXCEPTION 'Unsupported handover method';
  END IF;

  -- 3. Fail-closed validation for PIN
  IF p_handover_pin_hash IS NULL OR p_handover_pin_encrypted IS NULL THEN
    RAISE EXCEPTION 'Secure handover PIN data is required';
  END IF;

  -- Backend Idempotency: Prevent double-checkouts from the same buyer for the same product within 5 minutes
  IF EXISTS (
      SELECT 1 FROM public.orders 
      WHERE buyer_id = p_buyer_id 
      AND product_id = p_product_id 
      AND status = 'pending_payment' 
      AND created_at > NOW() - INTERVAL '5 minutes'
  ) THEN
      RAISE EXCEPTION 'You already have a pending order for this item.';
  END IF;

  -- Atomically reserve stock (Locks the row, ensures ACTIVE and STOCK >= 1)
  UPDATE public.products 
  SET stock = stock - 1, updated_at = NOW()
  WHERE id = p_product_id AND stock >= 1 AND status = 'active'
  RETURNING seller_id, price, title, images, condition, category 
  INTO v_seller_id, v_price, v_title, v_images, v_condition, v_category;

  -- If no row returned, stock was 0, product doesn't exist, or it is not active
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product is out of stock, unavailable, or does not exist.';
  END IF;

  -- Calculate pricing
  v_hardened_price := COALESCE(v_price, 0);
  IF v_handover_method = 'courier' THEN
    v_hardened_price := v_hardened_price + 65;
  END IF;

  -- Build snapshot
  v_product_snapshot := jsonb_build_object(
    'id', p_product_id,
    'title', v_title,
    'price', v_hardened_price,
    'images', COALESCE(v_images, ARRAY[]::TEXT[]),
    'condition', COALESCE(v_condition, 'Used'),
    'category', COALESCE(v_category, 'General')
  );

  -- Insert Order
  INSERT INTO public.orders (
    product_id, buyer_id, seller_id, status, amount, 
    product_snapshot, handover_method, handover_pin_hash, handover_pin_encrypted,
    notes, shipping_address, created_at
  ) VALUES (
    p_product_id, p_buyer_id, v_seller_id, 'pending_payment', v_hardened_price,
    v_product_snapshot, v_handover_method, p_handover_pin_hash, p_handover_pin_encrypted,
    jsonb_build_object('amount', v_hardened_price, 'courier_name', 'Bosta Express'),
    p_shipping_address, NOW()
  ) RETURNING id INTO v_order_id;

  -- Insert Event
  INSERT INTO public.order_events (order_id, event_type, payload)
  VALUES (v_order_id, 'order_placed', jsonb_build_object('amount', v_hardened_price));

  RETURN v_order_id;
END;
$$;

-- Secure the RPC: Revoke from all public/anon/authenticated access
REVOKE ALL ON FUNCTION public.create_marketplace_order(UUID, UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_marketplace_order(UUID, UUID, TEXT, TEXT, TEXT, JSONB) FROM authenticated;
REVOKE ALL ON FUNCTION public.create_marketplace_order(UUID, UUID, TEXT, TEXT, TEXT, JSONB) FROM anon;

-- Grant exclusively to service_role
GRANT EXECUTE ON FUNCTION public.create_marketplace_order(UUID, UUID, TEXT, TEXT, TEXT, JSONB) TO service_role;

COMMIT;
