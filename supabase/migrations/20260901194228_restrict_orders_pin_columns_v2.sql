REVOKE SELECT ON public.orders FROM authenticated, anon;

GRANT SELECT (
  id, payment_id, product_id, buyer_id, seller_id, status,
  shipping_address, tracking_number, notes, created_at, updated_at,
  shipped_at, delivered_at, paymob_transaction_id, amount,
  product_snapshot, handover_method
) ON public.orders TO authenticated, anon;
;
