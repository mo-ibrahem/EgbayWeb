-- 20260901213407_admin_capability_verification_disputes.sql
--
-- Before this migration, two core marketplace flows had no real
-- resolution path at all:
--   1. Seller tier/verification: H4 correctly closed self-assignment,
--      but nothing replaced it -- there was no record of a request, no
--      way for anyone to actually grant a tier, ever. Every seller was
--      permanently frozen at Tier 1.
--   2. Disputes: filing one froze the order (status='disputed') but
--      there was no refund mechanism and no way to resolve one in
--      either direction. A disputed order was a permanent dead end.
--
-- This migration adds the minimum real, secured, server-authoritative
-- infrastructure to make both flows actually resolvable: an is_admin
-- flag (service-role only, same protection pattern as tier), a proper
-- verification-request table, a private KYC document bucket, a new
-- terminal 'refunded' order status, and two admin-only RPCs.
--
-- Verified before writing: 0 disputed orders exist in production today,
-- so the new 'refunded' status and dispute-resolution RPC carry zero
-- historical-data risk.

-- ============================================================
-- 1. is_admin flag -- same protection as tier/is_verified_seller
-- ============================================================
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
-- Column-level grants on user_profiles are already an explicit allowlist
-- (see 20260901203511_restrict_seller_tier_self_assignment.sql) that
-- excludes tier/tier_verified_at/is_verified_seller from client
-- UPDATE/INSERT. is_admin is new and therefore already excluded by
-- default (the allowlist form means nothing is grantable unless
-- explicitly listed) -- no additional REVOKE needed, but confirmed
-- explicitly below for clarity and to guard against a future broad
-- re-grant silently including it.
REVOKE ALL (is_admin) ON public.user_profiles FROM authenticated, anon;

-- ============================================================
-- 2. Seller verification requests -- a real, reviewable record
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seller_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_tier SMALLINT NOT NULL CHECK (requested_tier IN (2, 3)),
  full_name TEXT NOT NULL,
  national_id_number TEXT NOT NULL,
  national_id_front_url TEXT NOT NULL,
  national_id_back_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seller_verification_requests_user_id ON public.seller_verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_verification_requests_status ON public.seller_verification_requests(status);

ALTER TABLE public.seller_verification_requests ENABLE ROW LEVEL SECURITY;

-- Users can submit and view their own requests, but never update them
-- (status changes are admin/service-role only, via the RPC below).
CREATE POLICY "Users can view own verification requests"
  ON public.seller_verification_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can submit own verification requests"
  ON public.seller_verification_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 3. Private KYC document storage -- national ID images must never be
--    in a public bucket. Existing buckets (product-images, avatars) are
--    both public=true; this is a dedicated private bucket.
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('kyc-documents', 'kyc-documents', false, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif'];

-- Standard per-user-folder pattern: object path must be "<uid>/...".
-- Users can upload/read their own documents; nothing is public.
CREATE POLICY "Users can upload own KYC documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read own KYC documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- 4. Order state machine: add a real terminal 'refunded' status.
--    Distinct from 'cancelled' (which means payment never happened /
--    stock was restored pre-payment) -- a refund means payment DID
--    happen, escrow WAS held, and it's being reversed after the fact
--    (typically post-dispute). Conflating the two would make the ledger
--    and order history misleading.
-- ============================================================
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending_payment', 'escrow_secured', 'shipped', 'out_for_delivery',
    'delivered', 'completed', 'disputed', 'cancelled', 'refunded'
  ));

