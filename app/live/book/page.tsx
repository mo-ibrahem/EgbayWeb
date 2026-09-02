'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Video, Wallet, CheckCircle2, AlertCircle, Zap, ChevronRight } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  LIVE_PASSES,
  bookLiveSession,
  type LivePassTier,
} from '@/lib/liveService';
import { getUserWallet } from '@/lib/walletService';
import { productService, type Product } from '@/lib/products';

const CATEGORIES = [
  { value: 'Electronics', label: 'Electronics', label_ar: 'إلكترونيات' },
  { value: 'Fashion', label: 'Fashion', label_ar: 'أزياء وأحذية' },
  { value: 'Home', label: 'Home & Living', label_ar: 'أثاث ومنزل' },
  { value: 'Sports', label: 'Sports', label_ar: 'رياضة ولياقة' },
  { value: 'Toys', label: 'Toys & Kids', label_ar: 'ألعاب وأطفال' },
  { value: 'Automotive', label: 'Automotive', label_ar: 'سيارات' },
];

function BookLiveContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { isRTL } = useLanguage();

  const [selectedTier, setSelectedTier] = useState<LivePassTier>('pro');
  const [title, setTitle] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [balance, setBalance] = useState(0);
  const [listings, setListings] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [wallet, prods] = await Promise.all([
          getUserWallet(user.id),
          productService.getProductsBySeller(user.id),
        ]);
        setBalance(wallet?.available_balance ?? 0);
        setListings(prods?.filter(p => p.status === 'active') ?? []);
      } catch (err) {
        console.error('[LiveBook] Failed to load wallet/listings:', err);
        setError(isRTL ? 'تعذر تحميل رصيد المحفظة والإعلانات. حاول تحديث الصفحة.' : 'Failed to load your wallet balance and listings. Try refreshing the page.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, isRTL]);

  const selectedPass = LIVE_PASSES.find(p => p.tier === selectedTier)!;
  const canAfford = balance >= selectedPass.priceEGP;

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !canAfford) return;
    setBooking(true);
    setError('');
    try {
      const session = await bookLiveSession({
        title: title.trim(),
        titleAr: titleAr.trim() || undefined,
        description: description.trim() || undefined,
        tier: selectedTier,
        category,
      });
      router.push(`/live/studio?session=${session.id}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to book session');
    } finally {
      setBooking(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#3665F3] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-red-600 text-white text-xs font-black px-3 py-1 rounded-full mb-3 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-white" />
          LIVE SELLING — بث مباشر للتجار
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
          {isRTL ? 'احجز جلسة البث المباشر' : 'Book a Live Show'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isRTL
            ? 'اختر الباقة المناسبة، ادفع من محفظتك، وابدأ البيع المباشر فوراً مع حماية الضمان.'
            : 'Pick your pass, pay from wallet, and start selling live with full escrow protection.'}
        </p>
      </div>

      {/* Wallet Balance Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-[#1C2541] text-white rounded-2xl p-4 mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="w-5 h-5 text-emerald-400" />
          <div>
            <p className="text-xs text-slate-400">{isRTL ? 'رصيدك المتاح في المحفظة' : 'Available Wallet Balance'}</p>
            <p className="text-xl font-black text-white">{balance.toLocaleString('ar-EG')} <span className="text-sm font-normal text-slate-400">EGP</span></p>
          </div>
        </div>
        {!canAfford && (
          <a href="/wallet" className="text-xs font-bold text-blue-400 hover:text-blue-300 underline">
            {isRTL ? 'شحن الرصيد ←' : 'Top Up →'}
          </a>
        )}
      </div>

      {/* Pass Tier Selection */}
      <div className="mb-8">
        <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-4">
          {isRTL ? 'اختر باقة البث المناسبة لك' : 'Choose Your Live Pass'}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {LIVE_PASSES.map((pass) => {
            const isSelected = selectedTier === pass.tier;
            const affordable = balance >= pass.priceEGP;
            return (
              <button
                key={pass.tier}
                onClick={() => setSelectedTier(pass.tier)}
                className={`relative text-left rounded-3xl p-5 border-2 transition-all ${
                  isSelected
                    ? 'border-[#3665F3] shadow-lg shadow-blue-500/10 bg-blue-50/50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                } ${!affordable ? 'opacity-60' : ''}`}
              >
                {pass.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#3665F3] text-white text-[10px] font-black px-3 py-0.5 rounded-full">
                    {isRTL ? 'الأكثر طلباً' : 'POPULAR'}
                  </div>
                )}

                <div className="text-2xl mb-2">{pass.badge}</div>
                <div className="font-black text-gray-900 text-sm">{isRTL ? pass.name_ar : pass.name}</div>
                <div className="text-2xl font-black mt-1" style={{ color: pass.color }}>{pass.priceEGP} <span className="text-sm font-normal text-gray-500">EGP</span></div>

                <ul className="mt-3 space-y-1.5">
                  {(isRTL ? pass.features_ar : pass.features).map((f, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-[11px] text-gray-600">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isSelected && (
                  <div className="mt-3 flex items-center gap-1 text-[#3665F3] text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isRTL ? 'مختار' : 'Selected'}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stream Details Form */}
      <form onSubmit={handleBook} className="space-y-5 bg-white rounded-3xl border border-gray-200/80 p-6 shadow-sm">
        <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">
          {isRTL ? 'تفاصيل البث المباشر' : 'Show Details'}
        </h2>

        {error && (
          <div className="bg-red-50 text-red-700 text-xs p-3 rounded-xl border border-red-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              {isRTL ? 'عنوان البث بالإنجليزية' : 'Stream Title (English)'} *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="iPhone 15 Pro Flash Sale + Unboxing!"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#3665F3] transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              {isRTL ? 'عنوان البث بالعربية (اختياري)' : 'Stream Title in Arabic (optional)'}
            </label>
            <input
              type="text"
              value={titleAr}
              onChange={e => setTitleAr(e.target.value)}
              placeholder="عرض آيفون ١٥ برو وفتح علبة مباشر"
              dir="rtl"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#3665F3] transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1.5">
            {isRTL ? 'القسم الرئيسي للسلع' : 'Main Category'}
          </label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#3665F3] bg-white"
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>
                {isRTL ? c.label_ar : c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1.5">
            {isRTL ? 'وصف البث (اختياري)' : 'Short Description (optional)'}
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={isRTL ? 'أخبر المشاهدين بما ستبيعه...' : 'Tell viewers what you will be selling...'}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#3665F3] resize-none"
          />
        </div>

        {/* Cost Summary */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2 text-xs">
          <div className="flex justify-between font-bold text-gray-700">
            <span>{isRTL ? 'تكلفة الباس المختار:' : 'Live Pass Price:'}</span>
            <span className="text-gray-900">{selectedPass.priceEGP} EGP</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>{isRTL ? 'مدة البث المتاحة:' : 'Stream Duration:'}</span>
            <span>{selectedPass.durationMinutes} {isRTL ? 'دقيقة' : 'minutes'}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>{isRTL ? 'الحد الأقصى للمشاهدين:' : 'Max Viewers:'}</span>
            <span>{selectedPass.maxViewers.toLocaleString()} {isRTL ? 'مشاهد' : 'viewers'}</span>
          </div>
          <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-gray-900">
            <span>{isRTL ? 'رصيدك بعد الدفع:' : 'Balance After Payment:'}</span>
            <span className={balance - selectedPass.priceEGP < 0 ? 'text-red-600' : 'text-emerald-700'}>
              {(balance - selectedPass.priceEGP).toLocaleString()} EGP
            </span>
          </div>
          <p className="text-[10px] text-gray-400 pt-1">
            {isRTL
              ? '* عمولة إيجي باي المعتادة (حسب مستوى حسابك) تُطبَّق بشكل منفصل على كل سلعة تُباع خلال البث.'
              : "* EgyBay's standard marketplace commission (based on your seller tier) applies separately to each item sold during your stream."}
          </p>
        </div>

        <button
          type="submit"
          disabled={!canAfford || !title.trim() || booking}
          className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl shadow-lg shadow-red-500/25 flex items-center justify-center gap-2 text-sm transition-all"
        >
          <Video className="w-4 h-4" />
          {booking
            ? (isRTL ? 'جاري الحجز...' : 'Booking...')
            : canAfford
            ? (isRTL ? `احجز البث وادفع ${selectedPass.priceEGP} جنيه من المحفظة` : `Book Live Show — Pay ${selectedPass.priceEGP} EGP from Wallet`)
            : (isRTL ? 'رصيد غير كافٍ — اشحن محفظتك أولاً' : 'Insufficient Balance — Top Up Wallet First')}
        </button>

        {!canAfford && (
          <p className="text-center text-xs text-red-600">
            {isRTL
              ? `تحتاج إلى ${selectedPass.priceEGP - balance} جنيه إضافي في محفظتك.`
              : `You need ${selectedPass.priceEGP - balance} more EGP in your wallet.`}
            {' '}
            <a href="/wallet" className="font-bold underline">{isRTL ? 'اشحن الآن ←' : 'Top Up Now →'}</a>
          </p>
        )}
      </form>
    </div>
  );
}

export default function BookLivePage() {
  return (
    <ProtectedRoute>
      <BookLiveContent />
    </ProtectedRoute>
  );
}
