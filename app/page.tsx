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
  Car, Tag, CheckCircle2, Flame, ArrowRight, Package, Video
} from 'lucide-react';
import { productService, formatEGP, type Product } from '@/lib/products';
import { getActiveLiveSessions, type LiveSession } from '@/lib/liveService';
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
    key: 'b0',
    title: 'EgyBay Live — Watch & Sell Live',
    title_ar: 'إيجي باي لايف — تسوق وبع عبر البث المباشر',
    sub: 'Real-time interactive shopping with instant escrow checkout and doorstep delivery',
    sub_ar: 'بث حي ومباشر مع التجار، اشترِ السلعة بضغطة واحدة مع حماية الضمان المالي',
    badge: 'LIVE SELLING',
    badge_ar: 'بث مباشر',
    colors: ['#7F1D1D', '#991B1B'],
    accentColor: '#EF4444',
    category: '__live__',
    icon: Video,
  },
  {
    key: 'b1',
    title: 'Flash Deals & Tech Steals',
    title_ar: 'عروض حصرية وخصومات الأجهزة',
    sub: 'Verified electronics up to 40% below retail with Escrow Guarantee',
    sub_ar: 'إلكترونيات وموبايلات موثقة بخصم يصل إلى ٤٠٪ مع حماية الضمان المالي',
    badge: 'DAILY DEALS',
    badge_ar: 'عروض اليوم',
    colors: ['#0F172A', '#1E3A8A'],
    accentColor: '#3B82F6',
    category: 'Electronics',
    icon: Flame,
  },
  {
    key: 'b2',
    title: 'Egypt Escrow Protection',
    title_ar: 'حماية الضمان المالي المصري',
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
    badge: 'AUTHENTICITY GUARANTEED',
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
    <div className="h-full w-full min-w-0">
      <Link href={`/products/${product.id}`} className="group block h-full min-w-0">
        <div
          className={`premium-card bg-white rounded-[18px] overflow-hidden border flex flex-col h-full min-w-0 relative ${
            product.is_promoted
              ? 'border-blue-300/70 shadow-md ring-1 ring-blue-500/20 card-boosted-bar'
              : 'border-slate-200/70 shadow-sm hover:border-blue-200'
          }`}
        >
          {/* Product Image Container */}
          <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden w-full">
            {imgSrc ? (
              <SmartImage
                src={imgSrc}
                alt={product.title}
                fill
                className="object-cover group-hover:scale-[1.07] transition-transform duration-400 ease-out"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
                <Package className="w-8 h-8 stroke-[1.5]" />
                <span className="text-[10px] font-semibold mt-1">
                  {isRTL ? 'صورة الإعلان' : 'No Image'}
                </span>
              </div>
            )}

            {/* Dark gradient overlay at bottom for readability */}
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

            {/* Badges Overlay */}
            <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
              {product.is_promoted && (
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                  <Zap className="w-2.5 h-2.5 fill-current" /> {isRTL ? 'مميز' : 'BOOST'}
                </span>
              )}
              {product.condition === 'New' && (
                <span className="bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                  {isRTL ? 'جديد' : 'NEW'}
                </span>
              )}
            </div>

            {/* Wishlist Button */}
            <button
              onClick={handleWishlist}
              className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-md z-10 ${
                wishlisted
                  ? 'bg-rose-500 text-white shadow-rose-400/40'
                  : 'bg-white/90 backdrop-blur-sm text-slate-400 hover:text-rose-500 hover:bg-white hover:scale-110'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${wishlisted ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Info Container */}
          <div className="p-3.5 flex flex-col flex-1 justify-between">
            <div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mb-1 uppercase tracking-wide">
                <span className="truncate">
                  {t(`categories.${product.category?.toLowerCase()}`, product.category)}
                </span>
                <span className={`capitalize font-bold px-1.5 py-0.5 rounded-md text-[9px] ${
                  product.condition === 'New'
                    ? 'text-emerald-700 bg-emerald-50'
                    : 'text-amber-700 bg-amber-50'
                }`}>
                  {product.condition === 'New'
                    ? isRTL ? 'جديد' : 'New'
                    : isRTL ? 'مستعمل' : 'Used'}
                </span>
              </div>

              <h3 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-[#3665F3] transition-colors duration-150 mb-2.5">
                {product.title}
              </h3>
            </div>

            <div>
              {/* Price & Escrow */}
              <div className="flex items-baseline justify-between gap-1 mb-2">
                <span className="text-sm sm:text-[15px] font-black text-slate-900 tracking-tight">
                  <AnimatedNumber value={product.price} prefix={isRTL ? 'ج.م ' : 'EGP '} />
                </span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-lg">
                  <ShieldCheck className="w-3 h-3 flex-shrink-0" />
                  {isRTL ? 'ضمان' : 'Escrow'}
                </span>
              </div>



              {/* Location & Time */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                <span className="flex items-center gap-1 truncate max-w-[110px]">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {product.location || (isRTL ? 'مصر' : 'Egypt')}
                </span>
                <span className="flex items-center gap-1 flex-shrink-0" suppressHydrationWarning>
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  {timeAgo(product.created_at, isRTL)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-[18px] overflow-hidden border border-slate-100 shadow-sm">
      <div className="aspect-[4/3] skeleton" />
      <div className="p-3.5 space-y-2.5">
        <div className="h-2.5 skeleton rounded-full w-1/3" />
        <div className="h-3.5 skeleton rounded-lg w-full" />
        <div className="h-3.5 skeleton rounded-lg w-3/4" />
        <div className="h-px bg-slate-100 my-1" />
        <div className="h-4 skeleton rounded-lg w-2/5" />
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
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || '');
  const [conditionFilter, setConditionFilter] = useState<'all' | 'New' | 'Used'>('all');
  const [countdown, setCountdown] = useState('08:00:00');
  const [bannerIdx, setBannerIdx] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    getActiveLiveSessions().then(setLiveSessions).catch(() => {});
  }, []);

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
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-5 sm:space-y-7 pb-28 sm:pb-16 overflow-hidden">
      {/* ─── Hero Deal Banner with Dynamic Carousel ─── */}
      <div className="rounded-3xl overflow-hidden shadow-lg shadow-slate-900/10 border border-slate-800/40 relative min-h-[140px] sm:min-h-[175px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={banner.key}
            initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="w-full h-full min-h-[140px] sm:min-h-[175px] p-4 sm:p-7 flex items-center justify-between relative text-white"
            style={{ background: `linear-gradient(135deg, ${banner.colors[0]}, ${banner.colors[1]})` }}
          >
            <div className="z-10 max-w-xl space-y-1.5 sm:space-y-2">
              <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black tracking-wider uppercase bg-white/15 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/20">
                <BannerIcon className="w-3 h-3 text-amber-300" />
                <span>{isRTL ? banner.badge_ar : banner.badge}</span>
              </div>
              <h2 className="text-base sm:text-2xl font-black tracking-tight leading-tight">
                {isRTL ? banner.title_ar : banner.title}
              </h2>
              <p className="text-[11px] sm:text-sm text-white/80 leading-snug line-clamp-2">
                {isRTL ? banner.sub_ar : banner.sub}
              </p>
              {banner.category && (
                <button
                  onClick={() => {
                    if (banner.category === '__live__') {
                      router.push('/live');
                    } else {
                      handleCategorySelect(banner.category);
                    }
                  }}
                  className="mt-1 sm:mt-2 inline-flex items-center gap-1.5 bg-white text-slate-900 text-xs font-bold px-3.5 py-1.5 sm:py-2 rounded-xl hover:bg-slate-100 transition-all shadow-md"
                >
                  <span>{banner.category === '__live__' ? (isRTL ? 'دخول البث المباشر' : 'Watch Live Shows') : (isRTL ? 'تصفح العروض' : 'Browse Deals')}</span>
                  <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>

            {/* Flash Sale Live Timer */}
            <div className={`hidden md:flex flex-col ${isRTL ? 'items-start text-left' : 'items-end text-right'} z-10 bg-black/20 backdrop-blur-md border border-white/10 p-3.5 rounded-2xl`}>
              <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-300" /> {isRTL ? 'تحديث العروض اليومية خلال' : 'Daily Deals Reset In'}
              </span>
              <span className="font-mono font-black text-xl text-white tracking-widest" suppressHydrationWarning>
                {mounted ? countdown : '08:00:00'}
              </span>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Dot Indicators */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
          {DEAL_BANNERS.map((_, i) => (
            <button
              key={i}
              onClick={() => setBannerIdx(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === bannerIdx ? 'w-5 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      </div>

      {/* ─── Micro-Trust Ticker ─── */}
      <div className="w-full bg-gradient-to-r from-blue-50 via-white to-emerald-50 border border-blue-100 rounded-2xl py-2.5 px-3 sm:px-5 flex items-center justify-center gap-3 sm:gap-7 text-[10px] sm:text-xs text-slate-700 font-bold shadow-sm">
        <div className="flex items-center gap-1.5 text-blue-700 whitespace-nowrap">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          <span>{isRTL ? 'ضمان مالي ١٠٠٪' : '100% Escrow Protected'}</span>
        </div>
        <span className="text-slate-300 font-thin">|</span>
        <div className="flex items-center gap-1.5 text-emerald-700 whitespace-nowrap">
          <Package className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
          <span>{isRTL ? 'شحن بوسطة' : 'Bosta Doorstep Delivery'}</span>
        </div>
        <span className="text-slate-300 font-thin hidden sm:inline">|</span>
        <div className="hidden sm:flex items-center gap-1.5 text-amber-700 whitespace-nowrap">
          <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <span>{isRTL ? 'إنستاباي فوري' : 'Instant InstaPay Payouts'}</span>
        </div>
      </div>

      {/* ─── Category Discovery Squircle Rail (eBay Evo Pattern) ─── */}
      <div>
        <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-1">
          {/* Live Stream Story Pill */}
          <Link
            href="/live"
            className="flex flex-col items-center gap-1.5 flex-shrink-0 group w-[72px] sm:w-[84px]"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl p-[2.5px] bg-gradient-to-tr from-red-600 via-rose-500 to-amber-500 flex items-center justify-center relative shadow-sm group-hover:scale-105 transition-transform">
              <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center">
                <Video className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
              </div>
              <span className="absolute -bottom-1 bg-red-600 text-white text-[8px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-full border border-white">
                LIVE
              </span>
            </div>
            <span className="text-[11px] font-black text-red-600 text-center leading-tight">
              {isRTL ? 'بث مباشر' : 'Live Shows'}
            </span>
          </Link>

          {/* Category Squircle Tiles */}
          {CATEGORIES_WITH_ICONS.map((cat) => {
            const Icon = cat.icon;
            const isSelected = activeCategory === cat.id || (!activeCategory && cat.id === '');
            const label = isRTL ? cat.label_ar : cat.label;

            return (
              <button
                key={cat.id || 'all'}
                onClick={() => handleCategorySelect(cat.id)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 group w-[72px] sm:w-[84px]"
              >
                <div
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all duration-200 shadow-sm group-hover:scale-105 ${
                    isSelected
                      ? 'ring-2 ring-[#3665F3] ring-offset-2 bg-blue-50 text-[#3665F3] border-transparent'
                      : 'border border-slate-200 bg-white hover:border-slate-300'
                  }`}
                  style={!isSelected ? { backgroundColor: cat.bg, color: cat.color } : {}}
                >
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <span className={`text-[10px] sm:text-xs font-bold text-center leading-tight line-clamp-2 max-w-[76px] ${
                  isSelected ? 'text-blue-700 font-black' : 'text-slate-700'
                }`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>


      {/* ─── Trending Now (Horizontal Scroll) ─── */}
      <div className="pt-2 border-t border-slate-200/50">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-5 h-5 text-rose-500" />
            <h2 className="text-base font-black text-slate-900">{isRTL ? 'عروض رائجة الآن' : 'Trending Now'}</h2>
          </div>
          <button onClick={() => router.push('/?search=trending')} className="text-xs font-bold text-blue-600 hover:text-blue-800">
            {isRTL ? 'عرض الكل' : 'See All'}
          </button>
        </div>
        
        {loading ? (
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-[160px] sm:w-[180px] flex-shrink-0">
                <SkeletonCard />
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar pb-4 snap-x">
            {products.slice(0, 8).map(product => (
              <div key={product.id} className="w-[150px] sm:w-[180px] flex-shrink-0 snap-start">
                <ProductCard product={product} onWishlistToggle={handleWishlistToggle} />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* ─── Trending Tags & Condition Filter Bar ─── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-2 border-t border-slate-200/50">
        {/* Quick Trending Tags */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full pb-1">
          <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex-shrink-0">
            <TrendingUp className="w-3.5 h-3.5 text-[#3665F3]" />
            {isRTL ? 'الأكثر بحثاً:' : 'Trending:'}
          </span>
          {trendingTags.map((tag) => (
            <button
              key={tag}
              onClick={() => {
                setSearchQuery(tag);
                router.push(`/?search=${encodeURIComponent(tag)}`, { scroll: false });
              }}
              className="trending-pill text-[11px] font-semibold text-slate-700 hover:text-[#3665F3] bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 px-3 py-1 rounded-full transition-colors whitespace-nowrap flex-shrink-0 shadow-sm"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Condition Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 self-end md:self-auto shadow-inner">
          {(['all', 'New', 'Used'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setConditionFilter(c)}
              className={`text-[11px] font-bold px-3 py-1 rounded-lg transition-all ${
                conditionFilter === c
                  ? 'bg-white text-[#3665F3] shadow-sm border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {c === 'all'
                ? isRTL ? 'الكل' : 'All'
                : c === 'New'
                ? isRTL ? 'جديد' : 'New'
                : isRTL ? 'مستعمل' : 'Used'}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Product Grid Section ─── */}
      <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-3 sm:p-5 border border-white shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="section-heading">
            <h2 className="text-sm sm:text-base font-black text-slate-900">
              {activeCategory
                ? t(`categories.${activeCategory.toLowerCase()}`, activeCategory)
                : searchQuery
                ? (isRTL ? `نتائج: "${searchQuery}"` : `Results: "${searchQuery}"`)
                : (isRTL ? 'جميع الإعلانات الموثقة' : 'All Verified Listings')}
            </h2>
            {!loading && (
              <span className="text-[10px] sm:text-xs font-bold text-[#3665F3] bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full ml-2">
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
              className="text-xs text-[#3665F3] hover:text-blue-800 font-bold flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-blue-50 transition-colors"
            >
              <X className="w-3 h-3" />
              {isRTL ? 'مسح الفلاتر' : 'Clear'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onWishlistToggle={handleWishlistToggle}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-10 text-center max-w-md mx-auto my-6 shadow-sm">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Search className="w-7 h-7 stroke-[1.5]" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              {isRTL ? 'لم نتمكن من إيجاد نتائج' : 'No listings found'}
            </h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              {isRTL
                ? 'جرب البحث بكلمات أخرى أو تغيير القسم.'
                : 'Try adjusting your search terms or clearing active filters.'}
            </p>
            <div className="flex justify-center gap-2.5">
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
                  {isRTL ? 'إعادة ضبط' : 'Clear Filters'}
                </button>
              )}
              <Link
                href="/sell"
                className="px-4 py-2 bg-[#3665F3] hover:bg-[#2B54D4] text-white text-xs font-bold rounded-xl transition-all shadow-sm"
              >
                {isRTL ? 'أضف إعلانك' : 'Sell an Item'}
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
