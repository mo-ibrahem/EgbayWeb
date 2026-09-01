-- 20260901194443_revoke_direct_checkout_with_wallet.sql
--
-- checkout_with_wallet(uuid, uuid) is SECURITY DEFINER and had EXECUTE
-- granted to `authenticated`, meaning any logged-in user could call it
-- directly via /rest/v1/rpc/checkout_with_wallet with an arbitrary
-- p_order_id. The function does check p_user_id = orders.buyer_id, but a
-- malicious seller can already see buyer_id on their own orders (via the
-- orders RLS policy), letting them force a non-consensual wallet
-- checkout for a buyer's own pending_payment order at a moment the buyer
-- never chose to pay -- debiting the buyer's wallet without consent.
--
-- Confirmed via repo-wide grep before this migration: the application
-- never calls checkout_with_wallet with a user-scoped (anon-key) client
-- -- both call sites (/api/orders "pay_with_wallet" action and
-- /api/wallet/action "deduct_spendable" action) use the service-role
-- client exclusively, after their own auth + ownership checks. Revoking
-- `authenticated` EXECUTE does not affect either path.

REVOKE EXECUTE ON FUNCTION public.checkout_with_wallet(uuid, uuid) FROM authenticated;
