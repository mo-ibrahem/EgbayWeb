-- 20260902070500_harden_orders_payouts_live_products_grants.sql
--
-- Continuation of the "broad grant + RLS-as-only-safety-net" audit that
-- found the user_wallets/wallet_transactions gap. Same method: verified
-- with real client code (grep) that nothing legitimately writes through
-- these paths, verified live that the attacks are currently blocked only
-- by RLS defaulting to deny when no policy matches a command, then
-- revoked the unused grant so the block no longer depends on that single
-- layer alone.
--
-- orders / order_events: buyer_id/seller_id-scoped SELECT policies exist
-- (orders: "Users can view own orders"; order_events: "Buyers and
-- Sellers can view their order events"), but neither table has any
-- INSERT/UPDATE/DELETE policy at all. Every real order mutation already
-- goes through SECURITY DEFINER RPCs (create_marketplace_order,
-- checkout_with_wallet, release_escrow, admin_resolve_dispute) or the
-- service-role /api/orders routes -- grep confirms zero client-side
-- writes to either table anywhere in the app.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.orders FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.order_events FROM anon, authenticated;

-- payout_methods: INSERT and DELETE both have real, matching, own-row
-- policies (addPayoutMethod / a delete flow), left untouched. UPDATE has
-- no policy at all and grep confirms no client code ever updates a
-- payout method (there's no "edit" or "set default" flow) -- if that
-- lands later it needs its own deliberately-scoped policy, not this
-- leftover blanket grant.
REVOKE UPDATE ON public.payout_methods FROM anon, authenticated;

-- live_chat_messages: INSERT (own messages, sendChatMessage) and SELECT
-- both have real matching policies. UPDATE/DELETE have no policy and
-- grep confirms the app never edits or deletes a chat message (only
-- inserts and reads them).
REVOKE UPDATE, DELETE ON public.live_chat_messages FROM anon, authenticated;

-- products: is_promoted/promoted_until/promotion_tier are already
-- guarded independently by the trg_prevent_promotion_tampering trigger
-- (checked live -- it blocks non-service_role changes to exactly those
-- three columns). promoted_ad_rate and is_promoted_on_sale were not
-- covered by that trigger, so a seller could set them directly via their
-- own-row UPDATE policy. Neither column is read anywhere in the app
-- today (grep confirms), so this had no live exploitable effect, but
-- it's the same class of gap and cheap to close by extending the
-- existing, already-proven guard rather than adding a second mechanism.
CREATE OR REPLACE FUNCTION public.check_product_promotion_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_role TEXT;
BEGIN
    BEGIN
        v_role := current_setting('request.jwt.claims', true)::jsonb->>'role';
    EXCEPTION WHEN OTHERS THEN
        v_role := current_user;
    END;

    IF v_role NOT IN ('service_role', 'postgres') AND (
        NEW.is_promoted IS DISTINCT FROM OLD.is_promoted OR
        NEW.promoted_until IS DISTINCT FROM OLD.promoted_until OR
        NEW.promotion_tier IS DISTINCT FROM OLD.promotion_tier OR
        NEW.promoted_ad_rate IS DISTINCT FROM OLD.promoted_ad_rate OR
        NEW.is_promoted_on_sale IS DISTINCT FROM OLD.is_promoted_on_sale
    ) THEN
        RAISE EXCEPTION 'Only system administrators can modify promotion status (Role: %)', v_role;
    END IF;

    RETURN NEW;
END;
$function$;
