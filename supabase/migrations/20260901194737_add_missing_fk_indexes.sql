-- 20260901194737_add_missing_fk_indexes.sql
--
-- Adds covering indexes for every foreign key flagged by the Supabase
-- performance advisor as unindexed. Purely additive; no data or access
-- control changes. At current row counts (dozens of rows per table)
-- this has no practical effect, but these are exactly the columns used
-- in join/filter conditions throughout the app (order_fk lookups in
-- release_escrow, wallet_id lookups on every wallet read, sender/room
-- lookups for chat) and the FK relationships them being unindexed is a
-- correctness-adjacent footgun waiting for real traffic volume.

CREATE INDEX IF NOT EXISTS idx_live_chat_messages_user_id ON public.live_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_live_pinned_products_product_id ON public.live_pinned_products(product_id);
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_id ON public.orders(payment_id);
CREATE INDEX IF NOT EXISTS idx_payout_methods_user_id ON public.payout_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_payout_method_id ON public.payout_requests(payout_method_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_wallet_id ON public.payout_requests(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_topups_user_id ON public.wallet_topups(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_order_fk ON public.wallet_transactions(order_fk);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_payout_fk ON public.wallet_transactions(payout_fk);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_topup_fk ON public.wallet_transactions(topup_fk);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON public.wallet_transactions(wallet_id);
