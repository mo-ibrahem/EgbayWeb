import React from 'react';
import { formatEGP } from '@/lib/products';

const SIZE_CLASSES = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-2xl',
};

/**
 * The one price display for Egbay. Always bold, always formatted through
 * formatEGP (EGP with thousands separators) so a price never renders
 * differently on a product card vs. checkout vs. an order.
 */
export default function PriceTag({
  amount,
  size = 'md',
  muted = false,
  className = '',
}: {
  amount: number | string;
  size?: keyof typeof SIZE_CLASSES;
  muted?: boolean;
  className?: string;
}) {
  return (
    <span className={`font-black tracking-tight tabular-nums ${muted ? 'text-slate-500' : 'text-slate-900'} ${SIZE_CLASSES[size]} ${className}`}>
      {formatEGP(amount)}
    </span>
  );
}
