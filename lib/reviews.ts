import { supabase } from './supabase';

export interface Review {
  id: string;
  order_id: string;
  reviewer_id: string;
  seller_id: string;
  product_id: string | null;
  rating: number;
  comment: string | null;
  seller_response: string | null;
  seller_responded_at: string | null;
  edited_at: string | null;
  created_at: string;
  reviewer_name?: string;
  reviewer_avatar?: string;
  product_title?: string;
}

/**
 * Reviews carry only reviewer_id/product_id -- reviewer_id references
 * auth.users (not public_profiles, which is a view with no FK
 * PostgREST can embed against), so display names are fetched
 * separately and merged client-side, same pattern already used
 * throughout this codebase (lib/products.ts's seller map, the profile
 * page's chat list) rather than inventing a new one here.
 */
export async function getSellerReviews(sellerId: string, limit = 50): Promise<Review[]> {
  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!reviews || reviews.length === 0) return [];

  const reviewerIds = [...new Set(reviews.map(r => r.reviewer_id))];
  const productIds = [...new Set(reviews.map(r => r.product_id).filter(Boolean))];

  const [{ data: profiles }, { data: products }] = await Promise.all([
    supabase.from('public_profiles').select('id, full_name, avatar_url').in('id', reviewerIds),
    productIds.length
      ? supabase.from('products').select('id, title').in('id', productIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);

  return reviews.map(r => ({
    ...r,
    reviewer_name: profiles?.find(p => p.id === r.reviewer_id)?.full_name,
    reviewer_avatar: profiles?.find(p => p.id === r.reviewer_id)?.avatar_url,
    product_title: products?.find(p => p.id === r.product_id)?.title,
  }));
}

/** Whether the current user has already reviewed this order, and what they said. */
export async function getMyReviewForOrder(orderId: string): Promise<Review | null> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function submitReview(orderId: string, rating: number, comment: string): Promise<string> {
  const { data, error } = await supabase.rpc('submit_review', {
    p_order_id: orderId,
    p_rating: rating,
    p_comment: comment || null,
  });
  if (error) throw error;
  return data as string;
}

export async function editReview(reviewId: string, rating: number, comment: string): Promise<void> {
  const { error } = await supabase.rpc('edit_review', {
    p_review_id: reviewId,
    p_rating: rating,
    p_comment: comment || null,
  });
  if (error) throw error;
}

export async function respondToReview(reviewId: string, response: string): Promise<void> {
  const { error } = await supabase.rpc('respond_to_review', {
    p_review_id: reviewId,
    p_response: response,
  });
  if (error) throw error;
}
