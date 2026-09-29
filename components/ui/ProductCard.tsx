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
import PriceTag from './PriceTag';
import { RatingDisplay } from './StarRating';

/**
 * The one product card for Egbay -- home feed, search results, wishlist,
 * seller profile listings all render this same component so a listing
 * looks identical everywhere it appears.
 *
 * Deliberately borderless: the image sits in its own rounded well and the
 * text sits directly on the page, rather than the whole thing living in a
 * bordered white box. A grid of bordered boxes reads as a wall of
 * containers -- the product photography is what people actually scan, and
 * chrome around every tile competes with it. This is the one structural
 * thing worth taking from how the large marketplaces render a grid.
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
}: {
  product: Product;
  onWishlistToggle?: (id: string, current: boolean) => void | Promise<void>;
  showAsk?: boolean;
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

  return (
    <article className="group relative h-full min-w-0">
      <Link href={`/products/${product.id}`} className="block min-w-0">
      {/* White well, not a grey one: the page sits on #F7F8FA, so white
          is what separates the image from the page here. (Marketplaces on
          a white page do the reverse and tint the well grey -- it's the
          contrast relationship that matters, not the specific value.) */}
      <div className="relative aspect-square rounded-lg bg-white border border-slate-200/70 overflow-hidden">
        {imgSrc ? (
          <SmartImage
            src={imgSrc}
            alt={product.title}
            fill
            className="object-cover group-hover:scale-[1.04] transition-transform duration-500 ease-out"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Package className="w-8 h-8 stroke-[1.5]" />
          </div>
        )}

        {catalogue && (
          <div className="absolute inset-x-0 bottom-0 bg-black/65 text-white px-1.5 py-1 z-10 leading-tight">
            <p className="text-[9px] font-bold">{isRTL ? 'صورة من الكتالوج' : 'Catalogue photo'}</p>
            {product.catalogue_credit && <p className="text-[8px] opacity-90 line-clamp-2" dir="ltr">{product.catalogue_credit}</p>}
          </div>
        )}

        {isPromotionActive(product) && (() => {
          const style = BOOST_BADGE_STYLES[product.promotion_tier as 'urgent' | 'featured' | 'turbo'] || BOOST_BADGE_STYLES.featured;
          return (
            <span
              className={`${style.className} absolute top-2 left-2 rtl:left-auto rtl:right-2 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-0.5 z-10`}
            >
              <Zap className="w-2.5 h-2.5 fill-current" /> {isRTL ? style.label_ar : style.label}
            </span>
          );
        })()}

      </div>

      <div className="pt-2.5 space-y-1 min-w-0">
        <div className="flex items-baseline justify-between gap-1.5 flex-wrap">
          <span className="flex items-baseline gap-1.5">
          {product.has_variants && (
            <span className="text-[10px] font-bold text-slate-400">{isRTL ? 'من' : 'From'}</span>
          )}
          <PriceTag amount={product.price} size="md" />
          </span>
          {product.condition && <span className="text-[10px] font-bold tracking-wide uppercase text-slate-400">{product.condition === 'New' ? (isRTL ? 'جديد' : 'New') : (isRTL ? 'مستعمل' : product.condition)}</span>}
        </div>

        <h3 className="text-[13px] font-semibold text-slate-900 line-clamp-2 leading-snug group-hover:text-brand transition-colors">
          {product.title}
        </h3>

        {!!product.seller?.rating_count && (
          <RatingDisplay avg={product.seller.rating_avg} count={product.seller.rating_count} size="xs" />
        )}

        {product.location && (
          <p className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
            <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
            <span className="truncate">{product.location}</span>
          </p>
        )}
      </div>
      </Link>
      {onWishlistToggle && (
        <button
          type="button"
          onClick={handleWishlist}
          aria-label={wishlisted ? (isRTL ? 'إزالة من المحفوظات' : 'Remove saved item') : (isRTL ? 'حفظ الإعلان' : 'Save item')}
          aria-pressed={wishlisted}
          className={`absolute top-2 right-2 rtl:right-auto rtl:left-2 z-10 w-11 h-11 rounded-full flex items-center justify-center shadow-sm transition-all ${
            wishlisted ? 'bg-white text-danger' : 'bg-white/95 text-slate-700 hover:text-danger'
          }`}
        >
          <Heart className={`w-4 h-4 ${wishlisted ? 'fill-current' : ''}`} />
        </button>
      )}
      {showAsk && product.seller_id !== user?.id && (
        <button type="button" onClick={askSeller} disabled={asking}
          className="mt-2 min-h-11 w-full rounded-full bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold px-3">
          {asking ? (isRTL ? 'جارٍ الإرسال…' : 'Sending…') : askError ? (isRTL ? 'تعذّر الإرسال، حاول مجدداً' : 'Could not send · Retry') : (isRTL ? 'هل ما زال متاحاً؟' : 'Is it still available?')}
        </button>
      )}
    </article>
  );
}
