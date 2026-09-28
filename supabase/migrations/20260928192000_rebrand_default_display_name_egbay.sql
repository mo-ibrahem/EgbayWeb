-- Rebrand: the database's own fallback display name still said "EgyBay User",
-- matching neither the mobile rebrand nor the web one. It appears in three
-- places, each only as that literal: the signup trigger's default name, the
-- chat notification's fallback sender name, and public_profiles' mask for a
-- name that is an email address. No stored row holds the old default, so no
-- data changes. Replacing the literal in the live definitions keeps every
-- other line -- and every grant -- exactly as deployed.
DO $$
BEGIN
  EXECUTE replace(pg_get_functiondef('public.create_user_profile()'::regprocedure), 'EgyBay User', 'Egbay User');
  EXECUTE replace(pg_get_functiondef('public.notify_on_new_message()'::regprocedure), 'EgyBay User', 'Egbay User');
  EXECUTE 'CREATE OR REPLACE VIEW public.public_profiles AS '
       || replace(pg_get_viewdef('public.public_profiles'::regclass), 'EgyBay User', 'Egbay User');
END $$;
