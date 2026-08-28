'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Package, Loader2 } from 'lucide-react';

interface SmartImageProps {
  src?: string | null;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

// Global in-memory cache for converted HEIC image blobs
const heicCache = new Map<string, string>();

export default function SmartImage({
  src,
  alt,
  fill,
  width,
  height,
  className = '',
  sizes,
  priority,
}: SmartImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [loadingHeic, setLoadingHeic] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src) {
      setResolvedSrc(null);
      return;
    }

    const isHeic = src.toLowerCase().endsWith('.heic') || src.toLowerCase().includes('.heic?') || src.toLowerCase().endsWith('.heif');

    if (!isHeic) {
      setResolvedSrc(src);
      setHasError(false);
      return;
    }

    // Check in-memory cache first
    if (heicCache.has(src)) {
      setResolvedSrc(heicCache.get(src)!);
      setHasError(false);
      return;
    }

    // Convert HEIC to JPEG in browser
    let isCancelled = false;
    setLoadingHeic(true);

    (async () => {
      try {
        const response = await fetch(src);
        const blob = await response.blob();
        if (isCancelled) return;

        // Dynamic import heic2any so it only loads on the client when needed
        const heic2anyModule = await import('heic2any');
        const heic2any = heic2anyModule.default || heic2anyModule;

        const convertedBlob = await heic2any({
          blob,
          toType: 'image/jpeg',
          quality: 0.85,
        });

        const singleBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        const objectUrl = URL.createObjectURL(singleBlob);

        heicCache.set(src, objectUrl);

        if (!isCancelled) {
          setResolvedSrc(objectUrl);
          setHasError(false);
        }
      } catch (err) {
        console.warn('[SmartImage] Failed to convert HEIC image:', err);
        if (!isCancelled) {
          // Fallback to original URL
          setResolvedSrc(src);
        }
      } finally {
        if (!isCancelled) {
          setLoadingHeic(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [src]);

  if (loadingHeic) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600 mb-1" />
        <span className="text-[10px] font-semibold text-slate-500">Decoding image...</span>
      </div>
    );
  }

  if (hasError || !resolvedSrc) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400">
        <Package className="w-10 h-10 stroke-[1.5]" />
        <span className="text-[11px] font-semibold mt-1">Listing Image</span>
      </div>
    );
  }

  if (fill) {
    return (
      <Image
        src={resolvedSrc}
        alt={alt}
        fill
        className={className}
        sizes={sizes}
        priority={priority}
        unoptimized={resolvedSrc.startsWith('blob:') || resolvedSrc.toLowerCase().includes('.heic')}
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      width={width || 300}
      height={height || 300}
      className={className}
      priority={priority}
      unoptimized={resolvedSrc.startsWith('blob:') || resolvedSrc.toLowerCase().includes('.heic')}
      onError={() => setHasError(true)}
    />
  );
}
