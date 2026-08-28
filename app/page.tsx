'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Search, ShieldCheck, Zap, ArrowUpDown, Filter, Heart,
  Star, MapPin, Clock, TrendingUp, X, ChevronRight, Sparkles,
  LayoutGrid, Smartphone, Shirt, Home, Baby, Dumbbell, BookOpen,
  Car, Tag, CheckCircle2, Flame, ArrowRight, Package
} from 'lucide-react';
import { productService, formatEGP, type Product } from '@/lib/products';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import AnimatedNumber from '@/components/AnimatedNumber';
import SmartImage from '@/components/SmartImage';

const CATEGORIES_WITH_ICONS = [
  { id: '',            key: 'all',        label: 'All Items',     label_ar: 'جميع الأقسام',  icon: LayoutGrid,  color: '#4F46E5', bg: '#EEF2FF' },
  { id: 'Electronics', key: 'electronics',label: 'Electronics',   label_ar: 'إلكترونيات',    icon: Smartphone,  color: '#0284C7', bg: '#E0F2FE' },
  { id: 'Fashion',     key: 'fashion',    label: 'Fashion',       label_ar: 'أزياء وكوتشيات', icon: Shirt,       color: '#DB2777', bg: '#FCE7F3' },
  { id: 'Home',        key: 'home',       label: 'Home & Living', label_ar: 'أثاث ومنزل',    icon: Home,        color: '#059669', bg: '#D1FAE5' },
  { id: 'Toys',        key: 'toys',       label: 'Toys & Kids',   label_ar: 'ألعاب وأطفال',  icon: Baby,        color: '#D97706', bg: '#FEF3C7' },
  { id: 'Sports',      key: 'sports',     label: 'Sports',        label_ar: 'رياضة ولياقة',  icon: Dumbbell,    color: '#DC2626', bg: '#FEE2E2' },
  { id: 'Books',       key: 'books',      label: 'Books & Media', label_ar: 'كتب وميديا',    icon: BookOpen,    color: '#7C3AED', bg: '#EDE9FE' },
  { id: 'Automotive',  key: 'automotive', label: 'Automotive',    label_ar: 'سيارات ومركبات',icon: Car,         color: '#475569', bg: '#F1F5F9' },
] as const;

const DEAL_BANNERS = [
  {
    key: 'b1',
    title: 'Flash Deals & Tech Steals',
    title_ar: 'عروض حصرية وخصومات الأجهزة',
    sub: 'Verified electronics up to 40% below retail with Escrow Guarantee',
    sub_ar: 'إلكترونيات وموبايلات موثقة بخصم يصل إلى ٤٠٪ مع حماية الضمان المالي',
    badge: 'HOT DEALS',
    badge_ar: 'عروض اليوم',
    colors: ['#0F172A', '#1E3A8A'],
    accentColor: '#3B82F6',
    category: 'Electronics',
    icon: Flame,
  },
  {
    key: 'b2',
    title: 'Egypt Escrow Protection',
    title_ar: 'حماية الضمان المالي المصري ١٠٠٪',
    sub: 'Funds held securely until you inspect & approve delivery at your doorstep',
    sub_ar: 'أموالك محفوظة في أمان تام حتى تستلم وتفحص السلعة بنفسك',
    badge: '100% SECURE',
    badge_ar: 'حماية وأمان',
    colors: ['#064E3B', '#065F46'],
    accentColor: '#10B981',
    category: '',
    icon: ShieldCheck,
  },
  {
    key: 'b3',
    title: 'Fashion & Sneakers Vault',
    title_ar: 'خزينة الأزياء والكوتشيات الأصلية',
    sub: 'Authenticated streetwear, Jordans & designer pieces directly from collectors',
    sub_ar: 'أشهر البراندات وجوردن وملابس الشارع الأصلية مباشرة من أصحابها',
    badge: 'CURATED',
    badge_ar: 'براندات أصلية',
    colors: ['#3B0764', '#581C87'],
    accentColor: '#A855F7',
    category: 'Fashion',
    icon: Sparkles,
  },
];

const TRENDING_TAGS_EN = [
  'iPhone 15 Pro', 'PlayStation 5', 'Nike Air Jordan', 'MacBook M3',
  'Air Fryer', 'Sony WH-1000XM5', 'Toyota Corolla', 'Gaming PC'
];

