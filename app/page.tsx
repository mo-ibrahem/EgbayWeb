'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search, ShieldCheck, Truck, Zap, SlidersHorizontal, X, ChevronDown,
  LayoutGrid, Smartphone, Shirt, Home, Baby, Dumbbell, BookOpen,
  Car, Video, Package,
} from 'lucide-react';
import { productService, type Product } from '@/lib/products';
import { getActiveLiveSessions, type LiveSession } from '@/lib/liveService';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import ProductCard from '@/components/ui/ProductCard';
import { SkeletonProductCard } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';

const CATEGORIES = [
  { id: '',            key: 'all',        label: 'All',            label_ar: 'الكل',            icon: LayoutGrid },
  { id: 'Electronics', key: 'electronics',label: 'Electronics',    label_ar: 'إلكترونيات',      icon: Smartphone },
  { id: 'Fashion',     key: 'fashion',    label: 'Fashion',        label_ar: 'أزياء',            icon: Shirt },
  { id: 'Home',        key: 'home',       label: 'Home & Living',  label_ar: 'أثاث ومنزل',       icon: Home },
  { id: 'Toys',        key: 'toys',       label: 'Toys & Kids',    label_ar: 'ألعاب وأطفال',     icon: Baby },
  { id: 'Sports',      key: 'sports',     label: 'Sports',         label_ar: 'رياضة',            icon: Dumbbell },
  { id: 'Books',       key: 'books',      label: 'Books & Media',  label_ar: 'كتب وميديا',       icon: BookOpen },
  { id: 'Automotive',  key: 'automotive', label: 'Automotive',     label_ar: 'سيارات',           icon: Car },
] as const;

type SortKey = 'newest' | 'price_asc' | 'price_desc';

function HomeFeedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { isRTL, t } = useLanguage();

  const [products, setProducts] = useState<Product[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || '');
  const [conditionFilter, setConditionFilter] = useState<'all' | 'New' | 'Used'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const isBrowsing = Boolean(activeCategory || searchQuery);

  useEffect(() => {
    getActiveLiveSessions().then(setLiveSessions).catch(() => {});
  }, []);

  useEffect(() => {
    setActiveCategory(searchParams.get('category') || '');
    setSearchQuery(searchParams.get('search') || '');
  }, [searchParams]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const data = await productService.getProducts({
          category: activeCategory || undefined,
          search: searchQuery || undefined,
          condition: conditionFilter === 'all' ? undefined : [conditionFilter],
          minPrice: minPrice ? Number(minPrice) : undefined,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
        });
        setProducts(data);
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [activeCategory, searchQuery, conditionFilter, minPrice, maxPrice]);

  const sortedProducts = useMemo(() => {
    const list = [...products];
    if (sortKey === 'price_asc') list.sort((a, b) => a.price - b.price);
    else if (sortKey === 'price_desc') list.sort((a, b) => b.price - a.price);
    // 'newest' is already the query order (created_at desc)
    return list;
  }, [products, sortKey]);

  const handleCategorySelect = (catId: string) => {
    setActiveCategory(catId);
    router.push(catId ? `/?category=${encodeURIComponent(catId)}` : '/', { scroll: false });
  };

  const clearAll = () => {
    setActiveCategory('');
    setSearchQuery('');
    setConditionFilter('all');
    setSortKey('newest');
    setMinPrice('');
    setMaxPrice('');
    router.push('/', { scroll: false });
  };

  const handleWishlistToggle = async (productId: string, wasWishlisted: boolean) => {
    if (!user) { router.push('/login'); return; }
    try {
      if (wasWishlisted) await productService.removeFromWishlist(productId);
      else await productService.addToWishlist(productId);
    } catch (e) {
      console.error(e);
    }
  };

  const activeFilterCount = (conditionFilter !== 'all' ? 1 : 0) + (minPrice ? 1 : 0) + (maxPrice ? 1 : 0);
  const liveCount = liveSessions.filter(s => s.status === 'live').length;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-5 sm:py-7 space-y-6 pb-24 sm:pb-10">
      {/* ─── Trust strip: three real, always-true guarantees. Stated once,
          here, rather than repeated on every product card. ─── */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1.5 bg-white border border-slate-200 rounded-md py-2.5 px-4 text-xs font-semibold text-slate-600">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-brand" />
          {isRTL ? 'ضمان مالي ١٠٠٪ على كل عملية' : '100% Escrow on every order'}
        </span>
        <span className="flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5 text-brand" />
          {isRTL ? 'شحن لباب البيت أو تسليم يدوي' : 'Courier delivery or in-person meetup'}
        </span>
        <span className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-brand" />
          {isRTL ? 'سحب فوري بإنستاباي وفودافون كاش' : 'Instant InstaPay & Vodafone Cash payouts'}
        </span>
      </div>

      {!isBrowsing && (
        <>
          {/* Live-now teaser — only rendered when a session is genuinely
              live right now; never a fabricated "trending" claim. */}
          {liveCount > 0 && (
            <Link
              href="/live"
              className="flex items-center justify-between bg-slate-900 text-white rounded-lg px-4 py-3 hover:bg-slate-800 transition-colors"
            >
              <span className="flex items-center gap-2.5 text-sm font-bold">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
                {isRTL
                  ? `${liveCount} بائع يبث الآن مباشرة`
                  : `${liveCount} seller${liveCount > 1 ? 's' : ''} live right now`}
              </span>
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Video className="w-3.5 h-3.5" /> {isRTL ? 'شاهد الآن' : 'Watch now'}
              </span>
            </Link>
          )}

          {/* Category rail */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = activeCategory === cat.id;
              return (
                <button
                  key={cat.id || 'all'}
                  onClick={() => handleCategorySelect(cat.id)}
                  className={`flex items-center gap-1.5 flex-shrink-0 px-3.5 py-2 rounded-md border text-xs font-bold transition-colors ${
                    isSelected
                      ? 'bg-brand-soft border-brand/30 text-brand-dark'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {isRTL ? cat.label_ar : cat.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ─── Results toolbar ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="section-heading min-w-0">
            <h1 className="text-base font-black text-slate-900 truncate">
              {activeCategory
                ? t(`categories.${activeCategory.toLowerCase()}`, activeCategory)
                : searchQuery
                ? (isRTL ? `نتائج البحث عن "${searchQuery}"` : `Results for "${searchQuery}"`)
                : (isRTL ? 'أحدث الإعلانات' : 'Recently Listed')}
            </h1>
            {!loading && (
              <span className="text-xs font-semibold text-slate-400 flex-shrink-0">
                {sortedProducts.length} {isRTL ? 'إعلان' : sortedProducts.length === 1 ? 'item' : 'items'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setFiltersOpen(o => !o)}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-md border transition-colors ${
                activeFilterCount > 0 || filtersOpen
                  ? 'bg-brand-soft border-brand/30 text-brand-dark'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {isRTL ? 'فلاتر' : 'Filters'}
              {activeFilterCount > 0 && (
                <span className="bg-brand text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <div className="relative">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="appearance-none bg-white border border-slate-200 hover:border-slate-300 text-xs font-bold text-slate-700 rounded-md pl-3 pr-7 py-2 outline-none cursor-pointer"
              >
                <option value="newest">{isRTL ? 'الأحدث' : 'Newest'}</option>
                <option value="price_asc">{isRTL ? 'السعر: الأقل أولاً' : 'Price: Low to High'}</option>
                <option value="price_desc">{isRTL ? 'السعر: الأعلى أولاً' : 'Price: High to Low'}</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {(isBrowsing || activeFilterCount > 0 || sortKey !== 'newest') && (
              <button onClick={clearAll} className="text-xs font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1">
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isRTL ? 'مسح' : 'Clear'}</span>
              </button>
            )}
          </div>
        </div>

        {filtersOpen && (
          <div className="flex flex-wrap items-end gap-4 bg-white border border-slate-200 rounded-md p-4">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md">
              {(['all', 'New', 'Used'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setConditionFilter(c)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-sm transition-colors ${
                    conditionFilter === c ? 'bg-white text-brand shadow-card' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {c === 'all' ? (isRTL ? 'كل الحالات' : 'Any condition') : c === 'New' ? (isRTL ? 'جديد' : 'New') : (isRTL ? 'مستعمل' : 'Used')}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500">{isRTL ? 'السعر' : 'Price'}</label>
              <input
                type="number"
                inputMode="numeric"
                placeholder={isRTL ? 'من' : 'Min'}
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-20 text-xs border border-slate-200 rounded-md px-2 py-1.5 outline-none focus:border-brand"
              />
              <span className="text-slate-300">—</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder={isRTL ? 'إلى' : 'Max'}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-20 text-xs border border-slate-200 rounded-md px-2 py-1.5 outline-none focus:border-brand"
              />
              <span className="text-[11px] text-slate-400">{isRTL ? 'ج.م' : 'EGP'}</span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Product grid ─── */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 10 }).map((_, i) => <SkeletonProductCard key={i} />)}
        </div>
      ) : sortedProducts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {sortedProducts.map((product) => (
            <ProductCard key={product.id} product={product} onWishlistToggle={handleWishlistToggle} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Search className="w-6 h-6" />}
          title={isRTL ? 'لم نتمكن من إيجاد نتائج' : 'No listings found'}
          description={
            isRTL
              ? 'جرب البحث بكلمات أخرى أو غيّر الفلاتر.'
              : 'Try different search terms or adjust your filters.'
          }
          action={
            <div className="flex gap-2.5">
              {(isBrowsing || activeFilterCount > 0) && (
                <Button variant="secondary" size="sm" onClick={clearAll}>
                  {isRTL ? 'مسح الفلاتر' : 'Clear filters'}
                </Button>
              )}
              <Button href="/sell" size="sm" icon={<Package className="w-3.5 h-3.5" />}>
                {isRTL ? 'أضف إعلانك' : 'Sell an item'}
              </Button>
            </div>
          }
        />
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => <SkeletonProductCard key={i} />)}
      </div>
    }>
      <HomeFeedContent />
    </Suspense>
  );
}
