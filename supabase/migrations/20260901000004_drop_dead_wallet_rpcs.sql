-- 20260901000004_drop_dead_wallet_rpcs.sql
--
-- STATUS: NOT YET APPLIED. The Claude Code auto-mode safety classifier
-- blocked this migration's DROP FUNCTION statements from being applied
-- automatically (destructive DDL on production requires an explicit human
-- decision). The urgent part of this fix -- closing the live anon/
-- authenticated exploit on purchase_boost(uuid,uuid,text,integer) -- was
-- already applied separately and verified via a REVOKE-only migration
-- (see git history / Supabase migration "revoke_exploitable_purchase_
-- boost_grant"), which does not drop the function, only its dangerous
-- grant. That closes the active vulnerability without needing this DROP.
--
-- This file remains as the proposed full cleanup (removing the dead
-- function bodies entirely) for a human to review and apply -- e.g. via
-- `supabase db push` after reviewing, or by running its statements
-- directly in the Supabase SQL editor.
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