const TRENDING_TAGS_AR = [
  'آيفون ١٥ برو', 'بلايستيشن ٥', 'نايكي جوردن', 'ماك بوك M3',
  'قلاية هوائية', 'سماعات سوني', 'تويوتا كورولا', 'تجميعة جيمنج'
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' },
  },
};

function timeAgo(dateStr?: string, isRTL?: boolean): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isRTL ? 'الآن' : 'Just now';
  if (mins < 60) return isRTL ? `منذ ${mins} دقيقة` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isRTL ? `منذ ${hrs} ساعة` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return isRTL ? `منذ ${days} يوم` : `${days}d ago`;
}

function getCountdown(): string {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  const diff = Math.max(0, midnight.getTime() - now.getTime());
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function ProductCard({
  product,
  onWishlistToggle
}: {
  product: Product;
  onWishlistToggle: (id: string, current: boolean) => void;
}) {
  const [wishlisted, setWishlisted] = useState(product.isWishlisted ?? false);
  const { isRTL, t } = useLanguage();

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !wishlisted;
    setWishlisted(next);
    onWishlistToggle(product.id, !next);
  };

  const imgSrc = product.images?.[0] || null;

  return (
    <motion.div variants={itemVariants} className="h-full">
      <Link href={`/products/${product.id}`} className="group block h-full">
        <motion.div
          whileHover={{ y: -5, transition: { duration: 0.2 } }}
          className={`bg-white rounded-2xl overflow-hidden border transition-shadow duration-300 hover:shadow-xl flex flex-col h-full ${
            product.is_promoted
              ? 'border-blue-300 shadow-md shadow-blue-500/10 ring-1 ring-blue-500/30'
              : 'border-slate-200/80 shadow-sm hover:border-slate-300'
          }`}
        >
          {/* Product Image Container */}
          <div className="relative aspect-square bg-slate-50 overflow-hidden">
            {imgSrc ? (
              <SmartImage
                src={imgSrc}
                alt={product.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
                <Package className="w-10 h-10 stroke-[1.5]" />
                <span className="text-[11px] font-semibold mt-1">
                  {isRTL ? 'صورة الإعلان' : 'Listing Image'}
                </span>
              </div>
            )}

            {/* Badges Overlay */}
            <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10">
              {product.is_promoted && (
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <Zap className="w-3 h-3 fill-current" /> {isRTL ? 'مميز' : 'BOOSTED'}
                </span>
              )}
              {product.condition === 'New' && (
                <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                  {isRTL ? 'جديد تماماً' : 'BRAND NEW'}
                </span>
              )}
            </div>

            {/* Wishlist Button with Motion Tap */}
            <motion.button
              whileTap={{ scale: 0.75 }}
              onClick={handleWishlist}
              className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm z-10 ${
                wishlisted
                  ? 'bg-rose-500 text-white shadow-rose-500/30'
                  : 'bg-white/90 text-slate-400 hover:text-rose-500 hover:bg-white'
              }`}
            >
              <Heart className={`w-4 h-4 ${wishlisted ? 'fill-current' : ''}`} />
            </motion.button>
          </div>

          {/* Info Container */}
          <div className="p-3.5 flex flex-col flex-1 justify-between">
            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold mb-1">
                <span className="uppercase tracking-wider truncate">
                  {t(`categories.${product.category?.toLowerCase()}`, product.category)}
                </span>
                <span className="capitalize text-slate-500">
                  {product.condition === 'New'
                    ? isRTL ? 'جديد' : 'New'
                    : isRTL ? 'مستعمل' : 'Used'}
                </span>
              </div>

              <h3 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors mb-2">
                {product.title}
              </h3>
            </div>

            <div>
              {/* Price & Escrow */}
              <div className="flex items-baseline justify-between gap-1 mb-2">
                <span className="text-sm sm:text-base font-black text-slate-900">
                  <AnimatedNumber value={product.price} prefix={isRTL ? 'ج.م ' : 'EGP '} />
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                  <ShieldCheck className="w-3 h-3 flex-shrink-0" />
                  {isRTL ? 'ضمان' : 'Escrow'}
                </span>
              </div>

              {/* Location & Time */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                <span className="flex items-center gap-1 truncate max-w-[100px]">
                  <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  {product.location || (isRTL ? 'مصر' : 'Egypt')}
                </span>
                <span className="flex items-center gap-1 flex-shrink-0" suppressHydrationWarning>
                  <Clock className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  {timeAgo(product.created_at, isRTL)}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm animate-pulse">
      <div className="aspect-square bg-slate-100" />
      <div className="p-3.5 space-y-2">
        <div className="h-3 bg-slate-200 rounded w-1/3" />
        <div className="h-3.5 bg-slate-200 rounded w-full" />
        <div className="h-3.5 bg-slate-200 rounded w-2/3" />
        <div className="h-4 bg-slate-200 rounded w-1/2 pt-2" />
      </div>
    </div>
  );
}

function HomeFeedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { isRTL, t } = useLanguage();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || '');
  const [conditionFilter, setConditionFilter] = useState<'all' | 'New' | 'Used'>('all');
  const [countdown, setCountdown] = useState('08:00:00');
  const [bannerIdx, setBannerIdx] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCountdown(getCountdown());
    const t = setInterval(() => setCountdown(getCountdown()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setBannerIdx((i) => (i + 1) % DEAL_BANNERS.length), 6000);
    return () => clearInterval(t);
  }, []);

  // Synchronize category with search param
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
        });
        setProducts(data);
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [activeCategory, searchQuery, conditionFilter]);

  const handleCategorySelect = (catId: string) => {
    setActiveCategory(catId);
    if (catId) {
      router.push(`/?category=${encodeURIComponent(catId)}`, { scroll: false });
    } else {
      router.push('/', { scroll: false });
    }
  };

  const handleWishlistToggle = async (productId: string, wasWishlisted: boolean) => {
    if (!user) { router.push('/login'); return; }
    try {
      if (wasWishlisted) {
        await productService.removeFromWishlist(productId);
      } else {
        await productService.addToWishlist(productId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const banner = DEAL_BANNERS[bannerIdx];
  const BannerIcon = banner.icon;
  const trendingTags = isRTL ? TRENDING_TAGS_AR : TRENDING_TAGS_EN;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* ─── Hero Deal Banner with Framer Motion AnimatePresence ─── */}
      <div className="rounded-3xl overflow-hidden shadow-lg shadow-slate-900/10 border border-slate-800/40 relative min-h-[160px] sm:min-h-[190px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={banner.key}
            initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="w-full h-full min-h-[160px] sm:min-h-[190px] p-6 sm:p-8 flex items-center justify-between relative text-white"
            style={{ background: `linear-gradient(135deg, ${banner.colors[0]}, ${banner.colors[1]})` }}
          >
            <div className="z-10 max-w-xl space-y-2">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-black tracking-wider uppercase bg-white/15 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
                <BannerIcon className="w-3.5 h-3.5 text-amber-300" />
                <span>{isRTL ? banner.badge_ar : banner.badge}</span>
              </div>
              <h2 className="text-xl sm:text-3xl font-black tracking-tight leading-tight">
                {isRTL ? banner.title_ar : banner.title}
              </h2>
              <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
                {isRTL ? banner.sub_ar : banner.sub}
              </p>
              {banner.category && (
                <button
                  onClick={() => handleCategorySelect(banner.category)}
                  className="mt-2 inline-flex items-center gap-1.5 bg-white text-slate-900 text-xs font-bold px-4 py-2 rounded-xl hover:bg-slate-100 transition-all shadow-md"
                >
                  <span>{isRTL ? 'تصفح العروض' : 'Browse Deals'}</span>
                  <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>

            {/* Flash Sale Live Timer */}
            <div className={`hidden md:flex flex-col ${isRTL ? 'items-start text-left' : 'items-end text-right'} z-10 bg-black/20 backdrop-blur-md border border-white/10 p-4 rounded-2xl`}>
              <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-300" /> {isRTL ? 'تحديث العروض اليومية خلال' : 'Daily Deals Reset In'}
              </span>
              <span className="font-mono font-black text-2xl text-white tracking-widest" suppressHydrationWarning>
                {mounted ? countdown : '08:00:00'}
              </span>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Dot Indicators */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
          {DEAL_BANNERS.map((_, i) => (
            <button
              key={i}
              onClick={() => setBannerIdx(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === bannerIdx ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      </div>

      {/* ─── Circular Category Icon Rail with Spring Hover ─── */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-blue-600" />
            {isRTL ? 'تصفح حسب القسم' : 'Explore Categories'}
          </h2>
          {activeCategory && (
            <button
              onClick={() => handleCategorySelect('')}
              className="text-xs text-blue-600 hover:underline font-semibold"
            >
              {isRTL ? 'عرض الكل' : 'Reset to All'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 sm:gap-4">
          {CATEGORIES_WITH_ICONS.map((cat) => {
            const Icon = cat.icon;
            const isSelected = activeCategory === cat.id || (!activeCategory && cat.id === '');
            const label = isRTL ? cat.label_ar : cat.label;

            return (
              <motion.button
                key={cat.id || 'all'}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCategorySelect(cat.id)}
                className={`flex flex-col items-center p-3 rounded-2xl border transition-all duration-200 group ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/70 shadow-sm ring-2 ring-blue-500/20'
                    : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-md'
                }`}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-2 transition-transform group-hover:scale-110 shadow-sm"
                  style={{ backgroundColor: cat.bg, color: cat.color }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`text-[11px] font-bold text-center leading-tight truncate w-full ${
                  isSelected ? 'text-blue-700' : 'text-slate-700'
                }`}>
                  {label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ─── Trending Tags & Condition Filter Bar ─── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-2 border-t border-slate-200/60">
        {/* Quick Trending Tags */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full pb-1">
          <span className="flex items-center gap-1 text-xs font-bold text-slate-400 uppercase tracking-wider flex-shrink-0">
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
            {isRTL ? 'الأكثر بحثاً:' : 'Trending:'}
          </span>
          {trendingTags.map((tag) => (
            <motion.button
              key={tag}
              whileTap={{ scale: 0.93 }}
              onClick={() => {
                setSearchQuery(tag);
                router.push(`/?search=${encodeURIComponent(tag)}`, { scroll: false });
              }}
              className="text-xs font-medium text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 border border-slate-200/80 px-3 py-1 rounded-full transition-colors whitespace-nowrap"
            >
              {tag}
            </motion.button>
          ))}
        </div>

        {/* Condition Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80 self-end md:self-auto">
          {(['all', 'New', 'Used'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setConditionFilter(c)}
              className={`text-xs font-bold px-3 py-1 rounded-lg transition-all ${
                conditionFilter === c
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {c === 'all'
                ? isRTL ? 'جميع الحالات' : 'All Conditions'
                : c === 'New'
                ? isRTL ? 'جديد بالكامل' : 'Brand New'
                : isRTL ? 'مستعمل' : 'Pre-Owned'}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Product Grid Section with Framer Motion Stagger ─── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-black text-slate-900">
              {activeCategory
                ? t(`categories.${activeCategory.toLowerCase()}`, activeCategory)
                : searchQuery
                ? (isRTL ? `نتائج البحث عن: "${searchQuery}"` : `Search: "${searchQuery}"`)
                : (isRTL ? 'جميع الإعلانات الموثقة' : 'All Verified Listings')}
            </h2>
            {!loading && (
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                {products.length} {isRTL ? 'إعلان' : 'items'}
              </span>
            )}
          </div>

          {(activeCategory || searchQuery || conditionFilter !== 'all') && (
            <button
              onClick={() => {
                setActiveCategory('');
                setSearchQuery('');
                setConditionFilter('all');
                router.push('/', { scroll: false });
              }}
              className="text-xs text-blue-600 hover:underline font-semibold"
            >
              {isRTL ? 'مسح جميع الفلاتر' : 'Clear all filters'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : products.length > 0 ? (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4"
          >
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onWishlistToggle={handleWishlistToggle}
              />
            ))}
          </motion.div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center max-w-md mx-auto my-8 shadow-sm">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Search className="w-8 h-8 stroke-[1.5]" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {isRTL ? 'لم نتمكن من إيجاد نتائج مطابقة' : 'No listings found'}
            </h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              {isRTL
                ? 'جرب البحث بكلمات مختلفة أو إزالة الفلاتر لعرض المزيد من المنتجات.'
                : 'Try adjusting your search terms, changing the category, or clearing active filters.'}
            </p>
            <div className="flex justify-center gap-3">
              {(activeCategory || searchQuery || conditionFilter !== 'all') && (
                <button
                  onClick={() => {
                    setActiveCategory('');
                    setSearchQuery('');
                    setConditionFilter('all');
                    router.push('/', { scroll: false });
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  {isRTL ? 'إعادة ضبط البحث' : 'Clear Filters'}
                </button>
              )}
              <Link
                href="/sell"
                className="px-5 py-2 bg-[#3665F3] hover:bg-[#2B54D4] text-white text-xs font-bold rounded-xl transition-all shadow-sm"
              >
                {isRTL ? 'أضف أول إعلان الآن' : 'List an Item Now'}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    }>
      <HomeFeedContent />
    </Suspense>
  );
}
