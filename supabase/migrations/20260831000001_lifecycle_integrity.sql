-- 20260831000001_lifecycle_integrity.sql
-- Enforce Full Order Lifecycle Constraints and fix legacy NULL values

BEGIN;

-- 1. Enable pgcrypto if not already enabled (needed for bcrypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Backfill legacy orders missing handover_method
UPDATE public.orders
SET handover_method = 'courier'
WHERE handover_method IS NULL;

-- 3. Backfill legacy orders missing handover_pin_hash
-- We generate a random 6-digit PIN string and hash it using bcrypt (bf)
UPDATE public.orders
SET handover_pin_hash = crypt(
    (floor(random() * 900000 + 100000))::text, 
    gen_salt('bf', 10)
)
WHERE handover_pin_hash IS NULL;

-- 4. Enforce NOT NULL constraints on orders
ALTER TABLE public.orders 
ALTER COLUMN handover_method SET NOT NULL;

ALTER TABLE public.orders 
ALTER COLUMN handover_pin_hash SET NOT NULL;

-- 5. Enforce Foreign Key for wallet_transactions.order_fk
-- First, ensure there are no orphaned transactions (or set to NULL if orphaned)
UPDATE public.wallet_transactions
SET order_fk = NULL
WHERE order_fk IS NOT NULL 
AND order_fk NOT IN (SELECT id FROM public.orders);

-- Drop existing constraint if it exists (to prevent errors)
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_order_fk_fkey;

ALTER TABLE public.wallet_transactions
ADD CONSTRAINT wallet_transactions_order_fk_fkey
FOREIGN KEY (order_fk) REFERENCES public.orders(id) ON DELETE SET NULL;

-- 6. Enforce UNIQUE constraint on paymob_transaction_id across all relevant tables
ALTER TABLE public.wallet_topups DROP CONSTRAINT IF EXISTS wallet_topups_paymob_transaction_id_key;
ALTER TABLE public.wallet_topups ADD CONSTRAINT wallet_topups_paymob_transaction_id_key UNIQUE (paymob_transaction_id);

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_paymob_transaction_id_key;
ALTER TABLE public.orders ADD CONSTRAINT orders_paymob_transaction_id_key UNIQUE (paymob_transaction_id);

COMMIT;
