import React from 'react';

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} />;
}

/** Loading placeholder shaped like ProductCard, so a grid never jumps
 * when real content arrives. */
export function SkeletonProductCard() {
  return (
    <div className="bg-white rounded-lg overflow-hidden border border-slate-200">
      <div className="aspect-square skeleton" />
      <div className="p-3 space-y-2">
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-2/3" />
        <SkeletonBlock className="h-4 w-1/2 mt-1" />
      </div>
    </div>
  );
}
