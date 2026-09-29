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
 * The mobile feed's masonry, on the web. Cards go round-robin across lanes
 * so reading order stays left-to-right, and heights follow a checkerboard
 * (tall/short alternating down each lane, offset lane to lane) -- varied,
 * but a rhythm the eye can predict rather than random-looking jumps.
 * With `askChip`, one card every other row carries "Still available?",
 * stepping one lane over each time so the chips run diagonally.
 */
export default function ProductMasonry({
  products,
  onWishlistToggle,
  askChip = false,
  priorityCount = 0,
}: {
  products: Product[];
  onWishlistToggle?: (id: string, current: boolean) => void | Promise<void>;
  askChip?: boolean;
  priorityCount?: number;
}) {
  const n = useSyncExternalStore(subscribe, laneCount, () => 2);

  const lanes = useMemo(() => {
    const L: { product: Product; tall: boolean; ask: boolean }[][] = Array.from({ length: n }, () => []);
    products.forEach((product, seq) => {
      const lane = seq % n, row = Math.floor(seq / n);
      L[lane].push({
        product,
        tall: (row + lane) % 2 === 0,
        ask: askChip && row % 2 === 0 && lane === (row / 2) % n,
      });
    });
    return L;
  }, [products, n, askChip]);

  return (
    <div className="flex items-start gap-4 sm:gap-6 lg:gap-8">
      {lanes.map((lane, li) => (
        <div key={li} className="flex-1 min-w-0 flex flex-col gap-8 sm:gap-10">
          {lane.map(({ product, tall, ask }, row) => (
            <ProductCard
              key={product.id}
              product={product}
              tall={tall}
              onWishlistToggle={onWishlistToggle}
              showAsk={ask}
              priority={row * n + li < priorityCount}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
