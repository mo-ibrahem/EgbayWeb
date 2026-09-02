'use client';

import React from 'react';
import { BadgeCheck, Store } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

const TIER_LABEL: Record<number, { en: string; ar: string }> = {
  1: { en: 'Trader', ar: 'بائع' },
  2: { en: 'Verified Trader', ar: 'بائع موثّق' },
  3: { en: 'Pro Store', ar: 'متجر برو' },
};

/**
 * Seller trust display -- name plus, only when the data actually says
 * so, a verified checkmark and tier label. This never defaults to
 * "verified": no tier/is_verified_seller data in means no badge out.
 * That data comes from the public_profiles view (id, full_name,
 * avatar_url, tier, is_verified_seller) -- see lib/products.ts.
 */
export default function SellerBadge({
  name,
  tier,
  isVerified,
  size = 'sm',
  className = '',
}: {
  name: string;
  tier?: number;
  isVerified?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const { isRTL } = useLanguage();
  const textSize = size === 'sm' ? 'text-[11px]' : 'text-xs';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const tierInfo = tier ? TIER_LABEL[tier] : undefined;

  return (
    <span className={`inline-flex items-center gap-1 ${textSize} font-semibold text-slate-600 ${className}`}>
      <Store className={`${iconSize} text-slate-400 flex-shrink-0`} />
      <span className="truncate max-w-[140px]">{name}</span>
      {isVerified && (
        <BadgeCheck className={`${iconSize} text-brand flex-shrink-0`} aria-label={isRTL ? 'بائع موثّق' : 'Verified seller'} />
      )}
      {tier === 3 && tierInfo && (
        <span className="text-warning font-bold flex-shrink-0">{isRTL ? tierInfo.ar : tierInfo.en}</span>
      )}
    </span>
  );
}
