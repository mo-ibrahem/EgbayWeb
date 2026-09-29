import React from 'react';

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} />;
}

/** Loading placeholder shaped like ProductCard, so a grid never jumps
 * when real content arrives. */
export function SkeletonProductCard() {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-200/80">
      <div className="m-1.5 mb-0 aspect-square skeleton rounded-xl" />
      <div className="px-3 pt-2.5 pb-3 space-y-1.5">
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-2/3" />
        <SkeletonBlock className="h-4 w-1/2" />
      </div>
    </div>
  );
}