-- ============================================================
-- 5. admin_review_seller_verification -- the ONLY path that can ever
--    change tier/tier_verified_at/is_verified_seller now that H4 closed
--    client self-assignment. Service-role only.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_review_seller_verification(
  p_admin_id UUID,
  p_request_id UUID,
  p_decision TEXT, -- 'approved' | 'rejected'
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_user_id UUID;
  v_tier SMALLINT;
  v_status TEXT;
BEGIN
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision: must be approved or rejected';
  END IF;

  SELECT is_admin INTO v_is_admin FROM public.user_profiles WHERE id = p_admin_id;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Unauthorized: caller is not an admin';
  END IF;

  SELECT user_id, requested_tier, status INTO v_user_id, v_tier, v_status
  FROM public.seller_verification_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Verification request not found'; END IF;
  IF v_status != 'pending' THEN RAISE EXCEPTION 'Request already reviewed (status: %)', v_status; END IF;

  UPDATE public.seller_verification_requests
  SET status = p_decision,
      reviewer_notes = p_notes,
      reviewed_by = p_admin_id,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_request_id;

  IF p_decision = 'approved' THEN
    UPDATE public.user_profiles
    SET tier = v_tier,
        tier_verified_at = NOW(),
        is_verified_seller = true,
        updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'decision', p_decision, 'user_id', v_user_id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_review_seller_verification(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_seller_verification(UUID, UUID, TEXT, TEXT) TO service_role;

-- ============================================================
-- 6. admin_resolve_dispute -- the ONLY refund path in the system.
--    Two resolutions:
--      refund_buyer: reverses the seller's escrow hold back to the
--        buyer's own wallet (available_balance). Does NOT restore
--        product stock (the item is presumably already shipped/with
--        the buyer -- a refund doesn't un-sell a physical item that's
--        out in the world). Does NOT touch Paymob -- this is an
--        internal wallet-ledger reversal, not a card refund; if the
--        buyer originally paid by card, their money comes back as
--        EgyBay wallet balance, not a reversed card charge. This is
--        deliberately the safer v1 (no external payment-gateway refund
--        API integration) and should be revisited when a real refund-
--        to-card flow is needed.
--      release_seller: dispute resolved in the seller's favor -- same
--        fund movement as the normal release_escrow path, but as an
--        admin override (bypasses the buyer/seller actor check that
--        normally gates release, since the order is stuck in 'disputed'
--        and neither party can call release_escrow themselves).
--    Service-role only, invoked exclusively via a protected admin API
--    route -- there is no client-callable grant.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(
  p_admin_id UUID,
  p_order_id UUID,
  p_resolution TEXT, -- 'refund_buyer' | 'release_seller'
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_buyer_id UUID;
  v_seller_id UUID;
  v_status TEXT;
  v_seller_wallet_id UUID;
  v_buyer_wallet_id UUID;
  v_seller_pending_balance NUMERIC(12,2);
  v_net_escrow NUMERIC(12,2);
BEGIN
  IF p_resolution NOT IN ('refund_buyer', 'release_seller') THEN
    RAISE EXCEPTION 'Invalid resolution: must be refund_buyer or release_seller';
  END IF;

  SELECT is_admin INTO v_is_admin FROM public.user_profiles WHERE id = p_admin_id;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Unauthorized: caller is not an admin';
  END IF;

  SELECT buyer_id, seller_id, status INTO v_buyer_id, v_seller_id, v_status
  FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_status != 'disputed' THEN RAISE EXCEPTION 'Order is not disputed (status: %)', v_status; END IF;

  SELECT id, pending_balance INTO v_seller_wallet_id, v_seller_pending_balance
  FROM public.user_wallets WHERE user_id = v_seller_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Seller wallet not found'; END IF;

  SELECT delta_pending INTO STRICT v_net_escrow
  FROM public.wallet_transactions
  WHERE order_fk = p_order_id AND type = 'escrow_hold' AND wallet_id = v_seller_wallet_id;

  IF v_seller_pending_balance < v_net_escrow THEN
    RAISE EXCEPTION 'Seller pending balance is less than the held escrow amount';
  END IF;

  IF p_resolution = 'release_seller' THEN
    UPDATE public.user_wallets
    SET pending_balance = pending_balance - v_net_escrow,
        available_balance = available_balance + v_net_escrow,
        updated_at = NOW()
    WHERE id = v_seller_wallet_id;

    UPDATE public.orders SET status = 'completed', updated_at = NOW() WHERE id = p_order_id;

    INSERT INTO public.order_events (order_id, event_type, payload, created_at)
    VALUES (p_order_id, 'dispute_resolved', jsonb_build_object('resolution', 'release_seller', 'admin_id', p_admin_id, 'notes', p_notes), NOW());
    INSERT INTO public.order_events (order_id, event_type, created_at)
    VALUES (p_order_id, 'completed', NOW());

    INSERT INTO public.wallet_transactions (
      wallet_id, order_id, type, amount, status, description,
      delta_available, delta_pending, order_fk
    ) VALUES (
      v_seller_wallet_id, p_order_id::TEXT, 'earning', v_net_escrow, 'completed',
      'Escrow Released (Dispute Resolved in Seller Favor)', v_net_escrow, -v_net_escrow, p_order_id
    );

  ELSE -- refund_buyer
    SELECT id INTO v_buyer_wallet_id FROM public.user_wallets WHERE user_id = v_buyer_id FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO public.user_wallets (user_id, available_balance, pending_balance, currency)
      VALUES (v_buyer_id, 0, 0, 'EGP') RETURNING id INTO v_buyer_wallet_id;
    END IF;

    UPDATE public.user_wallets
    SET pending_balance = pending_balance - v_net_escrow, updated_at = NOW()
    WHERE id = v_seller_wallet_id;

    UPDATE public.user_wallets
    SET available_balance = available_balance + v_net_escrow, updated_at = NOW()
    WHERE id = v_buyer_wallet_id;

    UPDATE public.orders SET status = 'refunded', updated_at = NOW() WHERE id = p_order_id;

    INSERT INTO public.order_events (order_id, event_type, payload, created_at)
    VALUES (p_order_id, 'dispute_resolved', jsonb_build_object('resolution', 'refund_buyer', 'admin_id', p_admin_id, 'notes', p_notes), NOW());
    INSERT INTO public.order_events (order_id, event_type, created_at)
    VALUES (p_order_id, 'refunded', NOW());

    -- Reverse the seller's escrow hold (removes it from pending, no available credit).
    -- amount reflects the magnitude of the reversal (positive), matching
    -- the convention used everywhere else in this ledger (e.g.
    -- release_escrow's earning row); delta_pending carries the sign.
    INSERT INTO public.wallet_transactions (
      wallet_id, order_id, type, amount, status, description,
      delta_available, delta_pending, order_fk
    ) VALUES (
      v_seller_wallet_id, p_order_id::TEXT, 'refund', v_net_escrow, 'completed',
      'Escrow Reversed (Dispute Resolved: Buyer Refunded)', 0, -v_net_escrow, p_order_id
    );

    -- Credit the buyer's wallet with the refund
    INSERT INTO public.wallet_transactions (
      wallet_id, order_id, type, amount, status, description,
      delta_available, delta_pending, order_fk
    ) VALUES (
      v_buyer_wallet_id, p_order_id::TEXT, 'refund', v_net_escrow, 'completed',
      'Refund: Dispute Resolved in Buyer Favor', v_net_escrow, 0, p_order_id
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'resolution', p_resolution, 'amount', v_net_escrow);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_resolve_dispute(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(UUID, UUID, TEXT, TEXT) TO service_role;
