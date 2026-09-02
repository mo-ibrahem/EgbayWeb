'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SmartImage from '@/components/SmartImage';
import {
  ArrowLeft, Heart, Share2, ShieldCheck, MapPin, Clock,
  MessageCircle, ShoppingBag, ChevronLeft, ChevronRight,
  Zap, Package, CheckCircle2, X,
} from 'lucide-react';
import { productService, formatEGP, isPromotionActive, type Product } from '@/lib/products';
import { BOOST_BADGE_STYLES } from '@/lib/boostService';
import { supabase } from '@/lib/supabase';
import { getOrCreateChatRoom } from '@/lib/chatService';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { ProductJsonLd } from '@/components/JsonLd';
import SellerBadge from '@/components/ui/SellerBadge';
import Button from '@/components/ui/Button';
import { SkeletonBlock } from '@/components/ui/Skeleton';

function timeAgo(dateStr?: string | null, isRTL?: boolean): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return isRTL ? 'اليوم' : 'Today';
  if (days === 1) return isRTL ? 'أمس' : 'Yesterday';
  if (days < 7) return isRTL ? `منذ ${days} أيام` : `${days} days ago`;
  if (days < 30) return isRTL ? `منذ ${Math.floor(days / 7)} أسابيع` : `${Math.floor(days / 7)}w ago`;
  return isRTL ? `منذ ${Math.floor(days / 30)} شهور` : `${Math.floor(days / 30)}mo ago`;
}

