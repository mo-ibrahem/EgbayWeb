import React from 'react';

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} />;
}

/** Loading placeholder shaped like ProductCard, so a grid never jumps
 * when real content arrives. */
export function SkeletonProductCard() {
  return (
    <div>
      <div className="aspect-square skeleton rounded-lg" />
      <div className="pt-2.5 space-y-1.5">
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-2/3" />
        <SkeletonBlock className="h-4 w-1/2" />
      </div>
    </div>
  );
}
