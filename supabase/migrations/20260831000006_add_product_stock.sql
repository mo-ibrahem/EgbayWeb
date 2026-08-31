-- 1. Add Column & Constraints (SAFE INITIALIZATION TO 0)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_stock_check;
ALTER TABLE public.products ADD CONSTRAINT products_stock_check CHECK (stock >= 0);

-- 2. Migrate Legacy Data
UPDATE public.products
SET stock = COALESCE((SUBSTRING(description FROM '📦 Stock: ([0-9]+)')::INTEGER), 0)
WHERE description LIKE '%📦 Stock:%';

UPDATE public.products
SET description = REGEXP_REPLACE(description, '📦 Stock: [0-9]+\n?', '', 'g')
WHERE description LIKE '%📦 Stock:%';

-- 3. Unified Checkout RPC (Transaction Safe + Search Path + Idempotency)
CREATE OR REPLACE FUNCTION public.create_marketplace_order(
  p_product_id UUID,
  p_buyer_id UUID,
  p_handover_method TEXT,
  p_handover_pin_hash TEXT,
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
BEGIN
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
  IF p_handover_method = 'courier' THEN
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
    product_snapshot, handover_method, handover_pin_hash, 
    notes, shipping_address, created_at
  ) VALUES (
    p_product_id, p_buyer_id, v_seller_id, 'pending_payment', v_hardened_price,
    v_product_snapshot, COALESCE(p_handover_method, 'courier'), p_handover_pin_hash,
    jsonb_build_object('amount', v_hardened_price, 'courier_name', 'Bosta Express'),
    p_shipping_address, NOW()
  ) RETURNING id INTO v_order_id;

  -- Insert Event
  INSERT INTO public.order_events (order_id, event_type, payload)
  VALUES (v_order_id, 'order_placed', jsonb_build_object('amount', v_hardened_price));

  RETURN v_order_id;
END;
$$;

-- Secure the RPC
REVOKE ALL ON FUNCTION public.create_marketplace_order FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_marketplace_order TO service_role;

-- 4. Secure Restoration RPC (Transaction Safe + Search Path)
CREATE OR REPLACE FUNCTION public.cancel_and_restore_order(p_order_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_product_id UUID;
BEGIN
  -- Update order ONLY IF it is pending (prevents double restoration)
  UPDATE public.orders
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_order_id AND status = 'pending_payment'
  RETURNING product_id INTO v_product_id;

  IF FOUND THEN
    -- Restore stock safely
    UPDATE public.products 
    SET stock = stock + 1, updated_at = NOW()
    WHERE id = v_product_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_and_restore_order FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_and_restore_order TO service_role;

-- 5. Cron Job Logic (Idempotent + Search Path)
CREATE OR REPLACE FUNCTION public.cancel_abandoned_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT id FROM public.orders 
        WHERE status = 'pending_payment' 
        AND created_at < NOW() - INTERVAL '1 hour'
    LOOP
        PERFORM public.cancel_and_restore_order(r.id);
    END LOOP;
END;
$$;

-- Idempotent schedule creation
SELECT cron.unschedule('cancel_abandoned_orders_job');
SELECT cron.schedule('cancel_abandoned_orders_job', '*/10 * * * *', 'SELECT public.cancel_abandoned_orders()');