function SkeletonDetail() {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
      <div className="lg:col-span-3 aspect-square rounded-lg skeleton" />
      <div className="lg:col-span-2 space-y-3">
        <SkeletonBlock className="h-4 w-1/4" />
        <SkeletonBlock className="h-7 w-full" />
        <SkeletonBlock className="h-7 w-2/3" />
        <SkeletonBlock className="h-10 w-1/3" />
        <SkeletonBlock className="h-20 w-full" />
        <SkeletonBlock className="h-12 w-full" />
      </div>
    </div>
  );
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { isRTL, t } = useLanguage();

  const [product, setProduct] = useState<Product | null>(null);
  const [similar, setSimilar] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);
  const [wishlisted, setWishlisted] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const p = await productService.getProductById(id);
        if (!p) { router.push('/'); return; }
        setProduct(p);
        setWishlisted(p.isWishlisted ?? false);
        const sim = await productService.getSimilarProducts(p.category, id);
        setSimilar(sim);

        // Count the view once per browser session per product, so a
        // refresh or a re-render doesn't inflate the seller's number.
        // Best-effort: a failure here must never affect the buyer's view
        // of the product.
        try {
          const seenKey = `egbay_viewed_${id}`;
          if (!sessionStorage.getItem(seenKey)) {
            sessionStorage.setItem(seenKey, '1');
            await supabase.rpc('increment_product_view', { p_product_id: id });
          }
        } catch (viewErr) {
          console.warn('[Product] view count not recorded (non-fatal):', viewErr);
        }
      } catch {
        router.push('/');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  const handleWishlist = async () => {
    if (!user) { router.push('/login'); return; }
    const next = !wishlisted;
    setWishlisted(next);
    try {
      if (next) await productService.addToWishlist(id);
      else await productService.removeFromWishlist(id);
    } catch {
      setWishlisted(!next);
    }
  };

  const handleChat = async () => {
    if (!user) { router.push('/login'); return; }
    if (!product || product.seller_id === user.id) return;
    setChatLoading(true);
    try {
      const roomId = await getOrCreateChatRoom(user.id, product.seller_id, product.id);
      router.push(`/chat/${roomId}`);
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const images = product?.images || [];
  const hasImages = images.length > 0;

  if (loading) return <SkeletonDetail />;
  if (!product) return null;

  const isOwner = user?.id === product.seller_id;
  const isOutOfStock = (product.stock ?? 1) <= 0 || product.status === 'sold';

  return (
    <div className="min-h-screen bg-slate-50">
      <ProductJsonLd product={product} />

      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2.5 text-xs text-slate-500">
          <button onClick={() => router.back()} className="flex items-center gap-1 font-bold text-slate-700 hover:text-brand transition-colors">
            <ArrowLeft className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
            {isRTL ? 'الرجوع' : 'Back'}
          </button>
          <span className="text-slate-300">/</span>
          <Link href={`/?category=${encodeURIComponent(product.category)}`} className="hover:text-brand transition-colors">
            {t(`categories.${product.category?.toLowerCase()}`, product.category)}
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-800 font-medium truncate max-w-[240px]">{product.title}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 sm:gap-8">
          {/* ─── Gallery ─── */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-lg overflow-hidden border border-slate-200">
              <div className="relative aspect-square bg-slate-100 overflow-hidden">
                {hasImages ? (
                  <SmartImage
                    src={images[imgIdx]}
                    alt={product.title}
                    fill
                    className="object-contain"
                    sizes="(max-width: 1024px) 100vw, 60vw"
                    priority
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                    <Package className="w-16 h-16 stroke-[1.5]" />
                    <span className="text-xs font-semibold mt-2">{isRTL ? 'الصورة غير متوفرة' : 'Image not available'}</span>
                  </div>
                )}

                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/95 hover:bg-white rounded-full flex items-center justify-center shadow-card text-slate-700 z-10"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setImgIdx(i => (i + 1) % images.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/95 hover:bg-white rounded-full flex items-center justify-center shadow-card text-slate-700 z-10"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}

                <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
                  {isPromotionActive(product) && (() => {
                    const style = BOOST_BADGE_STYLES[product.promotion_tier as 'urgent' | 'featured' | 'turbo'] || BOOST_BADGE_STYLES.featured;
                    return (
                      <span className={`${style.className} text-white text-[11px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1 w-fit`}>
                        <Zap className="w-3 h-3 fill-current" /> {isRTL ? style.label_ar : style.label}
                      </span>
                    );
                  })()}
                </div>

                <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
                  <button
                    onClick={handleWishlist}
                    aria-label={isRTL ? 'أضف للمفضلة' : 'Save to wishlist'}
                    className={`w-9 h-9 rounded-full flex items-center justify-center shadow-card transition-colors ${
                      wishlisted ? 'bg-danger text-white' : 'bg-white/95 text-slate-500 hover:text-danger'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${wishlisted ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={handleShare}
                    aria-label={isRTL ? 'نسخ الرابط' : 'Copy link'}
                    className="w-9 h-9 rounded-full bg-white/95 hover:bg-white flex items-center justify-center shadow-card text-slate-500 hover:text-brand transition-colors"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Share2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {images.length > 1 && (
                <div className="flex gap-2.5 overflow-x-auto no-scrollbar p-3">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setImgIdx(i)}
                      className={`relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0 border-2 transition-colors bg-white ${
                        imgIdx === i ? 'border-brand' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <SmartImage src={img} alt={`Thumbnail ${i + 1}`} fill className="object-cover" sizes="64px" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {isRTL ? 'محمي بالضمان المالي' : 'Escrow Protected'}
                </h3>
                <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">
                  {isRTL
                    ? 'أموالك تُحوَّل للبائع فقط بعد تأكيدك للاستلام أو تسليم كود الـ PIN. استرداد كامل عبر فتح نزاع إذا لم تطابق السلعة الوصف.'
                    : 'Funds only reach the seller after you confirm receipt or hand over the PIN. Open a dispute for a full refund if the item doesn\'t match its description.'}
                </p>
              </div>
            </div>
          </div>

          {/* ─── Details & buying column ─── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-3.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-brand bg-brand-soft px-2.5 py-1 rounded-md">
                  {t(`categories.${product.category?.toLowerCase()}`, product.category)}
                </span>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${
                  product.condition === 'New' ? 'bg-success-soft text-success' : 'bg-slate-100 text-slate-600'
                }`}>
                  {product.condition === 'New' ? (isRTL ? 'جديد' : 'New') : (isRTL ? 'مستعمل' : 'Used')}
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">{product.title}</h1>

              <div>
                <div className="text-3xl font-black text-slate-900 tracking-tight tabular-nums">{formatEGP(product.price)}</div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isRTL ? '+ رسوم توصيل عند الدفع (إن اخترت الشحن)' : '+ delivery fee at checkout if you choose courier delivery'}
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-400 pt-3 border-t border-slate-100">
                <span className="flex items-center gap-1.5 font-medium">
                  <MapPin className="w-3.5 h-3.5" />
                  {product.location || (isRTL ? 'مصر' : 'Egypt')}
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  {timeAgo(product.created_at, isRTL)}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">
                  {isRTL ? 'الوصف والتفاصيل' : 'Description'}
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">{product.description}</p>
              </div>
            </div>

            {/* Seller — only claims what is actually true of this seller */}
            <Link
              href={`/seller/${product.seller_id}`}
              className="block bg-white rounded-lg border border-slate-200 p-4 hover:border-brand/40 transition-colors"
            >
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2.5">
                {isRTL ? 'بيانات البائع' : 'Sold By'}
              </h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                  {product.seller?.full_name?.[0]?.toUpperCase() || 'S'}
                </div>
                <div className="min-w-0 flex-1">
                  <SellerBadge
                    name={product.seller?.full_name || (isRTL ? 'بائع في إيجي باي' : 'Egbay Seller')}
                    tier={product.seller?.tier}
                    isVerified={product.seller?.is_verified_seller}
                    ratingAvg={product.seller?.rating_avg}
                    ratingCount={product.seller?.rating_count}
                    size="md"
                  />
                  {!product.seller?.is_verified_seller && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isRTL ? 'لم يتم توثيق الهوية بعد' : 'Identity not yet verified'}
                    </p>
                  )}
                </div>
              </div>
            </Link>

            {!isOwner ? (
              <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2.5">
                {isOutOfStock ? (
                  <div className="w-full bg-slate-100 text-slate-500 font-bold py-3.5 rounded-md text-center flex items-center justify-center gap-2 text-sm">
                    <X className="w-4 h-4" />
                    {isRTL ? 'نفذت الكمية' : 'Out of stock'}
                  </div>
                ) : (
                  <Button href={`/checkout/${product.id}`} fullWidth size="lg" icon={<ShoppingBag className="w-4 h-4" />}>
                    {isRTL ? 'شراء الآن — محمي بالضمان' : 'Buy Now — Escrow Protected'}
                  </Button>
                )}
                <Button variant="outline" fullWidth onClick={handleChat} loading={chatLoading} icon={<MessageCircle className="w-3.5 h-3.5" />}>
                  {isRTL ? 'محادثة البائع' : 'Message Seller'}
                </Button>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2.5">
                <p className="text-center text-xs font-bold text-slate-400 pb-1">
                  {isRTL ? 'هذا إعلانك الشخصي النشط' : 'This is your active listing'}
                </p>
                <Button href={`/boost/${product.id}`} variant="secondary" fullWidth icon={<Zap className="w-4 h-4 text-warning" />}>
                  {isRTL ? 'ترويج الإعلان وزيادة المشاهدات' : 'Boost this listing'}
                </Button>
              </div>
            )}
          </div>
        </div>

        {similar.length > 0 && (
          <div className="mt-12 pt-8 border-t border-slate-200">
            <h2 className="text-base font-black text-slate-900 mb-4">
              {isRTL ? 'إعلانات مشابهة' : `More in ${product.category}`}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {similar.map((p) => (
                <Link key={p.id} href={`/products/${p.id}`} className="group card-hover bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <div className="aspect-square bg-slate-100 relative overflow-hidden">
                    {p.images?.[0] ? (
                      <SmartImage src={p.images[0]} alt={p.title} fill className="object-cover group-hover:scale-105 transition-transform" sizes="200px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Package className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold text-slate-900 line-clamp-1 group-hover:text-brand transition-colors">{p.title}</p>
                    <p className="text-xs font-black text-slate-900 mt-1">{formatEGP(p.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mobile sticky CTA */}
      {!isOwner && !isOutOfStock && (
        <div className="fixed bottom-14 left-0 right-0 z-30 md:hidden bg-white border-t border-slate-200 px-3 py-2.5">
          <Button href={`/checkout/${product.id}`} fullWidth icon={<ShoppingBag className="w-4 h-4" />}>
            {isRTL ? 'شراء الآن بالضمان' : 'Buy Now — Escrow Protected'}
          </Button>
        </div>
      )}
    </div>
  );
}
