'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Heart, Package, Zap, MapPin } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { type Product } from '@/lib/products';
import SmartImage from '@/components/SmartImage';
import PriceTag from './PriceTag';

function timeAgo(dateStr?: string, isRTL?: boolean): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isRTL ? 'الآن' : 'Just now';
  if (mins < 60) return isRTL ? `منذ ${mins} د` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isRTL ? `منذ ${hrs} س` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return isRTL ? `منذ ${days} يوم` : `${days}d ago`;
}

/**
 * The one product card for Egbay -- home feed, search results, wishlist,
 * seller profile listings all render this same component so a listing
 * looks identical everywhere it appears. Escrow protection is stated
 * once, globally (navbar/footer trust strip), not repeated on every
 * single card -- repeating it here added visual noise without adding
 * information, since it's true of every listing on the platform.
 */
export default function ProductCard({
  product,
  onWishlistToggle,
}: {
  product: Product;
  onWishlistToggle?: (id: string, current: boolean) => void;
}) {
  const [wishlisted, setWishlisted] = useState(product.isWishlisted ?? false);
  const { isRTL, t } = useLanguage();

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
      <div className="card-hover bg-white rounded-lg overflow-hidden border border-slate-200 flex flex-col h-full min-w-0 relative">
        <div className="relative aspect-square bg-slate-50 overflow-hidden w-full">
          {imgSrc ? (
            <SmartImage
              src={imgSrc}
              alt={product.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400">
              <Package className="w-7 h-7 stroke-[1.5]" />
            </div>
          )}

          <div className="absolute top-2 inset-x-2 flex items-start justify-between z-10">
            <div className="flex flex-col gap-1">
              {product.is_promoted && (
                <span className="bg-brand text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-0.5 w-fit">
                  <Zap className="w-2.5 h-2.5 fill-current" /> {isRTL ? 'مميز' : 'Boosted'}
                </span>
              )}
            </div>

            {onWishlistToggle && (
              <button
                onClick={handleWishlist}
                aria-label={isRTL ? 'أضف للمفضلة' : 'Save to wishlist'}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors shadow-sm flex-shrink-0 ${
                  wishlisted ? 'bg-danger text-white' : 'bg-white/95 text-slate-400 hover:text-danger'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${wishlisted ? 'fill-current' : ''}`} />
              </button>
            )}
          </div>
        </div>

        <div className="p-3 flex flex-col flex-1 gap-1.5">
          <h3 className="text-xs font-semibold text-slate-900 line-clamp-2 leading-snug group-hover:text-brand transition-colors">
            {product.title}
          </h3>

          <div className="mt-auto space-y-1.5">
            <div className="flex items-center gap-1.5">
              <PriceTag amount={product.price} size="sm" />
              {product.condition === 'New' && (
                <span className="text-[9px] font-bold text-success bg-success-soft px-1.5 py-0.5 rounded-sm">
                  {isRTL ? 'جديد' : 'New'}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-0.5 truncate max-w-[90px]">
                <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                {product.location || (isRTL ? 'مصر' : 'Egypt')}
              </span>
              <span className="flex-shrink-0" suppressHydrationWarning>
                {timeAgo(product.created_at, isRTL)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
