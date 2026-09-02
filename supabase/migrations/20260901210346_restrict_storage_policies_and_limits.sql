-- 20260901210346_restrict_storage_policies_and_limits.sql
--
-- storage.objects had two policies with no bucket scoping at all:
--   - "Allow authenticated users to upload images 16wiy3a_0" (INSERT,
--     with_check: true) -- any authenticated user could upload into ANY
--     bucket, not just product-images, including any bucket added later.
--   - "Allow public read access 16wiy3a_0" (SELECT, qual: true) -- same
--     issue for reads.
-- Neither storage.buckets row had a file_size_limit or
-- allowed_mime_types, so uploads of any type/size were accepted.
--
-- Confirmed via grepping every supabase.storage.from(...) call in the
-- app: the only bucket actually used for uploads is 'product-images'
-- (both real product photos AND the profile avatar uploader, which --
-- separately, not fixed here as it's a correctness issue rather than a
-- security one -- uploads into product-images instead of the dedicated
-- avatars bucket that already has its own correctly-scoped policies).
--
-- This narrows both broad policies to the buckets actually in use and
-- adds size/type limits matching real usage (JPEG/PNG/WebP/GIF/HEIC
-- photos, <=10MB).

DROP POLICY IF EXISTS "Allow authenticated users to upload images 16wiy3a_0" ON storage.objects;
CREATE POLICY "Authenticated users can upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Allow public read access 16wiy3a_0" ON storage.objects;
CREATE POLICY "Public can read product images and avatars"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id IN ('product-images', 'avatars'));

UPDATE storage.buckets
SET file_size_limit = 10485760, -- 10 MB
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
WHERE id IN ('product-images', 'avatars');
