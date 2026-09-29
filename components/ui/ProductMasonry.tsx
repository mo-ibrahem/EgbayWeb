'use client';

import React, { useMemo, useSyncExternalStore } from 'react';
import type { Product } from '@/lib/products';
import ProductCard from './ProductCard';

// Lane count per Tailwind breakpoint (sm / lg / xl), same steps the grids used.
const QUERIES: [string, number][] = [['(min-width: 1280px)', 5], ['(min-width: 1024px)', 4], ['(min-width: 640px)', 3]];

function subscribe(cb: () => void) {
  const mqs = QUERIES.map(([q]) => window.matchMedia(q));
  mqs.forEach(m => m.addEventListener('change', cb));
  return () => mqs.forEach(m => m.removeEventListener('change', cb));
}
const laneCount = () => QUERIES.find(([q]) => window.matchMedia(q).matches)?.[1] ?? 2;

/**
 * The mobile feed's masonry, on the web: lanes filled shortest-first so the
 * reading order stays left-to-right, every third photo is tall for rhythm,
 * and (when `askEvery` is set) every Nth card in reading order carries the
 * "Still available?" chip. CSS columns would fill top-to-bottom instead,
 * scattering the newest listings down the first column.
 */
export default function ProductMasonry({
  products,
  onWishlistToggle,
  askEvery,
  priorityCount = 0,
}: {
  products: Product[];
  onWishlistToggle?: (id: string, current: boolean) => void | Promise<void>;
  askEvery?: number;
  priorityCount?: number;
}) {
  const n = useSyncExternalStore(subscribe, laneCount, () => 2);

  const lanes = useMemo(() => {
    const L: { product: Product; tall: boolean; seq: number }[][] = Array.from({ length: n }, () => []);
    const h = new Array(n).fill(0);
    products.forEach((product, seq) => {
      const tall = seq % 3 === 0;
      const k = h.indexOf(Math.min(...h));
      L[k].push({ product, tall, seq });
      h[k] += tall ? 1.3 : 1;
    });
    return L;
  }, [products, n]);

  return (
    <div className="flex items-start gap-3 sm:gap-5">
      {lanes.map((lane, li) => (
        <div key={li} className="flex-1 min-w-0 flex flex-col gap-5 sm:gap-7">
          {lane.map(({ product, tall, seq }) => (
            <ProductCard
              key={product.id}
              product={product}
              tall={tall}
              onWishlistToggle={onWishlistToggle}
              showAsk={!!askEvery && seq % askEvery === 0}
              priority={seq < priorityCount}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
