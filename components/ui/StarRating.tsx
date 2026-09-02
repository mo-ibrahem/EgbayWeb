'use client';

import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

/**
 * Read-only rating display. count === 0 (or avg is null/undefined) shows
 * a "New seller" chip instead of stars -- never a 0.0 or an empty
 * five-star outline. Both read as a bad score to a buyer; an absent
 * rating is a neutral fact, not a bad one, and burying every new seller
 * under an established one is exactly the wrong instinct on a
 * supply-constrained marketplace.
 */
export function RatingDisplay({
  avg,
  count,
  size = 'sm',
  className = '',
}: {
  avg?: number | null;
  count?: number;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  const { isRTL } = useLanguage();
  const starSize = size === 'xs' ? 'w-3 h-3' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const textSize = size === 'xs' ? 'text-[10px]' : size === 'sm' ? 'text-xs' : 'text-sm';

  if (!avg || !count) {
    return (
      <span className={`inline-flex items-center ${textSize} font-semibold text-brand bg-brand-soft px-1.5 py-0.5 rounded-sm ${className}`}>
        {isRTL ? 'بائع جديد' : 'New seller'}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 ${textSize} font-bold text-slate-700 ${className}`}>
      <Star className={`${starSize} fill-warning text-warning flex-shrink-0`} />
      {avg.toFixed(1)}
      <span className="font-normal text-slate-400">
        ({count})
      </span>
    </span>
  );
}

/**
 * Static five-star row showing what rating a specific review gave --
 * not interactive. Distinct from RatingDisplay (which shows the
 * seller's aggregate as "4.8 (12)" in a compact badge) and from
 * StarRatingInput below (a picker) -- using the picker with a no-op
 * onChange to display an existing rating would still show hover/click
 * affordances for something that isn't clickable.
 */
export function StarRow({ rating, size = 'sm' }: { rating: number; size?: 'xs' | 'sm' | 'md' }) {
  const starSize = size === 'xs' ? 'w-3 h-3' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={`${starSize} ${n <= rating ? 'fill-warning text-warning' : 'text-slate-200'}`} />
      ))}
    </span>
  );
}

/**
 * Interactive 1-5 star picker for submitting/editing a review.
 */
export function StarRatingInput({
  value,
  onChange,
  size = 'md',
}: {
  value: number;
  onChange: (rating: number) => void;
  size?: 'md' | 'lg';
}) {
  const [hovered, setHovered] = useState(0);
  const starSize = size === 'lg' ? 'w-9 h-9' : 'w-6 h-6';

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = hovered ? n <= hovered : n <= value;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHovered(n)}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className="transition-transform hover:scale-110"
          >
            <Star className={`${starSize} ${filled ? 'fill-warning text-warning' : 'text-slate-200'} transition-colors`} />
          </button>
        );
      })}
    </div>
  );
}
