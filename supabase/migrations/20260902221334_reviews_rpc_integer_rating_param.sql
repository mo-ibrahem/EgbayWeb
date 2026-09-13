DROP FUNCTION IF EXISTS public.submit_review(uuid, smallint, text);
DROP FUNCTION IF EXISTS public.edit_review(uuid, smallint, text);

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
GRANT EXECUTE ON FUNCTION public.edit_review(uuid, integer, text) TO authenticated, service_role;;
