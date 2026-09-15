-- A curated catalogue of product models, so a listing for a standardised
-- item can show what the model looks like without every seller having to
-- photograph a sealed box.
--
-- The honesty rule is the constraint at the bottom: a listing may lean on
-- catalogue photos only when it is New. A used item's condition is the
-- thing the buyer is actually judging, so a used listing must carry
-- photographs of the actual unit -- a catalogue render would be exactly
-- the misleading case this is meant to avoid.

CREATE TABLE public.product_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text NOT NULL,
  category text NOT NULL,
  -- Colours/finishes this model ships in; a listing picks one.
  variants text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand, name)
);

CREATE TABLE public.product_model_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.product_models(id) ON DELETE CASCADE,
  -- null = applies to the model regardless of colour
  variant text,
  url text NOT NULL,
  -- Where it came from and under what terms. Every catalogue photo is
  -- credited on the listing that uses it; that is the licence condition
  -- for the CC-BY/BY-SA images this is bootstrapped from.
  credit text NOT NULL,
  license text NOT NULL,
  source_url text,
  position smallint NOT NULL DEFAULT 0
);

CREATE INDEX product_model_photos_model_idx ON public.product_model_photos (model_id, variant, position);

ALTER TABLE public.product_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_model_photos ENABLE ROW LEVEL SECURITY;

-- Anyone may read the catalogue; nobody writes to it from a client. It is
-- curated through the service role, so it cannot become a dumping ground.
CREATE POLICY "Catalogue is public" ON public.product_models
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Catalogue photos are public" ON public.product_model_photos
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.product_models TO anon, authenticated;
GRANT SELECT ON public.product_model_photos TO anon, authenticated;

ALTER TABLE public.products
  ADD COLUMN model_id uuid REFERENCES public.product_models(id) ON DELETE SET NULL,
  ADD COLUMN variant text;

-- Either the listing carries its own photographs, or it is a New item
-- backed by a catalogue model. A used listing can never fall back.
--
-- NOT VALID: one legacy fixture row ('Test Product',
-- 00000000-0000-0000-0000-000000000001) has no images and cannot be
-- deleted -- an order and a payment reference it, and that is transaction
-- history, not clutter. The constraint is enforced on every insert and
-- update from here on; only that single grandfathered row is exempt. Run
-- VALIDATE CONSTRAINT once it is gone.
ALTER TABLE public.products
  ADD CONSTRAINT products_photos_or_model_check CHECK (
    coalesce(array_length(images, 1), 0) > 0
    OR (model_id IS NOT NULL AND condition = 'New')
  ) NOT VALID;
