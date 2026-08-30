'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, Zap, Sparkles, CheckCircle2, AlertCircle,
  Crown, Flame, Wallet, CreditCard, ShieldCheck, ChevronRight
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import { productService, formatEGP, type Product } from '@/lib/products';
import { getUserWallet, type UserWallet } from '@/lib/walletService';
import { BOOST_PACKAGES, boostProduct, type BoostPackage } from '@/lib/boostService';
import { startPaymobCheckoutSession } from '@/lib/paymobService';

function BoostProductContent() {
  const { productId } = useParams<{ productId: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isRTL } = useLanguage();

  const [product, setProduct] = useState<Product | null>(null);
  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [selectedPkg, setSelectedPkg] = useState<'urgent' | 'featured' | 'turbo'>('featured');
  const [paymentSource, setPaymentSource] = useState<'wallet_balance' | 'paymob'>('wallet_balance');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  // Paymob iFrame Modal
  const [paymobIframeUrl, setPaymobIframeUrl] = useState('');
  const [showPaymobModal, setShowPaymobModal] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    (async () => {
      try {
        if (!productId) return;
        const [p, w] = await Promise.all([
          productService.getProductById(productId),
          getUserWallet(user.id),
        ]);
        if (!p) { router.push('/profile'); return; }
        setProduct(p);
        setWallet(w);
      } catch (e) {
        console.error(e);
        router.push('/profile');
      } finally {
        setLoading(false);
      }
    })();
  }, [productId, user, authLoading, router]);

  const currentPkg = BOOST_PACKAGES[selectedPkg];
  const walletAvailable = Number(wallet?.available_balance || 0);
  const hasEnoughWallet = walletAvailable >= currentPkg.priceEGP;

  const handleBoost = async () => {
    if (!product || !user) return;
    setSubmitting(true);
    setErrorMsg('');

    if (paymentSource === 'wallet_balance') {
      try {
        await boostProduct(product.id, user.id, selectedPkg, 'wallet_balance');
        setSuccess(true);
        setTimeout(() => router.push(`/products/${product.id}`), 2000);
      } catch (err: any) {
        setErrorMsg(err?.message || (isRTL ? 'تعذر تفعيل باقة الترويج' : 'Failed to apply boost package'));
        setSubmitting(false);
      }
    } else {
      // Paymob Direct Card Flow
      try {
        const nameParts = (user.user_metadata?.full_name || 'Seller Owner').split(' ');
        const session = await startPaymobCheckoutSession({
          amountEgp: currentPkg.priceEGP,
          merchantOrderId: `boost_${product.id}_${selectedPkg}_${Date.now()}`,
          itemName: `EgyBay Boost: ${currentPkg.title}`,
          billingData: {
            first_name: nameParts[0] || 'Seller',
            last_name: nameParts[1] || 'Owner',
            email: user.email || 'seller@egbay.market',
            phone_number: '+201000000000',
            city: 'Cairo',
            state: 'Cairo',
          },
        });
        setPaymobIframeUrl(session.iframeUrl);
        setShowPaymobModal(true);
      } catch (err: any) {
        setErrorMsg(err?.message || (isRTL ? 'فشل بدء جلسة الدفع' : 'Failed to initiate Paymob session'));
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 text-white shadow-xl shadow-blue-500/30">
          <Zap className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">
          {isRTL ? 'تم تفعيل الترويج بنجاح! 🚀' : 'Boost Activated! 🚀'}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {isRTL
            ? `إعلانك "${product?.title}" الآن مميز في مقدمة نتائج البحث!`
            : `Your listing "${product?.title}" is now boosted with ${currentPkg.title}!`}
        </p>
        <Link
          href={`/products/${product?.id}`}
          className="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-blue-700 transition-colors inline-block"
        >
          {isRTL ? 'عرض الإعلان بعد الترويج' : 'View Boosted Listing'}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900">
          <ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
        </button>
        <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          {isRTL ? 'ترويج الإعلان وزيادة المشاهدات' : 'Boost Your Listing'}
        </h1>
      </div>

      {errorMsg && (
        <div className="mb-6 bg-red-50 text-red-700 text-sm p-4 rounded-2xl border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" /> {errorMsg}
        </div>
      )}

      {/* Target Product Mini */}
      {product && (
        <div className="bg-white rounded-3xl border border-gray-100 p-4 shadow-sm flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-xl bg-gray-50 relative overflow-hidden flex-shrink-0">
            {product.images?.[0] ? (
              <Image src={product.images[0]} alt={product.title} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl">📦</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-gray-900 truncate">{product.title}</p>
            <p className="text-xs text-blue-600 font-black mt-0.5">{formatEGP(product.price)} · {product.category}</p>
          </div>
        </div>
      )}

      {/* Tier Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {(Object.keys(BOOST_PACKAGES) as Array<'urgent' | 'featured' | 'turbo'>).map(key => {
          const pkg = BOOST_PACKAGES[key];
          const isSelected = selectedPkg === key;

          return (
            <div
              key={key}
              onClick={() => setSelectedPkg(key)}
              className={`rounded-3xl p-6 border-2 cursor-pointer transition-all relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? 'border-blue-600 bg-white shadow-xl ring-2 ring-blue-600/20'
                  : 'border-gray-100 bg-white hover:border-gray-300 shadow-sm'
              }`}
            >
              {key === 'featured' && (
                <span className="absolute top-3 right-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  {isRTL ? 'الأكثر طلباً' : 'MOST POPULAR'}
                </span>
              )}

              <div>
                <div className="text-2xl mb-2">{pkg.badgeEmoji}</div>
                <h3 className="font-black text-gray-900 text-base">{pkg.title}</h3>
                <div className="text-2xl font-black text-blue-600 my-2">
                  {isRTL ? `${pkg.priceEGP} ج.م` : `EGP ${pkg.priceEGP}`}
                </div>
                <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg inline-block mb-3">
                  {pkg.multiplierText} · {pkg.durationDays} {isRTL ? 'أيام' : 'Days'}
                </span>

                <ul className="space-y-1.5 text-xs text-gray-500 mb-6">
                  {pkg.perks.map((p, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={`w-full py-2.5 rounded-xl text-center text-xs font-bold transition-colors ${
                isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}>
                {isSelected ? (isRTL ? '✓ الباقة المحددة' : '✓ Selected Plan') : (isRTL ? 'اختيار الباقة' : 'Select Plan')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment Selection */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4 mb-6">
        <h3 className="text-sm font-bold text-gray-900">
          {isRTL ? 'طريقة الدفع' : 'Payment Source'}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPaymentSource('wallet_balance')}
            className={`p-4 rounded-2xl border-2 text-left rtl:text-right transition-all ${
              paymentSource === 'wallet_balance'
                ? 'border-blue-600 bg-blue-50/50'
                : 'border-gray-100 hover:border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-blue-600" />
              <span className="font-bold text-xs text-gray-900">
                {isRTL ? 'رصيد محفظة إيجي باي' : 'Spendable Wallet Balance'}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {isRTL ? 'المتاح:' : 'Available:'} <strong>{isRTL ? `${walletAvailable.toLocaleString('ar-EG')} ج.م` : `EGP ${walletAvailable.toLocaleString('en-EG')}`}</strong>
              {!hasEnoughWallet && <span className="text-rose-500 ml-1">({isRTL ? 'غير كافٍ' : 'Insufficient'})</span>}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setPaymentSource('paymob')}
            className={`p-4 rounded-2xl border-2 text-left rtl:text-right transition-all ${
              paymentSource === 'paymob'
                ? 'border-blue-600 bg-blue-50/50'
                : 'border-gray-100 hover:border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span className="font-bold text-xs text-gray-900">
                {isRTL ? 'بطاقة بنكية (فيزا / ماستركارد)' : 'Credit / Debit Card'}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {isRTL ? 'دفع فوري آمن عبر Paymob' : 'Instant direct card charge via Paymob'}
            </p>
          </button>
        </div>
      </div>

      {/* Confirm CTA */}
      <div className="flex justify-end">
        <button
          onClick={handleBoost}
          disabled={submitting || (paymentSource === 'wallet_balance' && !hasEnoughWallet)}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold px-8 py-3.5 rounded-2xl text-sm transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2"
        >
          <Zap className="w-4 h-4" />
          {submitting
            ? (isRTL ? 'جاري تفعيل الباقة...' : 'Applying Promotion...')
            : (isRTL ? `ترويج الإعلان الآن بمبلغ ${currentPkg.priceEGP} ج.م` : `Boost Now for EGP ${currentPkg.priceEGP}`)}
        </button>
      </div>

      {/* ── Paymob Card Payment Modal for Boost ─────────────────── */}
      {showPaymobModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl flex flex-col overflow-hidden shadow-2xl"
               style={{ height: '85vh', maxHeight: 680 }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
              <div>
                <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  {isRTL ? 'الدفع الآمن لترويج الإعلان' : 'Secure Boost Checkout'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {currentPkg.title} · EGP {currentPkg.priceEGP}
                </p>
              </div>
              <button
                onClick={() => { setShowPaymobModal(false); setPaymobIframeUrl(''); }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors text-lg font-light"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <iframe
              src={paymobIframeUrl}
              className="flex-1 w-full border-0"
              title="Paymob Boost Payment"
            />
            <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="text-[11px]">
                  {isRTL ? 'بعد ظهور علامة Approved، اضغط لتفعيل الترويج' : 'After "Approved", click to activate your boost'}
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setShowPaymobModal(false);
                  if (product && user) {
                    await boostProduct(product.id, user.id, selectedPkg, 'paymob');
                    setSuccess(true);
                    setTimeout(() => router.push(`/products/${product.id}`), 2000);
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 flex-shrink-0"
              >
                <span>{isRTL ? 'تم الدفع بنجاح ✅' : 'I Paid — Done ✅'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BoostProductPage() {
  return (
    <ProtectedRoute>
      <BoostProductContent />
    </ProtectedRoute>
  );
}
