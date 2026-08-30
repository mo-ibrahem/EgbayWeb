'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface FloatingReactionParticle {
  id: string;
  emoji: string;
  xOffset: number; // horizontal drift percentage (0 to 100)
  size: number;
  rotation: number;
}

interface FloatingReactionsProps {
  reactions: FloatingReactionParticle[];
  onRemove: (id: string) => void;
}

export default function FloatingReactions({ reactions, onRemove }: FloatingReactionsProps) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      <AnimatePresence>
        {reactions.map(r => (
          <motion.div
            key={r.id}
            initial={{
              opacity: 0,
              scale: 0.5,
              y: 0,
              x: `${r.xOffset}%`,
              rotate: 0,
            }}
            animate={{
              opacity: [0, 1, 1, 0.8, 0],
              scale: [0.5, 1.25, 1, 1.1, 0.9],
              y: -420,
              x: [
                `${r.xOffset}%`,
                `${r.xOffset + (Math.sin(r.size) * 15)}%`,
                `${r.xOffset - (Math.cos(r.size) * 15)}%`,
                `${r.xOffset + (Math.sin(r.size) * 20)}%`
              ],
              rotate: r.rotation,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 2.8,
              ease: [0.25, 0.1, 0.25, 1],
            }}
            onAnimationComplete={() => onRemove(r.id)}
            className="absolute bottom-20 select-none filter drop-shadow-md"
            style={{
              fontSize: `${r.size}px`,
              right: '24px', // Aligns to the right side like TikTok/Instagram Live
            }}
          >
            {r.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
