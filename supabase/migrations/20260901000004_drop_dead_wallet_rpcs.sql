-- 20260901000004_drop_dead_wallet_rpcs.sql
--
-- STATUS: PARTIALLY APPLIED, superseded for 2 of its original 5
-- statements -- see below. The Claude Code auto-mode safety classifier
-- initially blocked bulk DROP FUNCTION cleanup here (destructive DDL on
-- production requires an explicit human decision for broad, speculative
-- cleanup). Since then:
--   - purchase_boost(uuid,uuid,text,integer): the exploitable grant was
--     closed via a REVOKE-only migration (see "revoke_exploitable_
--     purchase_boost_grant"). Not dropped from the schema, just made
--     unreachable by anon/authenticated.
--   - request_wallet_payout(uuid,numeric,text): this one turned out to
--     be an ACTIVE PRODUCTION BUG (a genuine PostgREST overload
--     ambiguity breaking every real payout withdrawal, confirmed live
--     against the real REST API), not just speculative cleanup -- it WAS
--     dropped, in its own narrowly-scoped, clearly-justified migration
--     ("drop_ambiguous_legacy_request_wallet_payout"), which the
--     classifier approved given the specific, demonstrated harm. Its
--     line below is a no-op (IF EXISTS) if this file is ever replayed.
--
-- The remaining 3 statements (release_escrow 3-arg, pay_order_with_wallet,
-- deduct_wallet_balance) are dead but not actively harmful -- no
-- anon/authenticated grant, no confirmed production bug -- and remain
-- proposed cleanup pending human review/apply.
--
-- Removes legacy/superseded RPC overloads confirmed to have zero callers
-- anywhere in the application (verified via repo-wide grep against every
-- .rpc('...') call site before writing this migration).
--
-- purchase_boost(uuid, uuid, text, integer) is the critical one: it is
-- SECURITY DEFINER, has EXECUTE granted to anon AND authenticated, and
-- trusts its p_user_id argument with no auth.uid() check at all -- any
-- unauthenticated caller with the public anon key can drain any wallet to
-- zero by passing a victim's user id (e.g. p_user_id=<victim>,
-- p_tier='tier_3', p_days=200 debits their available_balance with no
-- corresponding credit anywhere, since the product update is scoped to
-- seller_id = p_user_id and no-ops for a mismatched product). The 3-arg
-- purchase_boost(uuid, uuid, text) is the canonical, correctly-scoped
-- version already called by /api/boost/route.ts (server-role only,
-- ownership-checked before the RPC call).
--
-- The other four are dead but not directly internet-exploitable (no
-- anon/authenticated grant) -- removed for the same reason as any other
-- confirmed-dead code: they are a maintenance and correctness hazard
-- (e.g. release_escrow(uuid,text,text) compares against
-- notes->>'meetup_pin', a field no order in production still carries;
-- deduct_wallet_balance and pay_order_with_wallet duplicate
-- checkout_with_wallet's job with different, inconsistent fee math; the
-- request_wallet_payout(uuid,numeric,text) overload creates avoidable
-- PostgREST overload-resolution ambiguity against the canonical
-- (uuid,numeric,uuid) version).

DROP FUNCTION IF EXISTS public.purchase_boost(uuid, uuid, text, integer);
DROP FUNCTION IF EXISTS public.release_escrow(uuid, text, text);
DROP FUNCTION IF EXISTS public.request_wallet_payout(uuid, numeric, text);
DROP FUNCTION IF EXISTS public.pay_order_with_wallet(uuid, text);
DROP FUNCTION IF EXISTS public.deduct_wallet_balance(uuid, numeric, text, text);
