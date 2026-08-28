'use client';

import React, { useEffect, useRef } from 'react';
import { animate } from 'animejs';

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}

export default function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  duration = 600,
  className = '',
}: AnimatedNumberProps) {
  const numRef = useRef<HTMLSpanElement>(null);
  const prevValRef = useRef<number>(0);

  useEffect(() => {
    if (!numRef.current) return;
    const obj = { val: prevValRef.current };

    try {
      animate(obj, {
        val: value,
        duration: duration / 1000,
        ease: 'outExpo',
        onUpdate: () => {
          if (numRef.current) {
            numRef.current.textContent = `${prefix}${Math.round(obj.val).toLocaleString('en-EG')}${suffix}`;
          }
        },
      });
    } catch {
      // Fallback
      if (numRef.current) {
        numRef.current.textContent = `${prefix}${Math.round(value).toLocaleString('en-EG')}${suffix}`;
      }
    }

    prevValRef.current = value;
  }, [value, prefix, suffix, duration]);

  return (
    <span ref={numRef} className={className} suppressHydrationWarning>
      {prefix}{Math.round(value).toLocaleString('en-EG')}{suffix}
    </span>
  );
}
