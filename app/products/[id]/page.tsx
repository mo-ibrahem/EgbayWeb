'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import SmartImage from '@/components/SmartImage';
import {
  ArrowLeft, Heart, Share2, ShieldCheck, Truck, MapPin, Clock,
  MessageCircle, ShoppingBag, Star, ChevronLeft, ChevronRight,
  Zap, Package, Tag, Info, Flag, CheckCircle2, AlertCircle, Sparkles
} from 'lucide-react';
import { productService, formatEGP, type Product } from '@/lib/products';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function SkeletonDetail() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8 animate-pulse">
      <div className="aspect-square bg-slate-100 rounded-3xl" />
      <div className="space-y-4">
        <div className="h-4 bg-slate-200 rounded w-1/4" />
        <div className="h-8 bg-slate-200 rounded" />
        <div className="h-8 bg-slate-200 rounded w-2/3" />
        <div className="h-12 bg-slate-200 rounded" />
        <div className="h-24 bg-slate-200 rounded" />
        <div className="h-14 bg-slate-200 rounded" />
      </div>
    </div>
  );
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [similar, setSimilar] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);
  const [wishlisted, setWishlisted] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerSent, setOfferSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const p = await productService.getProductById(id);
        if (!p) { router.push('/'); return; }
        setProduct(p);
        setWishlisted(p.isWishlisted ?? false);
        const sim = await productService.getSimilarProducts(p.category, id);
        setSimilar(sim);
      } catch {
        router.push('/');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  const handleWishlist = async () => {
    if (!user) { router.push('/login'); return; }
    const next = !wishlisted;
    setWishlisted(next);
    try {
      if (next) await productService.addToWishlist(id);
      else await productService.removeFromWishlist(id);
    } catch {
      setWishlisted(!next);
    }
  };

  const handleChat = async () => {
    if (!user) { router.push('/login'); return; }
    if (!product || product.seller_id === user.id) return;
    setChatLoading(true);
    try {
      const participants = [user.id, product.seller_id].sort();
      const { data: existing } = await supabase
        .from('chat_rooms').select('id').contains('participant_ids', participants).single();
      let roomId: string;
      if (existing) {
        roomId = existing.id;
      } else {
        const { data: newRoom } = await supabase
          .from('chat_rooms').insert({ participant_ids: participants }).select('id').single();
        roomId = newRoom!.id;
      }
      router.push(`/chat/${roomId}`);
    } catch { setChatLoading(false); }
  };

  const handleOffer = async () => {
    if (!user) { router.push('/login'); return; }
    if (!offerAmount || !product) return;
    try {
      const participants = [user.id, product.seller_id].sort();
      const { data: existing } = await supabase
        .from('chat_rooms').select('id').contains('participant_ids', participants).single();
      let roomId: string;
      if (existing) { roomId = existing.id; }
      else {
        const { data: nr } = await supabase.from('chat_rooms').insert({ participant_ids: participants }).select('id').single();
        roomId = nr!.id;
      }
      await supabase.from('messages').insert({
        room_id: roomId,
        sender_id: user.id,
        content: `Offer: I would like to offer EGP ${Number(offerAmount).toLocaleString('en-EG')} for "${product.title}"`,
      });
      setOfferSent(true);
      setTimeout(() => { setOfferOpen(false); setOfferSent(false); setOfferAmount(''); }, 2000);
    } catch { /* ignore */ }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: product?.title, url });
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const images = product?.images || [];
  const hasImages = images.length > 0;

  if (loading) return <SkeletonDetail />;
  if (!product) return null;

  const isOwner = user?.id === product.seller_id;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation Breadcrumb */}
      <div className="bg-white border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2.5 text-xs text-slate-500">
          <button onClick={() => router.back()} className="flex items-center gap-1 font-bold text-slate-700 hover:text-blue-600 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <span className="text-slate-300">/</span>
          <Link href={`/?category=${encodeURIComponent(product.category)}`} className="hover:text-blue-600 transition-colors">
            {product.category}
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-800 font-medium truncate max-w-[240px]">{product.title}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-sm">
              <div className="relative aspect-square bg-slate-100 overflow-hidden">
                <AnimatePresence mode="wait">
                  {hasImages ? (
                    <motion.div
                      key={imgIdx}
                      initial={{ opacity: 0, scale: 1.03 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="w-full h-full relative"
                    >
                      <SmartImage
                        src={images[imgIdx]}
                        alt={product.title}
                        fill
                        className="object-contain"
                        sizes="(max-width: 1024px) 100vw, 60vw"
                        priority
                      />
                    </motion.div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                      <Package className="w-16 h-16 stroke-[1.5]" />
                      <span className="text-xs font-semibold mt-2">Image Not Available</span>
                    </div>
                  )}
                </AnimatePresence>

                {images.length > 1 && (
                  <>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-all text-slate-700 z-10"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setImgIdx(i => (i + 1) % images.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-all text-slate-700 z-10"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </motion.button>
                  </>
                )}

                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  {product.is_promoted && (
                    <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                      <Zap className="w-3.5 h-3.5 fill-current" /> BOOSTED LISTING
                    </span>
                  )}
                  {product.condition === 'New' && (
                    <span className="bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                      BRAND NEW
                    </span>
                  )}
                </div>

                <div className="absolute top-4 right-4 flex flex-col gap-2">
                  <button
                    onClick={handleWishlist}
                    className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-110 ${
                      wishlisted ? 'bg-rose-500 text-white' : 'bg-white/90 text-slate-500 hover:text-rose-500 hover:bg-white'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${wishlisted ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={handleShare}
                    className="w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-md text-slate-500 hover:text-blue-600 transition-all hover:scale-110"
                  >
                    {copied ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Share2 className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {images.length > 1 && (
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 p-3">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setImgIdx(i)}
                      className={`relative w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 border-2 transition-all bg-white ${
                        imgIdx === i ? 'border-blue-600 ring-2 ring-blue-500/30 scale-105' : 'border-slate-200 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <SmartImage
                        src={img}
                        alt={`Thumbnail ${i + 1}`}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Escrow Guarantee Highlight */}
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 rounded-3xl p-5 shadow-sm">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-600/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-950 text-sm">Egypt Escrow Security Guarantee</h3>
                  <p className="text-emerald-800 text-xs mt-1 leading-relaxed">
                    Your money stays locked safely in escrow until you inspect your package upon delivery or verify the in-person handover PIN. If the item doesn’t match description, you receive a full refund.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Details & Buying Action Column (2 cols) ─── */}
          <div className="lg:col-span-2 space-y-5">
            {/* Header Info Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
                  {product.category}
                </span>
                <span className={`text-xs font-bold px-3 py-1 rounded-lg ${
                  product.condition === 'New' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
                }`}>
                  {product.condition}
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                {product.title}
              </h1>

              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-black text-slate-900">
                  {formatEGP(product.price)}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-100">
                <span className="flex items-center gap-1.5 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {product.location || 'Egypt'}
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {timeAgo(product.created_at)}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Description</h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            </div>

            {/* Seller Information */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Listed by Seller</h3>
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md shadow-blue-500/20">
                  {product.seller?.full_name?.[0]?.toUpperCase() || 'S'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 text-sm truncate">{product.seller?.full_name || 'Verified Seller'}</p>
                  <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Identity & Phone Verified
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-amber-50 text-amber-800 px-2.5 py-1 rounded-xl text-xs font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>4.9</span>
                </div>
              </div>
            </div>

            {/* CTA Buttons (Escrow Buy Now & Offer) */}
            {!isOwner ? (
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-3">
                <Link
                  href={`/checkout/${product.id}`}
                  className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 text-sm hover:scale-[1.01] active:scale-[0.99]"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>BUY NOW — ESCROW PROTECTED</span>
                </Link>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setOfferOpen(true)}
                    className="flex items-center justify-center gap-2 border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 text-slate-800 font-bold py-3 rounded-xl transition-all text-xs"
                  >
                    <Tag className="w-3.5 h-3.5 text-blue-600" /> Make an Offer
                  </button>
                  <button
                    onClick={handleChat}
                    disabled={chatLoading}
                    className="flex items-center justify-center gap-2 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800 font-bold py-3 rounded-xl transition-all text-xs"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-slate-600" /> {chatLoading ? 'Loading...' : 'Message Seller'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-3">
                <div className="text-center pb-2">
                  <span className="text-xs font-bold text-slate-400">This is your active listing</span>
                </div>
                <Link
                  href={`/boost/${product.id}`}
                  className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3.5 rounded-2xl shadow-md text-xs transition-all"
                >
                  <Zap className="w-4 h-4" /> Boost Listing with Promotion
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Similar Listings */}
        {similar.length > 0 && (
          <div className="mt-14 pt-8 border-t border-slate-200/80">
            <h2 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" /> Similar Products in {product.category}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
              {similar.map((p) => (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="group bg-white rounded-2xl border border-slate-200/80 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all"
                >
                  <div className="aspect-square bg-slate-100 relative overflow-hidden">
                    {p.images?.[0] ? (
                      <Image
                        src={p.images[0]}
                        alt={p.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                        unoptimized={p.images[0]?.toLowerCase().includes('.heic')}
                        sizes="200px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Package className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors">{p.title}</p>
                    <p className="text-xs font-black text-slate-900 mt-1">{formatEGP(p.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Offer Modal */}
      <AnimatePresence>
        {offerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setOfferOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-base font-black text-slate-900 mb-1">Make an Offer</h3>
              <p className="text-xs text-slate-500 mb-5">Original listing price: <strong>{formatEGP(product.price)}</strong></p>

              {offerSent ? (
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm py-4">
                  <CheckCircle2 className="w-5 h-5" /> Offer sent to seller via chat!
                </div>
              ) : (
                <>
                  <div className="relative mb-4">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">EGP</span>
                    <input
                      type="number"
                      value={offerAmount}
                      onChange={e => setOfferAmount(e.target.value)}
                      placeholder="Enter your proposed price"
                      className="w-full border-2 border-slate-200 rounded-xl pl-14 pr-4 py-3 text-base font-bold outline-none focus:border-blue-500"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2.5">
                    <button onClick={() => setOfferOpen(false)} className="flex-1 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs hover:bg-slate-50">
                      Cancel
                    </button>
                    <button onClick={handleOffer} disabled={!offerAmount} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition-colors">
                      Send Offer
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
