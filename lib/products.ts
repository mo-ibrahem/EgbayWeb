import { supabase } from './supabase';

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  location?: string;
  images: string[];
  // Catalogue model this listing was created from (New listings only). When a
  // listing has no photos of its own, attachCataloguePhotos fills the two
  // catalogue_* fields below with the model's licensed photos.
  model_id?: string | null;
  variant?: string | null;
  catalogue_photos?: string[];
  catalogue_credit?: string | null;
  seller_id: string;
  status: string;
  stock?: number;
  // 'in_hand' (default) or 'sourced_to_order'. lead_time_days is NULL when
  // in_hand and 1-30 when sourced (DB check constraints). A sourced listing
  // always renders its badge so it can never read as stock the seller holds.
  fulfilment?: 'in_hand' | 'sourced_to_order';
  lead_time_days?: number | null;
  // Feed only: true when the listing has product_variants, so `price` is the
  // cheapest "from" price rather than what any one unit costs.
  has_variants?: boolean;
  created_at: string;
  updated_at: string;
  // tier/is_verified_seller come straight from the public_profiles view
  // (no fallback default) -- a product with no resolvable seller profile
  // carries no seller object at all rather than a fabricated one, so the
  // UI never has to guess at (or invent) a trust signal.
  seller?: { full_name: string; avatar_url?: string; tier?: number; is_verified_seller?: boolean; rating_avg?: number | null; rating_count?: number };
  isWishlisted?: boolean;
  is_promoted?: boolean;
  promotion_tier?: 'urgent' | 'featured' | 'turbo' | string;
  promoted_until?: string;
  promoted_ad_rate?: number;
  // Real, server-tracked impression counter on the products table. Surfaced
  // in the seller dashboard -- a seller who can't see whether their listing
  // is getting looked at has no signal to act on, which is the single most
  // documented cause of marketplace seller churn.
  view_count?: number;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string | null;
  storage: string | null;
  color: string | null;
  grade: string | null;
  price: number;
  stock: number;
}

/** "Sourced to order · ~4 days" -- null for an in-hand listing. */
export function sourcedBadgeLabel(
  p: Pick<Product, 'fulfilment' | 'lead_time_days'>,
  isRTL = false,
): string | null {
  if (p.fulfilment !== 'sourced_to_order') return null;
  const d = p.lead_time_days;
  if (!d) return isRTL ? 'يُجلب عند الطلب' : 'Sourced to order';
  return isRTL ? `يُجلب عند الطلب · ~${d} يوم` : `Sourced to order · ~${d} days`;
}

/**
 * Real average reply time for a seller, in seconds, or null. Only trusted
 * with at least 3 measured replies -- below that there is no number to
 * show, and none is invented.
 */
export async function getSellerReplySeconds(sellerId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('seller_reply_stats', { p_seller_id: sellerId });
  const row = data?.[0];
  if (error || !row || row.sample_size < 3 || row.avg_reply_seconds == null) return null;
  return Number(row.avg_reply_seconds);
}

/** "Usually replies within ~15 min" / "~3 h" / "~2 d". */
export function formatReplyTime(seconds: number, isRTL = false): string {
  const min = Math.max(1, Math.round(seconds / 60));
  const h = Math.round(min / 60);
  const span = min < 60
    ? (isRTL ? `${min} دقيقة` : `${min} min`)
    : h < 48
      ? (isRTL ? `${h} ساعة` : `${h} h`)
      : (isRTL ? `${Math.round(h / 24)} يوم` : `${Math.round(h / 24)} d`);
  return isRTL ? `عادةً يرد خلال ~${span}` : `Usually replies within ~${span}`;
}

export interface UserProfile {
  id: string;
  full_name: string;
  avatar_url?: string;
  phone?: string;
  address?: string;
  created_at: string;
  updated_at: string;
}

export function formatEGP(price: number | string): string {
  const n = Math.round(Number(price));
  return `EGP ${n.toLocaleString('en-EG')}`;
}

