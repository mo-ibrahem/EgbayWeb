-- 20260901203511_restrict_seller_tier_self_assignment.sql
--
-- H4: sellers could self-assign their own tier, commission rate, and
-- "Verified Seller" badge. lib/walletService.ts's upgradeSellerTier ran:
--   UPDATE user_profiles SET tier = <anything>, tier_verified_at = now(),
--     is_verified_seller = <anything> WHERE id = auth.uid()
-- directly from the client. The RLS policy "Users can update their own
-- profile" (USING/WITH CHECK auth.uid() = id) only scopes which ROW can
-- be touched, not which COLUMNS -- and user_profiles has a table-level
-- UPDATE/INSERT grant to authenticated covering every column, so any
-- authenticated user could set their own tier to 3 (the cheapest
-- commission rate) and is_verified_seller to true with a single
-- PATCH /rest/v1/user_profiles?id=eq.<self> call, with or without the
-- app's UI.
--
-- Confirmed before this migration: no RPC writes tier/tier_verified_at/
-- is_verified_seller (grepped every function body in this schema) --
-- upgradeSellerTier's direct client update was the ONLY write path.
--
-- Fix: revoke UPDATE and INSERT entirely on user_profiles from
-- authenticated/anon, then re-grant both only for the columns a user
-- legitimately edits about themselves (name, avatar, contact info, and
-- the KYC evidence fields -- which are evidence submitted FOR review,
-- not the review outcome itself). tier, tier_verified_at and
-- is_verified_seller are deliberately excluded from both allowlists,
-- for both roles. service_role (used by /api/* routes and any future
-- admin/ops tooling) is untouched and retains full access -- this is
-- what "database authoritative" means here: only a service-role-driven
-- path (there isn't an automated one yet, by design -- see the app-level
-- change accompanying this migration) can ever change these three
-- columns going forward.
--
-- Naive column-level REVOKEs were tried and found ineffective for this
-- exact reason once before in this project (see
-- 20260901194228_restrict_orders_pin_columns.sql) -- a pre-existing
-- table-level GRANT silently overrides a column-level REVOKE. This
-- migration uses the REVOKE-all-then-GRANT-allowlist form throughout.

REVOKE UPDATE, INSERT ON public.user_profiles FROM authenticated, anon;

GRANT INSERT (
  id, full_name, avatar_url, phone, address, email,
  national_id_number, national_id_front_url, national_id_back_url,
  created_at, updated_at
) ON public.user_profiles TO authenticated;

GRANT UPDATE (
  full_name, avatar_url, phone, address,
  national_id_number, national_id_front_url, national_id_back_url,
  updated_at
) ON public.user_profiles TO authenticated;
