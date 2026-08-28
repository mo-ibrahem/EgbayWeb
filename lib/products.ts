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
  seller_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  seller?: { full_name: string; avatar_url?: string };
  isWishlisted?: boolean;
  is_promoted?: boolean;
  promoted_ad_rate?: number;
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
  }): Promise<Product[]> => {
    const key = getFilterCacheKey(filters);
    const cached = productCache.get(key);

    const fetchFresh = async (): Promise<Product[]> => {
      try {
        let query = supabase
          .from('products')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (filters?.category && filters.category !== 'All Categories' && filters.category !== 'All' && filters.category.trim() !== '') {
          query = query.ilike('category', filters.category);
        }
        if (filters?.search && filters.search.trim() !== '') {
          query = query.or(
            `title.ilike.%${filters.search.trim()}%,description.ilike.%${filters.search.trim()}%`
          );
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
          if (cached) return cached.data;
          return [];
        }

        if (!products || products.length === 0) {
          productCache.set(key, { data: [], timestamp: Date.now() });
          return [];
        }

        // Safely fetch seller profiles in background
        const sellerIds = [...new Set(products.map((p) => p.seller_id).filter(Boolean))];
        let sellerMap: Record<string, { id: string; full_name: string; avatar_url?: string }> = {};

        if (sellerIds.length > 0) {
          try {
            const { data: profiles } = await supabase
              .from('user_profiles')
              .select('id, full_name, avatar_url')
              .in('id', sellerIds);

            if (profiles) {
              sellerMap = profiles.reduce(
                (acc, p) => ({ ...acc, [p.id]: p }),
                {} as Record<string, { id: string; full_name: string; avatar_url?: string }>
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

        const formatted: Product[] = products.map((p) => ({
          ...p,
          seller: sellerMap[p.seller_id] || { full_name: 'Verified Seller' },
          isWishlisted: wishlistedIds.includes(p.id),
        }));

        productCache.set(key, { data: formatted, timestamp: Date.now() });
        return formatted;
      } catch (err) {
        console.error('[ProductService] Fatal fetchFresh error:', err);
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

      let seller: { id: string; full_name: string; avatar_url?: string } | null = null;
      try {
        const { data: s } = await supabase
          .from('user_profiles')
          .select('id, full_name, avatar_url')
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

      const fullProduct: Product = {
        ...product,
        seller: seller || { id: product.seller_id, full_name: 'Verified Seller' },
        isWishlisted,
      };

      singleProductCache.set(productId, { data: fullProduct, timestamp: Date.now() });
      return fullProduct;
    } catch (e) {
      console.error('[ProductService] getProductById error:', e);
      return null;
    }
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
      return (data || []) as Product[];
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
    const { data: wl } = await supabase.from('wishlists').select('product_id').eq('user_id', session.user.id);
    if (!wl || wl.length === 0) return [];
    const ids = wl.map((w) => w.product_id);
    const { data: products } = await supabase.from('products').select('*').in('id', ids);
    return (products || []).map((p) => ({ ...p, isWishlisted: true })) as Product[];
  },

  createProduct: async (productData: {
    title: string;
    description: string;
    price: number;
    category: string;
    condition: string;
    location?: string;
    images: string[];
  }): Promise<Product> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('products')
      .insert([{ ...productData, seller_id: session.user.id, status: 'active' }])
      .select()
      .single();
    if (error) throw error;
    productCache.clear();
    return data as Product;
  },

  deleteProduct: async (productId: string) => {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) throw error;
    productCache.clear();
    singleProductCache.delete(productId);
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

  updateProfile: async (userId: string, updates: Partial<UserProfile>): Promise<UserProfile> => {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data as UserProfile;
  },
};
