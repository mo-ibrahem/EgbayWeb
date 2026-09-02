'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Store, BadgeCheck, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { supabase } from '@/lib/supabase';
import { type Product } from '@/lib/products';
import { getSellerReviews, type Review } from '@/lib/reviews';
import ProductCard from '@/components/ui/ProductCard';
import { RatingDisplay, StarRow } from '@/components/ui/StarRating';
import EmptyState from '@/components/ui/EmptyState';
import SmartImage from '@/components/SmartImage';

const TIER_LABEL: Record<number, { en: string; ar: string }> = {
  1: { en: 'Trader', ar: 'بائع' },
  2: { en: 'Verified Trader', ar: 'بائع موثّق' },
  3: { en: 'Pro Store', ar: 'متجر برو' },
};

interface SellerProfile {
  id: string;
  full_name: string;
  avatar_url?: string;
  tier?: number;
  is_verified_seller?: boolean;
  rating_avg?: number | null;
  rating_count?: number;
}

function timeAgo(dateStr: string, isRTL: boolean): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return isRTL ? 'اليوم' : 'today';
  if (days < 30) return isRTL ? `منذ ${days} يوم` : `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return isRTL ? `منذ ${months} شهر` : `${months}mo ago`;
  return isRTL ? `منذ ${Math.floor(months / 12)} سنة` : `${Math.floor(months / 12)}y ago`;
}

/**
 * Public seller profile -- no ProtectedRoute, reachable by a logged-out
 * visitor. This is what a nervous first-time buyer checks before paying
 * a stranger, which is why reviews were built with somewhere public to
 * live at all rather than only inline on product pages.
 */
export default function SellerProfilePage() {
  const { id: sellerId } = useParams<{ id: string }>();
  const { isRTL } = useLanguage();

  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [listings, setListings] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<'listings' | 'reviews'>('listings');

  useEffect(() => {
    if (!sellerId) return;
    (async () => {
      try {
        const [{ data: profile }, { data: products }, reviewList] = await Promise.all([
          supabase
            .from('public_profiles')
            .select('id, full_name, avatar_url, tier, is_verified_seller, rating_avg, rating_count')
            .eq('id', sellerId)
            .maybeSingle(),
          supabase
            .from('products')
            .select('*')
            .eq('seller_id', sellerId)
            .eq('status', 'active')
            .gt('stock', 0)
            .order('created_at', { ascending: false }),
          getSellerReviews(sellerId).catch(() => []),
        ]);

        if (!profile) { setNotFound(true); return; }
        setSeller(profile);
        setListings((products || []) as Product[]);
        setReviews(reviewList);
      } catch (e) {
        console.error('[SellerProfile] Failed to load:', e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [sellerId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !seller) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 py-16">
        <EmptyState
          icon={<Store className="w-6 h-6" />}
          title={isRTL ? 'لم يتم العثور على هذا البائع' : 'Seller not found'}
          description={isRTL ? 'ربما تم حذف الحساب أو الرابط غير صحيح.' : 'This account may have been removed, or the link is incorrect.'}
        />
      </div>
    );
  }

  const tierInfo = seller.tier ? TIER_LABEL[seller.tier] : undefined;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-brand flex items-center justify-center text-white font-black text-2xl flex-shrink-0 overflow-hidden relative">
          {seller.avatar_url ? (
            <SmartImage src={seller.avatar_url} alt={seller.full_name} fill className="object-cover" />
          ) : (
            seller.full_name?.[0]?.toUpperCase() || 'S'
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-black text-slate-900">{seller.full_name || (isRTL ? 'بائع في إيجي باي' : 'Egbay Seller')}</h1>
            {seller.is_verified_seller && (
              <BadgeCheck className="w-5 h-5 text-brand flex-shrink-0" aria-label={isRTL ? 'بائع موثّق' : 'Verified seller'} />
            )}
            {seller.tier === 3 && tierInfo && (
              <span className="text-[11px] font-bold text-warning bg-warning-soft px-2 py-0.5 rounded-sm">
                {isRTL ? tierInfo.ar : tierInfo.en}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <RatingDisplay avg={seller.rating_avg} count={seller.rating_count} size="md" />
            <span className="text-xs text-slate-400">
              {listings.length} {isRTL ? 'إعلان نشط' : listings.length === 1 ? 'active listing' : 'active listings'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md max-w-xs">
        <button
          onClick={() => setTab('listings')}
          className={`flex-1 py-1.5 rounded-sm text-xs font-bold transition-colors ${tab === 'listings' ? 'bg-white text-brand shadow-card' : 'text-slate-500 hover:text-slate-800'}`}
        >
          {isRTL ? `الإعلانات (${listings.length})` : `Listings (${listings.length})`}
        </button>
        <button
          onClick={() => setTab('reviews')}
          className={`flex-1 py-1.5 rounded-sm text-xs font-bold transition-colors ${tab === 'reviews' ? 'bg-white text-brand shadow-card' : 'text-slate-500 hover:text-slate-800'}`}
        >
          {isRTL ? `التقييمات (${reviews.length})` : `Reviews (${reviews.length})`}
        </button>
      </div>

      {tab === 'listings' && (
        listings.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6">
            {listings.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        ) : (
          <EmptyState
            icon={<Store className="w-6 h-6" />}
            title={isRTL ? 'لا توجد إعلانات نشطة حالياً' : 'No active listings right now'}
            className="bg-white border border-slate-200 rounded-lg"
          />
        )
      )}

      {tab === 'reviews' && (
        reviews.length > 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {reviews.map(r => (
              <div key={r.id} className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs flex-shrink-0 overflow-hidden relative">
                      {r.reviewer_avatar ? (
                        <SmartImage src={r.reviewer_avatar} alt={r.reviewer_name || ''} fill className="object-cover" />
                      ) : (
                        r.reviewer_name?.[0]?.toUpperCase() || 'U'
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{r.reviewer_name || (isRTL ? 'مستخدم إيجي باي' : 'EgyBay User')}</p>
                      {r.product_title && <p className="text-[11px] text-slate-400 truncate">{r.product_title}</p>}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 flex-shrink-0">{timeAgo(r.created_at, isRTL)}</span>
                </div>

                <div className="mt-2.5">
                  <StarRow rating={r.rating} size="md" />
                </div>

                {r.comment && (
                  <p className="text-sm text-slate-700 mt-2 leading-relaxed">{r.comment}</p>
                )}

                {r.seller_response && (
                  <div className="mt-3 ml-2 pl-3 border-l-2 border-brand/30 rtl:ml-0 rtl:mr-2 rtl:pl-0 rtl:pr-3 rtl:border-l-0 rtl:border-r-2">
                    <p className="text-[11px] font-bold text-brand flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {isRTL ? 'رد البائع' : "Seller's response"}
                    </p>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{r.seller_response}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Store className="w-6 h-6" />}
            title={isRTL ? 'لا توجد تقييمات بعد' : 'No reviews yet'}
            description={isRTL ? 'التقييمات تظهر هنا بعد إتمام عمليات شراء حقيقية.' : 'Reviews appear here once real purchases are completed.'}
            className="bg-white border border-slate-200 rounded-lg"
          />
        )
      )}
    </div>
  );
}
