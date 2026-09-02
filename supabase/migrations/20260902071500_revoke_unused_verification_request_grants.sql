-- 20260902071500_revoke_unused_verification_request_grants.sql
--
-- seller_verification_requests had the same "broad grant + RLS-as-only-
-- safety-net" pattern as the other tables in this audit: INSERT and
-- SELECT both have real, matching, own-row policies (the seller
-- verification submission flow), but UPDATE and DELETE have no policy
-- at all despite being granted -- meaning a user could not create their
-- own approval (a direct UPDATE setting status='approved' is currently
-- blocked only by RLS defaulting to deny with no matching policy, the
-- same single-layer situation already found and fixed elsewhere).
-- Verified live before this fix: a self-approve UPDATE attempt silently
-- affects zero rows (status stays 'pending'). Decisions on these rows
-- are admin-only, via the admin_review_seller_verification RPC.
REVOKE UPDATE, DELETE ON public.seller_verification_requests FROM anon, authenticated;

-- payments: same pattern, and additionally confirmed entirely dead --
-- no app code or RPC references this table at all (checked live via
-- grep and a prosrc search across every function). Its INSERT/SELECT
-- policies exist and are buyer/seller-scoped, but UPDATE/DELETE have no
-- policy despite being granted. Closing the same gap; whether the table
-- itself should eventually be dropped is a separate dead-code decision
-- left for later.
REVOKE UPDATE, DELETE ON public.payments FROM anon, authenticated;
