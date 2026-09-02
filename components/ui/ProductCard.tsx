'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Heart, Package, Zap, MapPin } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { type Product, isPromotionActive } from '@/lib/products';
import { BOOST_BADGE_STYLES } from '@/lib/boostService';
import SmartImage from '@/components/SmartImage';
import PriceTag from './PriceTag';

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
 * Three lines of text, not five. Title and price are what a buyer
 * compares on; governorate matters in Egypt because it decides whether a
 * meetup is even possible. "Posted 3d ago" was dropped -- it pushed the
 * card to five lines and nobody chooses between two listings on it.
 *
 * Weight is inverted from the obvious: the title is quiet and the price
 * is the heaviest thing on the card. Reading order stays title-then-price
 * (the convention on every marketplace, and it matches how people scan
 * "what is it" before "what does it cost"), but the emphasis doesn't.
 *
 * Escrow protection is stated once, globally (hero/footer), not repeated
 * on every card -- it's true of every listing, so per-card it's noise.
 */
export default function ProductCard({
  product,
  onWishlistToggle,
}: {
  product: Product;
  onWishlistToggle?: (id: string, current: boolean) => void;
}) {
  const [wishlisted, setWishlisted] = useState(product.isWishlisted ?? false);
  const { isRTL } = useLanguage();

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onWishlistToggle) return;
    const next = !wishlisted;
    setWishlisted(next);
    onWishlistToggle(product.id, !next);
  };

  const imgSrc = product.images?.[0] || null;

  return (
    <Link href={`/products/${product.id}`} className="group block h-full min-w-0">
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

        {/* Always reachable on touch, where there is no hover to reveal it. */}
        {onWishlistToggle && (
          <button
            onClick={handleWishlist}
            aria-label={isRTL ? 'أضف للمفضلة' : 'Save to wishlist'}
            className={`absolute top-2 right-2 rtl:right-auto rtl:left-2 z-10 w-7 h-7 rounded-full flex items-center justify-center shadow-sm transition-all sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 ${
              wishlisted ? 'bg-danger text-white sm:opacity-100' : 'bg-white/95 text-slate-500 hover:text-danger'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${wishlisted ? 'fill-current' : ''}`} />
          </button>
        )}
      </div>

      <div className="pt-2.5 space-y-1 min-w-0">
        <h3 className="text-xs text-slate-600 line-clamp-2 leading-snug group-hover:text-brand transition-colors">
          {product.title}
        </h3>

        <div className="flex items-baseline gap-1.5 flex-wrap">
          <PriceTag amount={product.price} size="md" />
          {product.condition === 'New' && (
            <span className="text-[10px] font-bold text-success">
              {isRTL ? 'جديد' : 'New'}
            </span>
          )}
        </div>

        <p className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
          <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
          <span className="truncate">{product.location || (isRTL ? 'مصر' : 'Egypt')}</span>
        </p>
      </div>
    </Link>
  );
}
