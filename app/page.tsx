'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search, ShieldCheck, Truck, Zap, SlidersHorizontal, X, ChevronDown,
  LayoutGrid, Smartphone, Shirt, Home, Baby, Dumbbell, BookOpen,
  Car, Video, Package, Tag, Sparkles, ArrowRight, Wallet,
} from 'lucide-react';
import { productService, promotionRank, type Product } from '@/lib/products';
import { getActiveLiveSessions, type LiveSession } from '@/lib/liveService';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import ProductCard from '@/components/ui/ProductCard';
import { SkeletonProductCard } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';

// Presentation metadata only -- which categories actually appear on the
// homepage is derived from real inventory below, never from this list.
// A hardcoded category rail meant Sports and Books rendered as buttons
// that always led to zero results, while Beauty and General had real
// listings that were unreachable by browsing. On a marketplace this
// small, a dead category link is worse than no link: it teaches a
// first-time visitor the whole site is empty.
const CATEGORY_META: Record<string, { label: string; label_ar: string; icon: React.ElementType }> = {
  Electronics: { label: 'Electronics',   label_ar: 'إلكترونيات',   icon: Smartphone },
  Fashion:     { label: 'Fashion',       label_ar: 'أزياء',        icon: Shirt },
  Home:        { label: 'Home & Living', label_ar: 'أثاث ومنزل',   icon: Home },
  Toys:        { label: 'Toys & Kids',   label_ar: 'ألعاب وأطفال', icon: Baby },
  Sports:      { label: 'Sports',        label_ar: 'رياضة',        icon: Dumbbell },
  Books:       { label: 'Books & Media', label_ar: 'كتب وميديا',   icon: BookOpen },
  Automotive:  { label: 'Automotive',    label_ar: 'سيارات',       icon: Car },
  Beauty:      { label: 'Beauty',        label_ar: 'العناية والجمال', icon: Sparkles },
  General:     { label: 'Other',         label_ar: 'أخرى',         icon: Tag },
};

type SortKey = 'newest' | 'price_asc' | 'price_desc';

function HomeFeedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { isRTL, t } = useLanguage();

  const [products, setProducts] = useState<Product[]>([]);
  // Unfiltered catalogue, fetched once, used only to build the category
  // index and the "what's actually on Egbay" counts. Kept separate from
  // `products` so applying a filter never makes the categories vanish.
  const [catalogue, setCatalogue] = useState<Product[]>([]);
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
    productService.getProducts().then(setCatalogue).catch(() => {});
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
    else {
      // 'newest': boosted listings rank first (Turbo > Featured > Urgent,
      // this is the entire product effect sellers are paying for), tied
      // within a tier by the existing created_at desc query order. An
      // explicit price sort is left alone -- someone sorting by price
      // wants price order, not a boosted item jumping the queue.
      list.sort((a, b) => promotionRank(b) - promotionRank(a));
    }
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

  // Categories that actually have something in them, biggest first. A
  // category with zero listings is simply not offered.
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of catalogue) {
      if (!p.category) continue;
      counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({
        id,
        count,
        meta: CATEGORY_META[id] ?? { label: id, label_ar: id, icon: Tag },
      }));
  }, [catalogue]);


  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-5 sm:py-7 space-y-6 pb-24 sm:pb-10">
      {!isBrowsing && (
        <>
          {/* ─── Hero.
              Egbay is an unknown brand to a first-time Egyptian visitor,
              and research is blunt about the cost of not saying what you
              are: people leave in 10-20 seconds if the value isn't clear,
              and over half of attention never goes below the fold. This
              used to open on a thin grey trust strip and then a grid,
              which answered "what do they sell" but never "what is this
              and why is it safe" -- the only question that matters for a
              marketplace nobody has heard of.

              Deliberately no stock photography or big image hero: there
              is no real brand imagery to use, and inventing some would be
              exactly the decorative filler this redesign has been
              stripping out. Type hierarchy carries it instead. It also
              disappears entirely once someone starts browsing -- a
              shopper who has already committed shouldn't be re-pitched. */}
          <section className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight max-w-2xl text-balance">
              {isRTL
                ? 'بيع واشترِ في مصر — وفلوسك مضمونة'
                : 'Buy and sell across Egypt, without trusting a stranger'}
            </h1>
            <p className="text-sm text-slate-600 mt-2 max-w-xl leading-relaxed">
              {isRTL
                ? 'إيجي باي بيمسك فلوس المشتري في حساب ضمان، وما بيحوّلهاش للبائع غير لما المشتري يستلم ويأكد. لو حاجة غلط، تقدر تفتح نزاع وتسترد فلوسك.'
                : 'Egbay holds the buyer’s money in escrow and only releases it to the seller once the buyer confirms they’ve received the item. If something’s wrong, you open a dispute and get refunded.'}
            </p>

            <div className="flex flex-wrap items-center gap-2.5 mt-5">
              <Button href="#browse" size="lg" icon={<Search className="w-4 h-4" />}>
                {isRTL ? 'تصفح المعروض' : 'Browse what’s listed'}
              </Button>
              <Button href={user ? '/sell' : '/signup'} size="lg" variant="outline" icon={<Tag className="w-4 h-4" />}>
                {isRTL ? 'ابدأ البيع' : 'Start selling'}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-100">
              {[
                { icon: ShieldCheck, title: isRTL ? 'ضمان مالي على كل طلب' : 'Escrow on every order',
                  body: isRTL ? 'الفلوس محجوزة لحد ما تأكد الاستلام' : 'Money is held until you confirm delivery' },
                { icon: Truck, title: isRTL ? 'شحن أو تسليم يدوي' : 'Courier or meet in person',
                  body: isRTL ? 'وصّل لباب البيت أو قابل البائع بكود PIN' : 'Doorstep delivery, or hand over with a PIN' },
                { icon: Zap, title: isRTL ? 'سحب فوري للبائع' : 'Fast seller payouts',
                  body: isRTL ? 'إنستاباي وفودافون كاش والحساب البنكي' : 'InstaPay, Vodafone Cash or bank transfer' },
              ].map(pillar => (
                <div key={pillar.title} className="flex gap-2.5">
                  <pillar.icon className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900">{pillar.title}</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{pillar.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

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

          {/* Categories, derived from real stock and labelled with real
              counts. Nothing here can lead to an empty result. */}
          {categories.length > 0 && (
            <section>
              <h2 className="text-sm font-black text-slate-900 mb-3">
                {isRTL ? 'تصفح حسب القسم' : 'Browse by category'}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {categories.map(({ id, count, meta }) => {
                  const Icon = meta.icon;
                  return (
                    <button
                      key={id}
                      onClick={() => handleCategorySelect(id)}
                      className="card-hover flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3 text-left rtl:text-right"
                    >
                      <span className="w-9 h-9 rounded-md bg-brand-soft text-brand flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-slate-900 truncate">
                          {isRTL ? meta.label_ar : meta.label}
                        </span>
                        <span className="block text-[11px] text-slate-500">
                          {count} {isRTL ? 'إعلان' : count === 1 ? 'item' : 'items'}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {/* ─── Results toolbar ─── */}
      <div id="browse" className="space-y-3 scroll-mt-24">
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

      {/* ─── Seller acquisition.
          Supply is the binding constraint on this marketplace, not demand:
          8 sellers and 17 listings means most categories can't offer a
          buyer a real choice yet, and the research on cold-start
          marketplaces is consistent that supply has to be solved first
          because buyers can simply shop elsewhere. So the homepage asks
          for listings explicitly rather than only serving browsers.

          The pitch is the honest seller-side one -- escrow protects the
          seller from a buyer who won't pay, which is the actual fear in a
          peer-to-peer trade -- and the commission shown is the real Tier 1
          rate from SELLER_TIERS, not a marketing number. */}
      {!isBrowsing && (
        <section className="bg-slate-900 text-white rounded-lg p-6 sm:p-8">
          <div className="max-w-2xl">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              {isRTL ? 'عندك حاجة تبيعها؟' : 'Got something to sell?'}
            </h2>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              {isRTL
                ? 'المشتري بيدفع قبل ما تشحن، والفلوس محجوزة في الضمان لحد ما يستلم — فمفيش حد يقدر ياخد سلعتك ويهرب. العمولة 3.5٪ وقت البيع بس، ومفيش رسوم على الإعلان.'
                : 'The buyer pays before you ship, and the money sits in escrow until they confirm — so nobody walks off with your item. 3.5% commission when it sells, nothing to list.'}
            </p>
            <div className="flex flex-wrap items-center gap-2.5 mt-5">
              <Button href={user ? '/sell' : '/signup'} size="lg" icon={<Tag className="w-4 h-4" />}>
                {isRTL ? 'أضف إعلانك مجاناً' : 'List an item free'}
              </Button>
              <Link
                href="/wallet"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-300 hover:text-white transition-colors px-2"
              >
                <Wallet className="w-4 h-4" />
                {isRTL ? 'إزاي بستلم فلوسي؟' : 'How payouts work'}
                <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
              </Link>
            </div>
          </div>
        </section>
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
