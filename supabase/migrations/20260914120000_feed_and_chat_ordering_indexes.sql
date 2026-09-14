-- Ordering indexes for the two hottest mobile queries.
--
-- products: the home feed and the products list read
--   WHERE status = 'active' ORDER BY created_at DESC
-- and products(status) alone leaves the sort to a heap scan once most rows
-- are active. messages: the inbox preview and the thread read
--   WHERE room_id = $1 ORDER BY created_at DESC
-- and messages(room_id) alone sorts every row of a long conversation.
-- Both are IF NOT EXISTS so the file is safe to re-run; tables are small
-- today, so plain (non-CONCURRENT) creation is fine inside the transaction.
CREATE INDEX IF NOT EXISTS products_status_created_at_idx
  ON public.products (status, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_room_id_created_at_idx
  ON public.messages (room_id, created_at DESC);
