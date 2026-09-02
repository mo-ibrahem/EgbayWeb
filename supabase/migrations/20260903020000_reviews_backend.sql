-- Reviews backend. A review requires a completed order, enforced here
-- in the database, not the client -- the row references the order it
-- came from, and submit_review asserts that order's own status and
-- buyer_id, so there is no path to a rating that isn't backed by money
-- that actually moved through escrow. This is the whole point: this
-- codebase previously shipped a hardcoded 4.9-star rating on every
-- product page, which was removed because it was fiction.
--
-- Buyer -> seller only, never the reverse. eBay removed seller-to-buyer
-- negative/neutral feedback in 2008 specifically because sellers used
-- it to retaliate against buyers who left honest criticism, which
-- suppressed honest reviews. Not importing a problem the industry
-- already solved by removing it.
--
-- Rates the SELLER, not the product: Egbay is peer-to-peer used goods,
-- most listings are stock=1 and sell once -- a per-product rating on a
-- unique item that sold a single time can never accumulate. The seller
-- is the unit that repeats, so the seller is what accumulates
-- reputation. product_id stays on the row for display context only.

CREATE TABLE public.reviews (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            uuid NOT NULL UNIQUE REFERENCES public.orders(id),
    reviewer_id         uuid NOT NULL REFERENCES auth.users(id),
    seller_id           uuid NOT NULL REFERENCES auth.users(id),
    product_id          uuid REFERENCES public.products(id) ON DELETE SET NULL,
    rating              smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment             text CHECK (char_length(comment) <= 1000),
    seller_response     text CHECK (char_length(seller_response) <= 1000),
    seller_responded_at timestamptz,
    edited_at           timestamptz,
    created_at          timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_seller ON public.reviews (seller_id, created_at DESC);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Reviews are the whole point of public seller reputation -- readable
-- by anyone, including logged-out visitors deciding whether a seller
-- is trustworthy before they've even signed up.
CREATE POLICY "Reviews are publicly readable"
    ON public.reviews FOR SELECT
    USING (true);

-- No INSERT/UPDATE/DELETE policy at all: every write goes through one
-- of the three SECURITY DEFINER functions below, each of which asserts
-- the caller's identity from auth.uid() rather than trusting an
-- argument -- same shape as hide_chat_room_for_user and the
-- notification mark-read RPCs.
REVOKE ALL ON public.reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT ALL ON public.reviews TO service_role;

-- ============================================================
-- Aggregate. rating_avg is nullable on purpose -- NOT default 0. A
-- seller with zero reviews has no rating; storing 0.00 would make
-- "unrated" indistinguishable from "rated terribly", and avg() over an
-- empty set already returns NULL naturally, so this needs no special
-- case in the trigger.
ALTER TABLE public.user_profiles ADD COLUMN rating_avg numeric(3,2);
ALTER TABLE public.user_profiles ADD COLUMN rating_count integer NOT NULL DEFAULT 0;

-- public_profiles is a VIEW. Adding columns to user_profiles alone
-- would NOT expose them -- every product card and product page reads
-- this view, not the base table, so the rating would silently never
-- appear anywhere without this.
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
    id,
    full_name,
    avatar_url,
    tier,
    is_verified_seller,
    rating_avg,
    rating_count
FROM public.user_profiles;

CREATE OR REPLACE FUNCTION public.refresh_seller_rating_aggregate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_seller_id uuid := COALESCE(NEW.seller_id, OLD.seller_id);
BEGIN
    UPDATE public.user_profiles
    SET rating_avg = (SELECT ROUND(AVG(rating)::numeric, 2) FROM public.reviews WHERE seller_id = v_seller_id),
        rating_count = (SELECT COUNT(*) FROM public.reviews WHERE seller_id = v_seller_id)
    WHERE id = v_seller_id;

    RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_refresh_seller_rating_aggregate ON public.reviews;
CREATE TRIGGER trg_refresh_seller_rating_aggregate
    AFTER INSERT OR UPDATE OR DELETE ON public.reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.refresh_seller_rating_aggregate();

-- ============================================================
-- submit_review: the buyer of a completed order rates the seller.
-- seller_id/product_id are taken FROM THE ORDER ROW, never from the
-- caller -- a client-supplied seller_id would let anyone attach a
-- five-star review to any seller they like.
CREATE OR REPLACE FUNCTION public.submit_review(
    p_order_id uuid,
    p_rating integer,
    p_comment text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_order RECORD;
    v_review_id uuid;
BEGIN
    IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'Rating must be between 1 and 5';
    END IF;
    IF p_comment IS NOT NULL AND char_length(p_comment) > 1000 THEN
        RAISE EXCEPTION 'Comment must be 1000 characters or fewer';
    END IF;

    SELECT id, buyer_id, seller_id, product_id, status, updated_at
    INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    IF auth.uid() != v_order.buyer_id THEN
        RAISE EXCEPTION 'Only the buyer of this order can review it';
    END IF;

    IF v_order.status != 'completed' THEN
        RAISE EXCEPTION 'Order must be completed before it can be reviewed';
    END IF;

    IF v_order.updated_at < NOW() - INTERVAL '90 days' THEN
        RAISE EXCEPTION 'The review window for this order has closed';
    END IF;

    BEGIN
        INSERT INTO public.reviews (order_id, reviewer_id, seller_id, product_id, rating, comment)
        VALUES (p_order_id, auth.uid(), v_order.seller_id, v_order.product_id, p_rating, p_comment)
        RETURNING id INTO v_review_id;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'You have already reviewed this order';
    END;

    RETURN v_review_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_review(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_review(uuid, integer, text) TO authenticated, service_role;

-- ============================================================
-- edit_review: 7-day window measured from the review's ORIGINAL
-- created_at, not from any previous edit -- otherwise repeated edits
-- could extend the window indefinitely, defeating the point of a lock.
CREATE OR REPLACE FUNCTION public.edit_review(
    p_review_id uuid,
    p_rating integer,
    p_comment text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_review RECORD;
BEGIN
    IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'Rating must be between 1 and 5';
    END IF;
    IF p_comment IS NOT NULL AND char_length(p_comment) > 1000 THEN
        RAISE EXCEPTION 'Comment must be 1000 characters or fewer';
    END IF;

    SELECT id, reviewer_id, created_at INTO v_review
    FROM public.reviews
    WHERE id = p_review_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Review not found';
    END IF;

    IF auth.uid() != v_review.reviewer_id THEN
        RAISE EXCEPTION 'You can only edit your own review';
    END IF;

    IF v_review.created_at < NOW() - INTERVAL '7 days' THEN
        RAISE EXCEPTION 'The edit window for this review has closed';
    END IF;

    UPDATE public.reviews
    SET rating = p_rating, comment = p_comment, edited_at = NOW()
    WHERE id = p_review_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.edit_review(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_review(uuid, integer, text) TO authenticated, service_role;

-- ============================================================
-- respond_to_review: the reviewed seller only. No edit-window lock --
-- unlike the buyer's rating there's no gaming concern in a seller being
-- able to update their own public response over time.
CREATE OR REPLACE FUNCTION public.respond_to_review(
    p_review_id uuid,
    p_response text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_seller_id uuid;
BEGIN
    IF p_response IS NULL OR char_length(trim(p_response)) = 0 THEN
        RAISE EXCEPTION 'Response cannot be empty';
    END IF;
    IF char_length(p_response) > 1000 THEN
        RAISE EXCEPTION 'Response must be 1000 characters or fewer';
    END IF;

    SELECT seller_id INTO v_seller_id
    FROM public.reviews
    WHERE id = p_review_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Review not found';
    END IF;

    IF auth.uid() != v_seller_id THEN
        RAISE EXCEPTION 'Only the reviewed seller can respond to this review';
    END IF;

    UPDATE public.reviews
    SET seller_response = p_response, seller_responded_at = NOW()
    WHERE id = p_review_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.respond_to_review(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_review(uuid, text) TO authenticated, service_role;

-- ============================================================
-- Notifications: seller learns they were reviewed.
CREATE OR REPLACE FUNCTION public.notify_on_new_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_product_title text;
BEGIN
    IF NEW.product_id IS NOT NULL THEN
        SELECT title INTO v_product_title FROM public.products WHERE id = NEW.product_id;
    END IF;

    PERFORM public.create_notification(
        NEW.seller_id,
        'review_received',
        jsonb_build_object('rating', NEW.rating, 'product_title', COALESCE(v_product_title, 'your listing'), 'review_id', NEW.id),
        '/profile?tab=reviews'
    );

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_on_new_review ON public.reviews;
CREATE TRIGGER trg_notify_on_new_review
    AFTER INSERT ON public.reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_on_new_review();

-- ============================================================
-- Extends the existing order_events trigger: 'completed' now ALSO
-- nudges the BUYER to rate their purchase, alongside the existing
-- seller "funds released" notification. This is a straight
-- CREATE OR REPLACE of notify_on_order_event from notifications_foundation
-- -- every other branch is unchanged.
CREATE OR REPLACE FUNCTION public.notify_on_order_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_order RECORD;
    v_product_title text;
    v_link text;
BEGIN
    SELECT buyer_id, seller_id, amount, product_snapshot
    INTO v_order
    FROM public.orders
    WHERE id = NEW.order_id;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    v_product_title := COALESCE(v_order.product_snapshot->>'title', 'your order');
    v_link := '/orders/' || NEW.order_id::text;

    IF NEW.event_type = 'order_placed' THEN
        PERFORM public.create_notification(
            v_order.seller_id, 'order_placed',
            jsonb_build_object('order_id', NEW.order_id, 'product_title', v_product_title, 'amount', v_order.amount),
            v_link
        );

    ELSIF NEW.event_type = 'escrow_secured' THEN
        PERFORM public.create_notification(
            v_order.seller_id, 'escrow_secured',
            jsonb_build_object('order_id', NEW.order_id, 'product_title', v_product_title, 'amount', v_order.amount),
            v_link
        );

    ELSIF NEW.event_type = 'shipped' THEN
        PERFORM public.create_notification(
            v_order.buyer_id, 'shipped',
            jsonb_build_object('order_id', NEW.order_id, 'product_title', v_product_title),
            v_link
        );

    ELSIF NEW.event_type = 'out_for_delivery' THEN
        PERFORM public.create_notification(
            v_order.buyer_id, 'out_for_delivery',
            jsonb_build_object('order_id', NEW.order_id, 'product_title', v_product_title),
            v_link
        );

    ELSIF NEW.event_type = 'delivered' THEN
        PERFORM public.create_notification(
            v_order.buyer_id, 'delivered',
            jsonb_build_object('order_id', NEW.order_id, 'product_title', v_product_title),
            v_link
        );

    ELSIF NEW.event_type = 'completed' THEN
        PERFORM public.create_notification(
            v_order.seller_id, 'completed',
            jsonb_build_object('order_id', NEW.order_id, 'product_title', v_product_title, 'amount', v_order.amount),
            v_link
        );
        -- New: prompt the buyer to rate the seller now that the order
        -- has a completed status submit_review can act on.
        PERFORM public.create_notification(
            v_order.buyer_id, 'rate_purchase',
            jsonb_build_object('order_id', NEW.order_id, 'product_title', v_product_title),
            v_link
        );

    ELSIF NEW.event_type = 'disputed' THEN
        PERFORM public.create_notification(
            v_order.buyer_id, 'disputed',
            jsonb_build_object('order_id', NEW.order_id, 'product_title', v_product_title),
            v_link
        );
        PERFORM public.create_notification(
            v_order.seller_id, 'disputed',
            jsonb_build_object('order_id', NEW.order_id, 'product_title', v_product_title),
            v_link
        );
    END IF;

    RETURN NEW;
END;
$function$;
