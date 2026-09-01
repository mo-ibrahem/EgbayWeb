-- 20260901194615_orders_status_check.sql
--
-- orders.status has no CHECK constraint (any string is writable) and its
-- column default is 'pending' -- a ninth value outside the application's
-- eight-state model (pending_payment, escrow_secured, shipped,
-- out_for_delivery, delivered, completed, disputed, cancelled) that no
-- code path ever intentionally sets. Verified all four distinct status
-- values present in production today (completed, escrow_secured,
-- cancelled, out_for_delivery) are within the intended set, so this
-- constraint does not conflict with any existing row.

ALTER TABLE public.orders
  ALTER COLUMN status SET DEFAULT 'pending_payment';

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending_payment', 'escrow_secured', 'shipped', 'out_for_delivery',
    'delivered', 'completed', 'disputed', 'cancelled'
  ));