/**
 * Whether a product's paid boost is currently in effect. `is_promoted`
 * alone isn't enough to trust -- a boost that ran out is cleared
 * server-side by a cron sweep on a 10-minute cycle, so between sweeps a
 * stale `is_promoted: true` can still be sitting on the row. Every badge
 * and every ranking decision goes through this so an expired boost
 * never displays or ranks as active.
 */
export function isPromotionActive(product: Pick<Product, 'is_promoted' | 'promoted_until'>): boolean {
  if (!product.is_promoted || !product.promoted_until) return false;
  return new Date(product.promoted_until).getTime() > Date.now();
}

/**
 * Ranking weight for the three boost tiers (Turbo > Featured > Urgent),
 * matching what sellers actually paid for. Used to pin active boosts to
 * the top of the default listing order -- see promotionRank usage in
 * app/page.tsx. Zero for anything not currently boosted.
 */
export function promotionRank(product: Pick<Product, 'is_promoted' | 'promoted_until' | 'promotion_tier'>): number {
  if (!isPromotionActive(product)) return 0;
  if (product.promotion_tier === 'turbo') return 3;
  if (product.promotion_tier === 'featured') return 2;
  if (product.promotion_tier === 'urgent') return 1;
  return 0;
}

/**
 * How complete a listing is, 0-2. Used as a tiebreaker in the default
 * homepage order, below boost rank and above recency.
 *
 * Not a quality or taste judgement, and it hides nothing: every listing
 * still appears, and an explicit price sort ignores this entirely. It
 * only asks whether the seller finished writing the listing. A stub with
 * no photo and a three-character description tells a buyer nothing, and
 * surfacing those above a listing with real photos and a real
 * description makes the whole catalogue look abandoned -- which is
 * exactly what was happening: of twelve live listings, five were
 * placeholder stubs and several outranked the real ones on recency
 * alone.
 *
 * Both signals are objective and seller-fixable: add a photo, write a
 * description. Neither is about how good the item is.
 */
export function listingCompleteness(
  product: Pick<Product, 'images' | 'description'>,
): number {
  let score = 0;
  if (product.images && product.images.length > 0) score += 1;
  if ((product.description || '').trim().length >= 20) score += 1;
  return score;
}

/**
 * Fills catalogue photos for listings with no photos of their own, in one
 * request for the whole set. Same selection as the mobile app: photos tagged
 * with the listing's variant, else the untagged ones. Every distinct credit is
 * kept (not just the first photo's) because each photo's licence needs its own.
 */
export async function attachCataloguePhotos<T extends Product>(products: T[]): Promise<T[]> {
  const needy = products.filter(p => !p.images?.length && p.model_id);
  if (!needy.length) return products;
  const modelIds = [...new Set(needy.map(p => p.model_id as string))];
  const { data: photos, error } = await supabase
    .from('product_model_photos')
    .select('model_id, variant, url, credit, position')
    .in('model_id', modelIds)
    .order('position', { ascending: true });
  if (error || !photos?.length) return products;
  return products.map(p => {
    if (p.images?.length || !p.model_id) return p;
    const mine = photos.filter(x => x.model_id === p.model_id);
    const forVariant = p.variant ? mine.filter(x => x.variant === p.variant) : [];
    const chosen = forVariant.length ? forVariant : mine.filter(x => !x.variant);
    if (!chosen.length) return p;
    const credits = [...new Set(chosen.map(c => c.credit).filter(Boolean))];
    return { ...p, catalogue_photos: chosen.map(c => c.url), catalogue_credit: credits.join(' · ') || null };
  });
}

/** Photos to display: the seller's own, else the catalogue's (see usesCataloguePhotos). */
export const listingImages = (p: Pick<Product, 'images' | 'catalogue_photos'>): string[] =>
  p.images?.length ? p.images : p.catalogue_photos ?? [];

/** True when the displayed photos are licensed catalogue photos, not the seller's. */
export const usesCataloguePhotos = (p: Pick<Product, 'images' | 'catalogue_photos'>): boolean =>
  !p.images?.length && !!p.catalogue_photos?.length;

