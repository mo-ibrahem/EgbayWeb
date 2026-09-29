'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, Package, Zap, MapPin } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { useAuth } from '@/components/AuthProvider';
import { type Product, formatEGP, isPromotionActive, listingImages, usesCataloguePhotos } from '@/lib/products';
import { getOrCreateChatRoom } from '@/lib/chatService';
import { supabase } from '@/lib/supabase';
import { BOOST_BADGE_STYLES } from '@/lib/boostService';
import SmartImage from '@/components/SmartImage';
import { RatingDisplay } from './StarRating';

/**
 * The one product card for Egbay -- home feed, search results, wishlist,
 * seller profile listings all render this same component so a listing
 * looks identical everywhere it appears.
 *
 * A soft white card with the photo inset in its own rounded well, lifting
 * on hover. Condition rides on the photo as a chip so the text block is
 * only price, title, and (when present) rating/location.
 *
 * Price leads and title follows, as in the mobile card. Location appears
 * only when the seller provided it; a generic "Egypt" label adds no value.
 *
 * Fulfilment is disclosed on the listing detail where the buyer commits;
 * it appeared on almost every card and overwhelmed the useful comparison
 * fields. A listing with variants shows a "From" price, since products.price
 * is only its cheapest option.
 */
export default function ProductCard({
  product,
  onWishlistToggle,
  showAsk = false,
  priority = false,
}: {
  product: Product;
  onWishlistToggle?: (id: string, current: boolean) => void | Promise<void>;
  showAsk?: boolean;
  /** Above-the-fold cards: load the photo eagerly (it's the LCP). */
  priority?: boolean;
}) {
  const [wishlisted, setWishlisted] = useState(product.isWishlisted ?? false);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState(false);
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => { setWishlisted(product.isWishlisted ?? false); }, [product.isWishlisted]);

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onWishlistToggle) return;
    const next = !wishlisted;
    setWishlisted(next);
    Promise.resolve(onWishlistToggle(product.id, !next)).catch(() => setWishlisted(!next));
  };

  const imgSrc = listingImages(product)[0] || null;
  const catalogue = usesCataloguePhotos(product);

  const askSeller = async () => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/products/${product.id}`)}`);
      return;
    }
    if (!product.seller_id || product.seller_id === user.id || asking) return;
    setAsking(true);
    setAskError(false);
    try {
      const roomId = await getOrCreateChatRoom(user.id, product.seller_id, product.id);
      const { error } = await supabase.from('messages').insert({
        room_id: roomId,
        sender_id: user.id,
        content: isRTL ? 'هل ما زال متاحاً؟' : 'Is it still available?',
        msg_type: 'text',
      });
      if (error) throw error;
      router.push(`/chat/${roomId}`);
    } catch (error) {
      console.error('Could not ask seller:', error);
      setAskError(true);
    } finally {
      setAsking(false);
    }
  };

  const conditionLabel = product.condition
    ? product.condition === 'New' ? (isRTL ? 'جديد' : 'New') : (isRTL ? 'مستعمل' : product.condition)
    : null;

  return (
    <article className="group relative h-full min-w-0 flex flex-col rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_12px_32px_-12px_rgba(15,23,42,0.22)] hover:ring-slate-300/80">
      <Link href={`/products/${product.id}`} className="flex flex-col flex-1 min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
        {/* Catalogue shots are products cut out on white, so they're shown
            whole (contain) on a soft well; a seller's own photo fills the
            frame (cover), since it's a real scene rather than a cut-out. */}
        <div className="relative m-1.5 mb-0 aspect-square rounded-xl bg-slate-50 overflow-hidden">
          {imgSrc ? (
            <SmartImage
              src={imgSrc}
              alt={product.title}
              fill
              priority={priority}
              className={`${catalogue ? 'object-contain p-5 mix-blend-multiply' : 'object-cover'} transition-transform duration-500 ease-out group-hover:scale-[1.05]`}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <Package className="w-8 h-8 stroke-[1.5]" />
            </div>
          )}

          {isPromotionActive(product) && (() => {
            const style = BOOST_BADGE_STYLES[product.promotion_tier as 'urgent' | 'featured' | 'turbo'] || BOOST_BADGE_STYLES.featured;
            return (
              <span className={`${style.className} absolute top-2 left-2 rtl:left-auto rtl:right-2 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 z-10 shadow-sm`}>
                <Zap className="w-2.5 h-2.5 fill-current" /> {isRTL ? style.label_ar : style.label}
              </span>
            );
          })()}

          {conditionLabel && (
            <span className="absolute bottom-2 left-2 rtl:left-auto rtl:right-2 z-10 rounded-full bg-white/90 backdrop-blur px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 ring-1 ring-slate-900/5">
              {conditionLabel}
            </span>
          )}
        </div>

        {catalogue && (
          <p className="mx-3 mt-1.5 text-[10px] leading-tight text-slate-400 line-clamp-2" title={product.catalogue_credit || undefined}>
            {isRTL ? 'صورة من الكتالوج' : 'Catalogue photo'}
            {product.catalogue_credit && <span dir="ltr"> · {product.catalogue_credit}</span>}
          </p>
        )}

        <div className="flex flex-col flex-1 gap-1 px-3 pt-2 pb-3 min-w-0">
          <div className="flex items-baseline gap-1 min-w-0" dir="ltr">
            {product.has_variants && (
              <span className="text-[11px] font-semibold text-slate-400 me-0.5">{isRTL ? 'من' : 'From'}</span>
            )}
            <span className="text-[11px] font-bold text-slate-400">EGP</span>
            <span className="text-lg font-black tracking-tight tabular-nums text-slate-900 truncate">
              {formatEGP(product.price).replace(/^EGP\s*/, '')}
            </span>
          </div>

          <h3 className="text-[13px] font-semibold text-slate-700 line-clamp-2 leading-snug group-hover:text-slate-900 transition-colors">
            {product.title}
          </h3>

          {(!!product.seller?.rating_count || product.location) && (
            <div className="mt-auto pt-1 flex items-center gap-2 min-w-0 text-[11px] text-slate-400">
              {!!product.seller?.rating_count && (
                <RatingDisplay avg={product.seller.rating_avg} count={product.seller.rating_count} size="xs" />
              )}
              {product.location && (
                <span className="flex items-center gap-1 min-w-0">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{product.location}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </Link>

      {onWishlistToggle && (
        <button
          type="button"
          onClick={handleWishlist}
          aria-label={wishlisted ? (isRTL ? 'إزالة من المحفوظات' : 'Remove saved item') : (isRTL ? 'حفظ الإعلان' : 'Save item')}
          aria-pressed={wishlisted}
          className="absolute top-2.5 right-2.5 rtl:right-auto rtl:left-2.5 z-10 w-11 h-11 flex items-center justify-center"
        >
          <span className={`w-8 h-8 rounded-full flex items-center justify-center bg-white/90 backdrop-blur shadow-sm ring-1 ring-slate-900/5 transition-all duration-200 group-hover:scale-105 ${
            wishlisted ? 'text-danger' : 'text-slate-600 hover:text-danger'
          }`}>
            <Heart className={`w-4 h-4 ${wishlisted ? 'fill-current' : ''}`} />
          </span>
        </button>
      )}

      {showAsk && product.seller_id !== user?.id && (
        <div className="px-3 pb-3 -mt-1">
          <button type="button" onClick={askSeller} disabled={asking}
            className="min-h-10 w-full rounded-full bg-slate-900 hover:bg-brand disabled:opacity-60 text-white text-xs font-bold px-3 whitespace-nowrap truncate transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
            {asking ? (isRTL ? 'جارٍ الإرسال…' : 'Sending…') : askError ? (isRTL ? 'تعذّر الإرسال، حاول مجدداً' : 'Could not send · Retry') : (<><span className="sm:hidden">{isRTL ? 'متاح؟' : 'Still available?'}</span><span className="hidden sm:inline">{isRTL ? 'هل ما زال متاحاً؟' : 'Is it still available?'}</span></>)}
          </button>
        </div>
      )}
    </article>
  );
}
