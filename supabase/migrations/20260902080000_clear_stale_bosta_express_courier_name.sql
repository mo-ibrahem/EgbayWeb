-- 20260902080000_clear_stale_bosta_express_courier_name.sql
--
-- create_marketplace_order used to hardcode courier_name: 'Bosta Express'
-- into every courier order's notes -- a false claim of a courier
-- partnership Egbay does not have, already fixed at the RPC level in
-- migration 20260901234137_live_commerce_real_checkout (new orders get
-- courier_name: null). That fix was not retroactive: 16 existing orders
-- created before it still carry the fabricated string in their stored
-- notes and display "Courier: Bosta Express" on the order detail page
-- right now.
--
-- This is a display-string correction, not a financial one -- notes.
-- amount (and every other field) is left untouched; only the
-- courier_name key is cleared to null, matching what new orders already
-- get. No balances, ledger rows, or order status are touched.
UPDATE orders
SET notes = jsonb_set(notes::jsonb, '{courier_name}', 'null'::jsonb)::text
WHERE notes::jsonb->>'courier_name' = 'Bosta Express';