// ─── Fast In-Memory Cache with Stale-While-Revalidate ─────────────────────────
const productCache = new Map<string, { data: Product[]; timestamp: number }>();
const singleProductCache = new Map<string, { data: Product; timestamp: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute fresh TTL

function getFilterCacheKey(filters?: {
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: string[];
}): string {
  if (!filters) return 'all';
  return JSON.stringify({
    c: filters.category || '',
    s: filters.search || '',
    min: filters.minPrice ?? '',
    max: filters.maxPrice ?? '',
    cond: (filters.condition || []).sort().join(','),
  });
}

export const productService = {
  /**
   * Ultra-resilient getProducts with caching & safe fallbacks
   */
  getProducts: async (filters?: {
    category?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    condition?: string[];
    strict?: boolean;
  }): Promise<Product[]> => {
    const key = getFilterCacheKey(filters);
    const cached = productCache.get(key);

    const fetchFresh = async (): Promise<Product[]> => {
      try {
        let query = supabase
          .from('products')
          // '*' carries fulfilment + lead_time_days. The embedded count is
          // one aggregate per listing (a plain product_variants select
          // would be truncated at 1000 rows; there are 1330).
          .select('*, product_variants(count)')
          .eq('status', 'active')
          .gt('stock', 0)
          .order('created_at', { ascending: false });

        if (filters?.category && filters.category !== 'All Categories' && filters.category !== 'All' && filters.category.trim() !== '') {
          query = query.ilike('category', filters.category);
        }
        // Strip PostgREST filter syntax (, ( ) " \) and LIKE wildcards before
        // interpolating typed text into .or(), or it breaks/injects conditions.
        const term = (filters?.search ?? '').replace(/[,()"\\%_*]/g, ' ').replace(/\s+/g, ' ').trim();
        if (term) {
          query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
        }
        if (filters?.minPrice !== undefined) {
          query = query.gte('price', filters.minPrice);
        }
        if (filters?.maxPrice !== undefined) {
          query = query.lte('price', filters.maxPrice);
        }
        if (filters?.condition && filters.condition.length > 0) {
          query = query.in('condition', filters.condition);
        }

        const { data: products, error } = await query;
        if (error) {
          console.warn('[ProductService] Supabase products query error:', error);
          if (filters?.strict) throw error;
          if (cached) return cached.data;
          return [];
        }

        if (!products || products.length === 0) {
          productCache.set(key, { data: [], timestamp: Date.now() });
          return [];
        }

        // Safely fetch seller profiles in background
        const sellerIds = [...new Set(products.map((p) => p.seller_id).filter(Boolean))];
        let sellerMap: Record<string, { id: string; full_name: string; avatar_url?: string; tier?: number; is_verified_seller?: boolean; rating_avg?: number | null; rating_count?: number }> = {};

        if (sellerIds.length > 0) {
          try {
            const { data: profiles } = await supabase
              .from('public_profiles')
              .select('id, full_name, avatar_url, tier, is_verified_seller, rating_avg, rating_count')
              .in('id', sellerIds);

            if (profiles) {
              sellerMap = profiles.reduce(
                (acc, p) => ({ ...acc, [p.id]: p }),
                {} as Record<string, { id: string; full_name: string; avatar_url?: string; tier?: number; is_verified_seller?: boolean; rating_avg?: number | null; rating_count?: number }>
              );
            }
          } catch (e) {
            console.warn('[ProductService] Profiles fetch error:', e);
          }
        }

        // Safely fetch wishlist using local session without network hang
        let wishlistedIds: string[] = [];
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) {
            const { data: wl } = await supabase
              .from('wishlists')
              .select('product_id')
              .eq('user_id', session.user.id);
            wishlistedIds = wl?.map((w) => w.product_id) || [];
          }
        } catch (e) {
          // ignore wishlist auth error for public visitors
        }

        const formatted: Product[] = products.map(({ product_variants, ...p }) => ({
          ...p,
          has_variants: (product_variants?.[0]?.count ?? 0) > 0,
          seller: sellerMap[p.seller_id] || { full_name: 'Egbay Seller' },
          isWishlisted: wishlistedIds.includes(p.id),
        }));

        const withPhotos = await attachCataloguePhotos(formatted);
        productCache.set(key, { data: withPhotos, timestamp: Date.now() });
        return withPhotos;
      } catch (err) {
        console.error('[ProductService] Fatal fetchFresh error:', err);
        if (filters?.strict) throw err;
        return cached?.data || [];
      }
    };

    if (cached) {
      if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
        fetchFresh().catch(() => {});
      }
      return cached.data;
    }

    return await fetchFresh();
  },

  getProductById: async (productId: string): Promise<Product | null> => {
    const cached = singleProductCache.get(productId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();
      if (error || !product) return null;

      let seller: { id: string; full_name: string; avatar_url?: string; tier?: number; is_verified_seller?: boolean; rating_avg?: number | null; rating_count?: number } | null = null;
      try {
        const { data: s } = await supabase
          .from('public_profiles')
          .select('id, full_name, avatar_url, tier, is_verified_seller, rating_avg, rating_count')
          .eq('id', product.seller_id)
          .single();
        seller = s;
      } catch {}

      let isWishlisted = false;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data: wl } = await supabase
            .from('wishlists')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('product_id', productId)
            .maybeSingle();
          isWishlisted = !!wl;
        }
      } catch {}

      const [fullProduct] = await attachCataloguePhotos<Product>([{
        ...product,
        seller: seller || { id: product.seller_id, full_name: 'Egbay Seller' },
        isWishlisted,
      }]);

      singleProductCache.set(productId, { data: fullProduct, timestamp: Date.now() });
      return fullProduct;
    } catch (e) {
      console.error('[ProductService] getProductById error:', e);
      return null;
    }
  },

  getVariants: async (productId: string): Promise<ProductVariant[]> => {
    const { data, error } = await supabase
      .from('product_variants')
      .select('id, product_id, sku, storage, color, grade, price, stock')
      .eq('product_id', productId)
      .order('position', { ascending: true });
    if (error) {
      console.warn('[ProductService] variants fetch error:', error);
      return [];
    }
    return (data || []).map((v) => ({ ...v, price: Number(v.price) })) as ProductVariant[];
  },

  /** Signed-in only (the RPC rejects anon). reason is 1-1000 chars. */
  reportListing: async (productId: string, reason: string): Promise<void> => {
    const { error } = await supabase.rpc('report_content', {
      p_target_type: 'listing',
      p_target_id: productId,
      p_reason: reason.trim(),
    });
    if (error) throw new Error(error.message);
  },

  getSimilarProducts: async (category: string, excludeId: string, limit = 6): Promise<Product[]> => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'active')
        .ilike('category', category)
        .neq('id', excludeId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) return [];
      return await attachCataloguePhotos((data || []) as Product[]);
    } catch {
      return [];
    }
  },

  addToWishlist: async (productId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error('Not authenticated');
    const { error } = await supabase
      .from('wishlists')
      .insert([{ user_id: session.user.id, product_id: productId, updated_at: new Date().toISOString() }]);
    if (error && error.code !== '23505') throw error;
    productCache.clear();
  },

  removeFromWishlist: async (productId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error('Not authenticated');
    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', session.user.id)
      .eq('product_id', productId);
    if (error) throw error;
    productCache.clear();
  },

  getWishlist: async (): Promise<Product[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return [];
    const { data: wl, error: wishlistError } = await supabase.from('wishlists').select('product_id').eq('user_id', session.user.id);
    if (wishlistError) throw wishlistError;
    if (!wl || wl.length === 0) return [];
    const ids = wl.map((w) => w.product_id);
    const { data: products, error: productsError } = await supabase.from('products').select('*').in('id', ids);
    if (productsError) throw productsError;
    return attachCataloguePhotos((products || []).map((p) => ({ ...p, isWishlisted: true })) as Product[]);
  },

  createProduct: async (productData: {
    title: string;
    description: string;
    price: number;
    category: string;
    condition: string;
    location?: string;
    images: string[];
    stock?: number;
    fulfilment?: 'in_hand' | 'sourced_to_order';
    lead_time_days?: number | null;
  }): Promise<Product> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error('Not authenticated');

    const { location, stock, fulfilment = 'in_hand', lead_time_days, ...payload } = productData;
    const sourced = fulfilment === 'sourced_to_order';
    const lead = Math.floor(Number(lead_time_days));
    if (sourced && !(lead >= 1 && lead <= 30)) throw new Error('Lead time must be between 1 and 30 days');
    const fullDescription = location ? `${payload.description.trim()}\n\n📍 ${location}` : payload.description.trim();
    const stockNum = Math.max(1, Math.floor(Number(stock) || 1));

    const { data, error } = await supabase
      .from('products')
      .insert([{ ...payload, description: fullDescription, seller_id: session.user.id, status: 'active', stock: stockNum, fulfilment, lead_time_days: sourced ? lead : null }])
      .select()
      .single();
    if (error) throw error;
    productCache.clear();
    return data as Product;
  },

  deleteProduct: async (productId: string) => {
    const { data: deleted, error } = await supabase.from('products').delete().eq('id', productId).select('id');
    if (error?.code === '23503') {
      const { data, error: withdrawalError } = await supabase.from('products')
        .update({ status: 'removed', updated_at: new Date().toISOString() })
        .eq('id', productId).select('id');
      if (withdrawalError) throw withdrawalError;
      if (!data?.length) throw new Error('Listing not found or not yours');
    } else if (error) throw error;
    else if (!deleted?.length) throw new Error('Listing not found or not yours');
    productCache.clear();
    singleProductCache.delete(productId);
  },

  markAsSold: async (productId: string, sold: boolean): Promise<Product> => {
    const { data, error } = await supabase.from('products')
      .update({ status: sold ? 'sold' : 'active', updated_at: new Date().toISOString() })
      .eq('id', productId).select('*');
    if (error) throw error;
    if (!data?.length) throw new Error('Listing not found or not yours');
    productCache.clear();
    singleProductCache.delete(productId);
    return data[0] as Product;
  },

  /**
   * Publishes one of the seller's own drafts (status -> 'active'). A draft can
   * be saved without a price or description, so those are checked here.
   */
  publishDraft: async (draft: Pick<Product, 'id' | 'price' | 'description' | 'stock'>): Promise<Product> => {
    const body = (draft.description || '').replace(/\n*📍 .+$/m, '').trim();
    if (!(Number(draft.price) > 0) || !body || !(Number(draft.stock) >= 1)) {
      throw new Error('Edit this draft first: a listing needs a price, a description and a stock of at least 1.');
    }
    return productService.updateProduct(draft.id, { status: 'active' });
  },

  updateProduct: async (productId: string, updates: Partial<Product>): Promise<Product> => {
    const { data, error } = await supabase
      .from('products')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .select()
      .single();
    if (error) throw error;
    productCache.clear();
    singleProductCache.delete(productId);
    return data as Product;
  },

  getProductsBySeller: async (sellerId: string): Promise<Product[]> => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as Product[];
  },
};

export const profileService = {
  getProfile: async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data as UserProfile | null;
    } catch {
      return null;
    }
  },

  // update_my_profile is the only safe way to edit your own profile; it
  // rejects a display name containing an email address. userId is kept for
  // the existing call sites -- the RPC always acts on auth.uid().
  updateProfile: async (userId: string, updates: Partial<UserProfile>): Promise<UserProfile> => {
    const { error } = await supabase.rpc('update_my_profile', {
      p_full_name: updates.full_name ?? null,
      p_phone: updates.phone ?? null,
      p_avatar_url: updates.avatar_url ?? null,
    });
    if (error) throw new Error(error.message);
    const profile = await profileService.getProfile(userId);
    if (!profile) throw new Error('Profile not found');
    return profile;
  },
};
