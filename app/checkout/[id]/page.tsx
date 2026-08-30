'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, ShieldCheck, Truck, QrCode, CreditCard,
  Smartphone, Wallet, CheckCircle2, AlertCircle, MapPin,
  Lock, ChevronRight, Package, User, Sparkles
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import { productService, formatEGP, type Product } from '@/lib/products';
import { getUserWallet, deductWalletSpendableFunds, type UserWallet } from '@/lib/walletService';
import { createMarketplaceOrder, confirmOrderPayment } from '@/lib/orderService';
import { startPaymobCheckoutSession } from '@/lib/paymobService';
import SmartImage from '@/components/SmartImage';

const GOVERNORATES = [
  { en: 'Cairo', ar: 'القاهرة' },
  { en: 'Giza', ar: 'الجيزة' },
  { en: 'Alexandria', ar: 'الإسكندرية' },
  { en: 'Dakahlia', ar: 'الدقهلية' },
  { en: 'Sharqia', ar: 'الشرقية' },
  { en: 'Qalyubia', ar: 'القليوبية' },
  { en: 'Gharbia', ar: 'الغربية' },
  { en: 'Red Sea', ar: 'البحر الأحمر' },
  { en: 'Suez', ar: 'السويس' },
  { en: 'Port Said', ar: 'بورسعيد' },
  { en: 'Luxor', ar: 'الأقصر' },
  { en: 'Aswan', ar: 'أسوان' },
  { en: 'Asyut', ar: 'أسيوط' },
  { en: 'Beheira', ar: 'البحيرة' },
  { en: 'Beni Suef', ar: 'بني سويف' },
];

function CheckoutContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { isRTL } = useLanguage();

  const [product, setProduct] = useState<Product | null>(null);
  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [useWalletBalance, setUseWalletBalance] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  // Paymob iFrame modal
  const [paymobIframeUrl, setPaymobIframeUrl] = useState('');
  const [showPaymobModal, setShowPaymobModal] = useState(false);

  // Form
  const [deliveryMethod, setDeliveryMethod] = useState<'courier' | 'qr_meetup'>('courier');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'instapay' | 'cod'>('card');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [governorate, setGovernorate] = useState('Cairo');
  const [city, setCity] = useState('');
  const [streetAddress, setStreetAddress] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    (async () => {
      try {
        if (!id) return;
        const [prod, w] = await Promise.all([
          productService.getProductById(id),
          getUserWallet(user.id),
        ]);
        if (!prod) { router.push('/'); return; }
        setProduct(prod);
        setWallet(w);
        setFullName(user.user_metadata?.full_name || '');

        // Check if returning from Paymob 3D-Secure
        const isSuccess = searchParams.get('success') === 'true' || searchParams.get('txn_response_code') === 'APPROVED';
        const txOrderId = searchParams.get('order') || searchParams.get('merchant_order_id') || searchParams.get('id');
        if (isSuccess && txOrderId) {
          const dedupeKey = `paymob_order_confirmed_${txOrderId}`;
          if (!sessionStorage.getItem(dedupeKey)) {
            sessionStorage.setItem(dedupeKey, '1');
            await confirmOrderPayment(txOrderId);
          }
          setCreatedOrderId(txOrderId);
          setOrderComplete(true);
        }
      } catch (e) {
        console.error(e);
        router.push('/');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user, authLoading, router, searchParams]);

  const deliveryFee = deliveryMethod === 'courier' ? 65 : 0;
  const itemPrice = Number(product?.price || 0);
  const totalPrice = itemPrice + deliveryFee;
  const walletAvailable = Number(wallet?.available_balance || 0);
  const walletDeduction = useWalletBalance ? Math.min(walletAvailable, totalPrice) : 0;
  const remainingDue = Math.max(0, totalPrice - walletDeduction);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !user) return;
    if (deliveryMethod === 'courier' && (!phoneNumber || !streetAddress || !city)) {
      setErrorMsg(isRTL ? 'يرجى إكمال بيانات العنوان ورقم الهاتف للتوصيل' : 'Please complete your shipping address and contact number');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const order = await createMarketplaceOrder({
        product_id: product.id,
        buyer_id: user.id,
        seller_id: product.seller_id,
        amount: totalPrice,
        handover_method: deliveryMethod,
        shipping_address: {
          full_name: fullName || 'Buyer',
          phone: phoneNumber,
          governorate,
          city,
          street: streetAddress,
        },
        product_snapshot: {
          id: product.id,
          title: product.title,
          price: product.price,
          images: product.images,
          condition: product.condition,
          category: product.category,
        },
      });

      if (!order) throw new Error(isRTL ? 'تعذر إنشاء الطلب، يرجى المحاولة ثانية' : 'Failed to create order');

      // Deduct wallet portion first (real money the user already has)
      if (walletDeduction > 0) {
        await deductWalletSpendableFunds(user.id, walletDeduction, order.id, product.title);
      }

      setCreatedOrderId(order.id);

      if (useWalletBalance && remainingDue === 0) {
        // 100% wallet — process order confirmation & escrow credit via secure server API
        try {
          const res = await fetch('/api/wallet/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'deduct_spendable', orderId: order.id }),
          });
          const walletResult = await res.json();
          if (!walletResult.success) throw new Error(walletResult.error || 'Wallet payment failed');
          
          router.push(`/orders/success?orderId=${order.id}`);
        } catch (err: any) {
          setErrorMsg(err.message || 'Failed to confirm wallet payment');
          setSubmitting(false);
        }
        return;
      } else {
        // Remaining due > 0 (Full or Split payment) — open Paymob iFrame modal
        const nameParts = (fullName || 'Buyer EgyBay').split(' ');
        const session = await startPaymobCheckoutSession({
          purpose: 'order',
          referenceId: order.id,
          billingData: {
            first_name: nameParts[0] || 'Buyer',
            last_name: nameParts[1] || 'EgyBay',
            email: user.email || 'buyer@egbay.market',
            phone_number: phoneNumber || '+201000000000',
            city,
            state: governorate,
            street: streetAddress,
          },
        });
        setPaymobIframeUrl(session.iframeUrl);
        setShowPaymobModal(true);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || (isRTL ? 'حدث خطأ أثناء معالجة الطلب' : 'Failed to place order. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) return null;

  if (orderComplete) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/80 p-8 text-center shadow-xl space-y-5">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-slate-900 mb-1">
              {isRTL ? 'تم تأكيد طلبك بنجاح! 🎉' : 'Order Confirmed! 🎉'}
            </h2>
            <p className="text-xs text-slate-500">
              {isRTL
                ? 'تم حجز المبلغ بأمان في حساب الضمان، وسيتم إشعار البائع لتجهيز وشحن السلعة فوراً.'
                : 'Funds are held safely in escrow. The seller has been notified to dispatch your package.'}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs space-y-2 text-left rtl:text-right">
            <div className="flex justify-between">
              <span className="text-slate-500">{isRTL ? 'رقم الطلب:' : 'Order ID:'}</span>
              <span className="font-mono font-bold text-slate-800">{createdOrderId.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{isRTL ? 'المبلغ المحجوز في الضمان:' : 'Total Locked in Escrow:'}</span>
              <span className="font-black text-emerald-700">{formatEGP(totalPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{isRTL ? 'طريقة الاستلام:' : 'Handover:'}</span>
              <span className="font-bold text-slate-800">
                {deliveryMethod === 'courier'
                  ? (isRTL ? 'شحن لباب البيت (بوسطة)' : 'Doorstep Courier (Bosta)')
                  : (isRTL ? 'تسليم يدوي بكود PIN' : 'In-Person PIN Meetup')}
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Link
              href="/orders"
              className="block w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 text-white font-bold py-3.5 rounded-2xl text-xs shadow-md transition-all text-center"
            >
              {isRTL ? 'تتبع حالة الطلب والضمان' : 'View in My Orders'}
            </Link>
            <Link
              href="/"
              className="block w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl text-xs transition-colors text-center"
            >
              {isRTL ? 'العودة للتسوق' : 'Back to Marketplace'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Navigation Breadcrumb */}
        <div className="mb-6">
          <Link
            href={`/products/${product.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
            {isRTL ? 'الرجوع للإعلان' : 'Back to Product'}
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Checkout Form (2 cols) */}
          <form onSubmit={handlePlaceOrder} className="lg:col-span-2 space-y-6">
            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {errorMsg}
              </div>
            )}

            {/* 1. Delivery / Handover Method */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-600" />
                {isRTL ? '١. طريقة الاستلام والتوصيل' : '1. Delivery & Handover Method'}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDeliveryMethod('courier')}
                  className={`p-4 rounded-2xl border-2 text-left rtl:text-right transition-all flex flex-col justify-between ${
                    deliveryMethod === 'courier'
                      ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Truck className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-blue-700">65 EGP</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      {isRTL ? 'شحن سريع لباب البيت' : 'Doorstep Courier (Bosta)'}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {isRTL ? 'تغطية لكافة محافظات مصر مع مهلة فحص ٢٤ ساعة' : 'All Egyptian Governorates + 24h inspection'}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryMethod('qr_meetup')}
                  className={`p-4 rounded-2xl border-2 text-left rtl:text-right transition-all flex flex-col justify-between ${
                    deliveryMethod === 'qr_meetup'
                      ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-emerald-700">{isRTL ? 'مجاناً' : 'FREE'}</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      {isRTL ? 'تسليم يدوي بكود PIN' : 'In-Person Meetup (PIN)'}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {isRTL ? 'معاينة السلعة وتسليم كود PIN للبائع عند الرضا' : 'Inspect item physically, share PIN to release funds'}
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Shipping Address (Courier Only) */}
            {deliveryMethod === 'courier' && (
              <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  {isRTL ? '٢. عنوان التوصيل وبيانات الاتصال' : '2. Shipping Address & Contact'}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isRTL ? 'الاسم بالكامل' : 'Full Name'}
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder={isRTL ? 'الاسم المستلم' : 'Recipient full name'}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isRTL ? 'رقم الهاتف (للتواصل مع المندوب)' : 'Mobile Phone Number'}
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      placeholder="01012345678"
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isRTL ? 'المحافظة' : 'Governorate'}
                    </label>
                    <select
                      value={governorate}
                      onChange={e => setGovernorate(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-blue-500 bg-white"
                    >
                      {GOVERNORATES.map(g => (
                        <option key={g.en} value={g.en}>
                          {isRTL ? g.ar : g.en}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isRTL ? 'المدينة / الحي' : 'City / District'}
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      placeholder={isRTL ? 'مثال: التجمع الخامس، المعادي، الشيخ زايد' : 'e.g. New Cairo, Maadi, Dokki'}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isRTL ? 'اسم الشارع، رقم العمارة والشقة' : 'Detailed Street Address'}
                  </label>
                  <input
                    type="text"
                    value={streetAddress}
                    onChange={e => setStreetAddress(e.target.value)}
                    placeholder={isRTL ? 'مثال: شارع التسعين، عمارة ١٢، شقة ٤' : 'Street name, building number, floor/apartment'}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>
            )}

            {/* 3. Escrow Payment Method */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                {isRTL ? '٣. طريقة الدفع لحساب الضمان' : '3. Escrow Payment Method'}
              </h2>

              {/* Wallet deduction toggle if available */}
              {walletAvailable > 0 && (
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-950">
                        {isRTL ? 'استخدام رصيد محفظة إيجي باي' : 'Use EgyBay Wallet Balance'}
                      </h4>
                      <p className="text-[11px] text-emerald-700">
                        {isRTL ? `المتاح: ${formatEGP(walletAvailable)}` : `Available: ${formatEGP(walletAvailable)}`}
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={useWalletBalance}
                    onChange={e => setUseWalletBalance(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                </div>
              )}

              {remainingDue > 0 && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`p-3.5 rounded-2xl border-2 flex items-center gap-3 transition-all ${
                        paymentMethod === 'card'
                          ? 'border-blue-600 bg-blue-50/50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <CreditCard className="w-5 h-5 text-blue-600" />
                      <div className="text-left rtl:text-right">
                        <p className="text-xs font-bold text-slate-900">
                          {isRTL ? 'بطاقة بنكية' : 'Bank Card'}
                        </p>
                        <p className="text-[10px] text-slate-400">Visa / Mastercard</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('instapay')}
                      className={`p-3.5 rounded-2xl border-2 flex items-center gap-3 transition-all ${
                        paymentMethod === 'instapay'
                          ? 'border-blue-600 bg-blue-50/50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Smartphone className="w-5 h-5 text-indigo-600" />
                      <div className="text-left rtl:text-right">
                        <p className="text-xs font-bold text-slate-900">InstaPay</p>
                        <p className="text-[10px] text-slate-400">{isRTL ? 'تحويل فوري' : 'Direct IPA Transfer'}</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`w-full text-white font-black py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm ${
                remainingDue === 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/25'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
              {submitting
                ? (isRTL ? 'جاري تأكيد وحجز المبلغ في الضمان...' : 'Securing Funds in Escrow...')
                : remainingDue === 0
                ? (isRTL ? `⚡ شراء فوري برصيد المحفظة (${formatEGP(totalPrice)})` : `⚡ 1-Click Buy with Wallet Balance (${formatEGP(totalPrice)})`)
                : walletDeduction > 0
                ? (isRTL ? `دفع المتبقي ${formatEGP(remainingDue)} بالفيزا (دفع مدمج)` : `Pay Remaining ${formatEGP(remainingDue)} via Card (Split Payment)`)
                : (isRTL ? `الدفع ببطاقة بنكية ${formatEGP(totalPrice)} (باي موب)` : `Pay ${formatEGP(totalPrice)} via Paymob Card 💳`)}
            </button>
          </form>

          {/* Summary Sidebar (1 col) */}
          <div className="space-y-4">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {isRTL ? 'ملخص الطلب' : 'Order Summary'}
              </h3>

              {/* Product Preview */}
              <div className="flex gap-3 pb-4 border-b border-slate-100">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 relative overflow-hidden flex-shrink-0">
                  {product.images?.[0] ? (
                    <SmartImage src={product.images[0]} alt={product.title} fill className="object-cover" sizes="64px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Package className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">{product.title}</h4>
                  <p className="text-xs font-black text-slate-900 mt-1">{formatEGP(itemPrice)}</p>
                </div>
              </div>

              {/* Financial Calculation */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>{isRTL ? 'سعر السلعة:' : 'Item Subtotal:'}</span>
                  <span className="font-bold text-slate-900">{formatEGP(itemPrice)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{isRTL ? 'مصاريف التوصيل:' : 'Delivery Fee:'}</span>
                  <span className="font-bold text-slate-900">
                    {deliveryFee > 0 ? formatEGP(deliveryFee) : (isRTL ? 'مجاناً' : 'FREE')}
                  </span>
                </div>

                {walletDeduction > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>{isRTL ? 'خصم المحفظة:' : 'Wallet Deduction:'}</span>
                    <span className="font-bold">-{formatEGP(walletDeduction)}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex justify-between text-sm font-black text-slate-900">
                  <span>{isRTL ? 'إجمالي المطلوب:' : 'Total Due:'}</span>
                  <span className="text-blue-600">{formatEGP(totalPrice)}</span>
                </div>
              </div>
            </div>

            {/* Escrow Guarantee Box */}
            <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-3xl p-5 shadow-sm text-emerald-950">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <h4 className="font-bold text-emerald-900 mb-1">
                    {isRTL ? 'حماية الضمان المالي ١٠٠٪' : '100% Escrow Protection'}
                  </h4>
                  <p className="text-emerald-800 text-[11px]">
                    {isRTL
                      ? 'أموالك لا تُحول للبائع إلا بعد فحص واستلام السلعة بنفسك.'
                      : 'Funds are never released directly to the seller until you inspect your item upon delivery.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Paymob Card Payment Modal ────────────────────────────── */}
      {showPaymobModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl flex flex-col overflow-hidden shadow-2xl"
               style={{ height: '85vh', maxHeight: 680 }}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
              <div>
                <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  {isRTL ? 'الدفع الآمن عبر Paymob' : 'Secure Card Checkout'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isRTL ? 'معتمد PCI-DSS · 256-Bit SSL' : 'PCI-DSS Certified · 256-Bit SSL Encryption'}
                </p>
              </div>
              <button
                onClick={() => { setShowPaymobModal(false); setPaymobIframeUrl(''); }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors text-lg font-light"
                aria-label="Close payment modal"
              >
                ×
              </button>
            </div>
            {/* Paymob iFrame */}
            <iframe
              src={paymobIframeUrl}
              className="flex-1 w-full border-0"
              title="Paymob Secure Payment"
            />
            <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="text-[11px]">
                  {isRTL ? 'بعد ظهور علامة Approved، اضغط لمتابعة الطلب' : 'After "Approved", click to complete your order'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPaymobModal(false);
                  setOrderComplete(true);
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

export default function CheckoutPage() {
  return (
    <ProtectedRoute>
      <CheckoutContent />
    </ProtectedRoute>
  );
}
