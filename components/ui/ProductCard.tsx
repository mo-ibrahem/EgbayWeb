'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, Package, Zap, MapPin } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { useAuth } from '@/components/AuthProvider';
import { type Product, isPromotionActive, listingImages, usesCataloguePhotos } from '@/lib/products';
import { getOrCreateChatRoom } from '@/lib/chatService';
import { supabase } from '@/lib/supabase';
import { BOOST_BADGE_STYLES } from '@/lib/boostService';
import SmartImage from '@/components/SmartImage';
import { RatingDisplay } from './StarRating';

/**
 * The one product card for Egbay, matching the mobile card: the photo sits
 * on the page in its own rounded well (no bordered box around the tile),
 * then price (largest), condition as small meta on the right, and title.
 * In a masonry feed `tall` gives every third photo a 4:5 frame.
 *
 * With `showAsk`, the heart moves off the photo into an action row beside
 * the "Still available?" chip, which sends the question directly -- it
 * never opens an empty composer. Catalogue photos always show their credit.
 */
export default function ProductCard({
  product,
  onWishlistToggle,
  showAsk = false,
  priority = false,
  tall = false,
}: {
  product: Product;
  onWishlistToggle?: (id: string, current: boolean) => void | Promise<void>;
  showAsk?: boolean;
  /** Above-the-fold cards: load the photo eagerly (it's the LCP). */
  priority?: boolean;
  tall?: boolean;
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
  const ask = showAsk && product.seller_id !== user?.id;

  const heart = (onPhoto: boolean) => onWishlistToggle && (
    <button
      type="button"
      onClick={handleWishlist}
      aria-label={wishlisted ? (isRTL ? 'إزالة من المحفوظات' : 'Remove saved item') : (isRTL ? 'حفظ الإعلان' : 'Save item')}
      aria-pressed={wishlisted}
      className={onPhoto
        ? 'absolute top-1 right-1 rtl:right-auto rtl:left-1 z-10 w-11 h-11 flex items-center justify-center'
        : 'shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-slate-300 hover:border-slate-400 flex items-center justify-center transition-colors'}
    >
      <span className={onPhoto ? 'w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm shadow-sm flex items-center justify-center' : 'contents'}>
        <Heart className={`w-4 h-4 transition-colors ${wishlisted ? 'fill-current text-danger' : 'text-slate-900 hover:text-danger'}`} />
      </span>
    </button>
  );

  return (
    <article className="group relative min-w-0">
      <Link href={`/products/${product.id}`} className="block min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
        <div className={`relative ${tall ? 'aspect-[4/5]' : 'aspect-square'} rounded-xl bg-slate-100 overflow-hidden`}>
          {imgSrc ? (
            <SmartImage
              src={imgSrc}
              alt={product.title}
              fill
              priority={priority}
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
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
              <span className={`${style.className} absolute top-2 left-2 rtl:left-auto rtl:right-2 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 z-10`}>
                <Zap className="w-2.5 h-2.5 fill-current" /> {isRTL ? style.label_ar : style.label}
              </span>
            );
          })()}

          {catalogue && (
            <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent text-white px-2 pt-4 pb-1.5 leading-tight">
              <p className="text-[9px] font-bold">{isRTL ? 'صورة من الكتالوج' : 'Catalogue photo'}</p>
              {product.catalogue_credit && <p className="text-[8px] opacity-90 line-clamp-2" dir="ltr">{product.catalogue_credit}</p>}
            </div>
          )}
        </div>

        <div className="pt-2 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="flex items-baseline gap-1 min-w-0" dir="ltr">
              {product.has_variants && <span className="text-[10px] font-bold text-slate-400">{isRTL ? 'من' : 'From'}</span>}
              <span className="text-[19px] font-black tracking-tight tabular-nums text-slate-900 truncate">
                {Math.round(Number(product.price)).toLocaleString('en-EG')}
              </span>
              <span className="text-[10px] font-bold text-slate-400">EGP</span>
            </span>
            {conditionLabel && <span className="shrink-0 text-[10px] font-bold tracking-wider uppercase text-slate-400">{conditionLabel}</span>}
          </div>

          <h3 className="mt-0.5 text-[13px] font-semibold text-slate-900 line-clamp-2 leading-[17px] group-hover:text-brand transition-colors">
            {product.title}
          </h3>

          {!!product.seller?.rating_count && (
            <div className="mt-1"><RatingDisplay avg={product.seller.rating_avg} count={product.seller.rating_count} size="xs" /></div>
          )}

          {product.location && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400 truncate">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{product.location}</span>
            </p>
          )}
        </div>
      </Link>

      {ask ? (
        <div className="mt-2 flex items-center gap-1.5 sm:gap-2.5">
          <button type="button" onClick={askSeller} disabled={asking}
            className="flex-1 min-w-0 h-10 rounded-full bg-slate-900 hover:bg-slate-700 disabled:opacity-60 text-white text-xs sm:text-[12.5px] font-black px-2 whitespace-nowrap truncate transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
            {asking ? (isRTL ? 'جارٍ الإرسال…' : 'Sending…') : askError ? (isRTL ? 'تعذّر الإرسال، أعد المحاولة' : 'Retry') : (isRTL ? 'هل ما زال متاحاً؟' : 'Still available?')}
          </button>
          {heart(false)}
        </div>
      ) : heart(true)}
    </article>
  );
}
