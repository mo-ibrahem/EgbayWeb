-- Chat rooms were keyed only by participant pair, merging every
-- conversation between a buyer and seller into one thread regardless of
-- which item it was about. Scope conversations to the item instead --
-- messaging a seller about a PS5 and messaging them later about a
-- phone should not land in the same thread. product_id is nullable so
-- the handful of rooms created before this column existed remain as
-- general/legacy threads rather than being guessed at.
ALTER TABLE public.chat_rooms
  ADD COLUMN product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_rooms_product_id ON public.chat_rooms (product_id);

-- Supports the participant-pair .contains() lookup pattern used by
-- getOrCreateChatRoom(); previously unindexed.
CREATE INDEX IF NOT EXISTS idx_chat_rooms_participant_ids ON public.chat_rooms USING gin (participant_ids);
