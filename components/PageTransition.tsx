'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';

/**
 * Wraps every page for route-change transitions.
 *
 * The wrapper is deliberately NOT a flex container. It sits between
 * <main> and every page, so making it `flex flex-col` silently turned
 * each page's root element into a flex item -- and a flex item with
 * `mx-auto` resolves its width to fit-content rather than stretching.
 * That meant any page whose root was `max-w-*xl mx-auto` (orders,
 * wallet, live, boost, seller verification, admin, terms, privacy)
 * shrink-wrapped to its content instead of filling its max-width, while
 * pages that happened to also set `w-full` (home, profile) looked fine.
 * max-width is only an upper bound -- nothing was asking those elements
 * to fill it.
 *
 * Pages needing full height set it explicitly (min-h-screen / h-screen),
 * so none of them depend on this being a flex column.
 *
 * `mode="wait"` keeps the outgoing page mounted and animating for the
 * full 240ms exit, which desyncs Next's own scroll-to-top-on-navigation
 * from the actual DOM swap -- it fires against the old page, which is
 * still what's on screen, so it has no visible effect and the previous
 * scroll offset just carries over onto the new page. Landing scrolled
 * down (or, on a shorter destination page, clamped near/at its bottom)
 * after every navigation is that carry-over, not a deliberate scroll --
 * it looks page-dependent and random because it depends on how far down
 * the previous page you were and how tall the new one is. Resetting in
 * onExitComplete fires in the gap between the old page finishing its
 * exit and the new one mounting, which is the only point on this timeline
 * where the reset can't be visible as a jump.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence
      mode="wait"
      initial={false}
      onExitComplete={() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' })}
    >
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 10, scale: 0.996 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.996 }}
        transition={{
          duration: 0.24,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="w-full flex-1"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
