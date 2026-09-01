-- 20260901000001_add_encrypted_pin.sql
ALTER TABLE public.orders
ADD COLUMN handover_pin_encrypted TEXT;
