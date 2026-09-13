ALTER TABLE public.chat_rooms
  ADD COLUMN product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_rooms_product_id ON public.chat_rooms (product_id);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_participant_ids ON public.chat_rooms USING gin (participant_ids);;
