'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ShieldCheck, Truck, QrCode, CreditCard,
  Wallet, CheckCircle2, MapPin, Lock, Package,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import { productService, formatEGP, type Product } from '@/lib/products';
import { getUserWallet, deductWalletSpendableFunds, type UserWallet } from '@/lib/walletService';
import { createMarketplaceOrder, COURIER_DELIVERY_FEE_EGP } from '@/lib/orderService';
import { startPaymobCheckoutSession } from '@/lib/paymobService';
import SmartImage from '@/components/SmartImage';
import { supabase } from '@/lib/supabase';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';

const GOVERNORATES = [
  { en: 'Cairo', ar: 'القاهرة' }, { en: 'Giza', ar: 'الجيزة' }, { en: 'Alexandria', ar: 'الإسكندرية' },
  { en: 'Dakahlia', ar: 'الدقهلية' }, { en: 'Sharqia', ar: 'الشرقية' }, { en: 'Qalyubia', ar: 'القليوبية' },
  { en: 'Gharbia', ar: 'الغربية' }, { en: 'Red Sea', ar: 'البحر الأحمر' }, { en: 'Suez', ar: 'السويس' },
  { en: 'Port Said', ar: 'بورسعيد' }, { en: 'Luxor', ar: 'الأقصر' }, { en: 'Aswan', ar: 'أسوان' },
  { en: 'Asyut', ar: 'أسيوط' }, { en: 'Beheira', ar: 'البحيرة' }, { en: 'Beni Suef', ar: 'بني سويف' },
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
  const [createdOrderId, setCreatedOrderId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [paymobIframeUrl, setPaymobIframeUrl] = useState('');
  const [showPaymobModal, setShowPaymobModal] = useState(false);

  const [deliveryMethod, setDeliveryMethod] = useState<'courier' | 'qr_meetup'>('courier');
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
        const prod = await productService.getProductById(id);
        if (!prod) { router.push('/'); return; }
        setProduct(prod);
        setFullName(user.user_metadata?.full_name || '');

        try {
          setWallet(await getUserWallet(user.id));
        } catch (walletErr) {
          console.warn('[Checkout] Failed to load wallet balance (non-fatal):', walletErr);
        }

        const isSuccess = searchParams.get('success') === 'true' || searchParams.get('txn_response_code') === 'APPROVED';
        const txOrderId = searchParams.get('order') || searchParams.get('merchant_order_id') || searchParams.get('id');
        if (isSuccess && txOrderId) {
          router.push(`/orders/success?orderId=${txOrderId}`);
        }
      } catch (e) {
        console.error(e);
        router.push('/');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user, authLoading, router, searchParams]);

  const deliveryFee = deliveryMethod === 'courier' ? COURIER_DELIVERY_FEE_EGP : 0;
  const itemPrice = Number(product?.price || 0);
  const totalPrice = itemPrice + deliveryFee;
  const walletAvailable = Number(wallet?.available_balance || 0);
  const canPayFullyWithWallet = walletAvailable >= totalPrice && totalPrice > 0;
  const payingWithWallet = useWalletBalance && canPayFullyWithWallet;
  const walletDeduction = payingWithWallet ? totalPrice : 0;
  const remainingDue = payingWithWallet ? 0 : totalPrice;

  useEffect(() => {
    setCreatedOrderId('');
  }, [deliveryMethod, fullName, phoneNumber, governorate, city, streetAddress, useWalletBalance]);

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
      let currentOrderId = createdOrderId;

      if (!currentOrderId) {
        const order = await createMarketplaceOrder({
          product_id: product.id,
          buyer_id: user.id,
          seller_id: product.seller_id,
          amount: totalPrice,
          handover_method: deliveryMethod,
          shipping_address: { full_name: fullName || 'Buyer', phone: phoneNumber, governorate, city, street: streetAddress },
          product_snapshot: { id: product.id, title: product.title, price: product.price, images: product.images, condition: product.condition, category: product.category },
        });

        if (!order) throw new Error(isRTL ? 'تعذر إنشاء الطلب، يرجى المحاولة ثانية' : 'Failed to create order');
        currentOrderId = order.id;
        setCreatedOrderId(order.id);

        if (order.meetup_pin || (order as any).handover_pin) {
          sessionStorage.setItem(`egbay_pin_${order.id}`, order.meetup_pin || (order as any).handover_pin);
        }
      }

      if (payingWithWallet) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch('/api/wallet/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
            body: JSON.stringify({ action: 'deduct_spendable', orderId: currentOrderId }),
          });
          const walletResult = await res.json();
          if (!walletResult.success) throw new Error(walletResult.error || 'Wallet payment failed');
          router.push(`/orders/success?orderId=${currentOrderId}`);
        } catch (err: any) {
          setErrorMsg(err.message || 'Failed to confirm wallet payment');
          setSubmitting(false);
        }
        return;
      } else {
        const nameParts = (fullName || 'Buyer EgyBay').split(' ');
        const session = await startPaymobCheckoutSession({
          purpose: 'order',
          referenceId: currentOrderId,
          billingData: {
            first_name: nameParts[0] || 'Buyer', last_name: nameParts[1] || 'EgyBay',
            email: user.email || 'buyer@egbay.market', phone_number: phoneNumber || '+201000000000',
            city, state: governorate, street: streetAddress,
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
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="min-h-screen bg-slate-50 py-6 sm:py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-5">
          <Link href={`/products/${product.id}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
            {isRTL ? 'الرجوع للإعلان' : 'Back to product'}
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          <form onSubmit={handlePlaceOrder} className="lg:col-span-2 space-y-5">
            {errorMsg && <Alert tone="danger">{errorMsg}</Alert>}

            {/* 1. Delivery method */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-3.5">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-brand" />
                {isRTL ? '١. طريقة الاستلام والتوصيل' : '1. Delivery & Handover Method'}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDeliveryMethod('courier')}
                  className={`p-3.5 rounded-md border text-left rtl:text-right transition-colors flex flex-col justify-between ${
                    deliveryMethod === 'courier' ? 'border-brand bg-brand-soft' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Truck className="w-4 h-4 text-brand" />
                    <span className="text-xs font-black text-brand">{COURIER_DELIVERY_FEE_EGP} EGP</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">{isRTL ? 'شحن سريع لباب البيت' : 'Doorstep Courier Delivery'}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">{isRTL ? 'تغطية لكافة محافظات مصر' : 'All Egyptian governorates'}</p>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryMethod('qr_meetup')}
                  className={`p-3.5 rounded-md border text-left rtl:text-right transition-colors flex flex-col justify-between ${
                    deliveryMethod === 'qr_meetup' ? 'border-brand bg-brand-soft' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <QrCode className="w-4 h-4 text-success" />
                    <span className="text-xs font-black text-success">{isRTL ? 'مجاناً' : 'FREE'}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">{isRTL ? 'تسليم يدوي بكود PIN' : 'In-Person Meetup (PIN)'}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">{isRTL ? 'عاين السلعة وسلّم الكود عند الرضا' : 'Inspect the item, share the PIN when satisfied'}</p>
                </button>
              </div>
            </div>

            {/* 2. Address */}
            {deliveryMethod === 'courier' && (
              <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-3.5">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand" />
                  {isRTL ? '٢. عنوان التوصيل وبيانات الاتصال' : '2. Shipping Address & Contact'}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{isRTL ? 'الاسم بالكامل' : 'Full Name'}</label>
                    <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder={isRTL ? 'الاسم المستلم' : 'Recipient full name'}
                      className="w-full border border-slate-200 rounded-md px-3 py-2.5 text-xs outline-none focus:border-brand" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{isRTL ? 'رقم الهاتف' : 'Mobile Phone Number'}</label>
                    <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="01012345678"
                      className="w-full border border-slate-200 rounded-md px-3 py-2.5 text-xs outline-none focus:border-brand font-mono" required />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{isRTL ? 'المحافظة' : 'Governorate'}</label>
                    <select value={governorate} onChange={e => setGovernorate(e.target.value)}
                      className="w-full border border-slate-200 rounded-md px-3 py-2.5 text-xs outline-none focus:border-brand bg-white">
                      {GOVERNORATES.map(g => <option key={g.en} value={g.en}>{isRTL ? g.ar : g.en}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{isRTL ? 'المدينة / الحي' : 'City / District'}</label>
                    <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder={isRTL ? 'مثال: التجمع الخامس' : 'e.g. New Cairo, Maadi'}
                      className="w-full border border-slate-200 rounded-md px-3 py-2.5 text-xs outline-none focus:border-brand" required />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{isRTL ? 'اسم الشارع ورقم العمارة والشقة' : 'Detailed Street Address'}</label>
                  <input type="text" value={streetAddress} onChange={e => setStreetAddress(e.target.value)} placeholder={isRTL ? 'شارع، عمارة، شقة' : 'Street, building, apartment'}
                    className="w-full border border-slate-200 rounded-md px-3 py-2.5 text-xs outline-none focus:border-brand" required />
                </div>
              </div>
            )}

            {/* 3. Payment */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-3.5">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-brand" />
                {isRTL ? '٣. طريقة الدفع' : '3. Payment Method'}
              </h2>

              {walletAvailable > 0 && (
                <div className={`p-3.5 rounded-md border flex items-center justify-between ${canPayFullyWithWallet ? 'bg-success-soft border-success/20' : 'bg-slate-50 border-slate-200 opacity-70'}`}>
                  <div className="flex items-center gap-3">
                    <Wallet className={`w-4 h-4 flex-shrink-0 ${canPayFullyWithWallet ? 'text-success' : 'text-slate-400'}`} />
                    <div>
                      <h4 className={`text-xs font-bold ${canPayFullyWithWallet ? 'text-success' : 'text-slate-600'}`}>{isRTL ? 'استخدام رصيد المحفظة' : 'Use Egbay Wallet Balance'}</h4>
                      <p className="text-[11px] text-slate-500">
                        {isRTL ? `المتاح: ${formatEGP(walletAvailable)}` : `Available: ${formatEGP(walletAvailable)}`}
                        {!canPayFullyWithWallet && (isRTL ? ' — غير كافٍ، سيتم الدفع بالبطاقة' : ' — not enough to cover the total, so this order will be paid by card')}
                      </p>
                    </div>
                  </div>
                  <input type="checkbox" checked={payingWithWallet} disabled={!canPayFullyWithWallet} onChange={e => setUseWalletBalance(e.target.checked)}
                    className="w-4 h-4 accent-brand rounded disabled:opacity-40" />
                </div>
              )}

              {remainingDue > 0 && (
                <div className="p-3 rounded-md border border-brand bg-brand-soft flex items-center gap-3">
                  <CreditCard className="w-4 h-4 text-brand flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">{isRTL ? 'بطاقة بنكية عبر Paymob' : 'Bank Card via Paymob'}</p>
                    <p className="text-[10px] text-slate-500">Visa / Mastercard · {formatEGP(remainingDue)}</p>
                  </div>
                </div>
              )}
            </div>

            <Button type="submit" fullWidth size="lg" loading={submitting} icon={<ShieldCheck className="w-4 h-4" />}>
              {submitting
                ? (isRTL ? 'جاري تأكيد الطلب...' : 'Securing your order...')
                : payingWithWallet
                ? (isRTL ? `شراء فوري برصيد المحفظة — ${formatEGP(totalPrice)}` : `Buy Now with Wallet — ${formatEGP(totalPrice)}`)
                : (isRTL ? `الدفع ببطاقة بنكية — ${formatEGP(totalPrice)}` : `Pay by Card — ${formatEGP(totalPrice)}`)}
            </Button>
          </form>

          {/* Summary */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{isRTL ? 'ملخص الطلب' : 'Order Summary'}</h3>

              <div className="flex gap-3 pb-3.5 border-b border-slate-100">
                <div className="w-14 h-14 rounded-md bg-slate-100 relative overflow-hidden flex-shrink-0">
                  {product.images?.[0] ? (
                    <SmartImage src={product.images[0]} alt={product.title} fill className="object-cover" sizes="56px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300"><Package className="w-5 h-5" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">{product.title}</h4>
                  <p className="text-xs font-black text-slate-900 mt-1">{formatEGP(itemPrice)}</p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>{isRTL ? 'سعر السلعة' : 'Item Subtotal'}</span>
                  <span className="font-bold text-slate-900">{formatEGP(itemPrice)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{isRTL ? 'مصاريف التوصيل' : 'Delivery Fee'}</span>
                  <span className="font-bold text-slate-900">{deliveryFee > 0 ? formatEGP(deliveryFee) : (isRTL ? 'مجاناً' : 'FREE')}</span>
                </div>
                {walletDeduction > 0 && (
                  <div className="flex justify-between text-success">
                    <span>{isRTL ? 'خصم المحفظة' : 'Wallet Deduction'}</span>
                    <span className="font-bold">-{formatEGP(walletDeduction)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-100 flex justify-between text-sm font-black text-slate-900">
                  <span>{isRTL ? 'إجمالي المطلوب' : 'Total Due'}</span>
                  <span className="text-brand">{formatEGP(totalPrice)}</span>
                </div>
              </div>
            </div>

            <div className="bg-success-soft border border-success/20 rounded-lg p-4 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-success leading-relaxed">
                {isRTL
                  ? 'أموالك لا تُحول للبائع إلا بعد فحص واستلام السلعة بنفسك.'
                  : 'Funds are only released to the seller once you confirm receipt or hand over the PIN.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {showPaymobModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-lg rounded-t-lg flex flex-col overflow-hidden shadow-card-lg" style={{ height: '85vh', maxHeight: 680 }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
              <div>
                <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4 text-success" />
                  {isRTL ? 'الدفع الآمن عبر Paymob' : 'Secure Card Checkout'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{isRTL ? 'بوابة دفع معتمدة PCI-DSS' : 'PCI-DSS certified payment gateway'}</p>
              </div>
              <button onClick={() => { setShowPaymobModal(false); setPaymobIframeUrl(''); }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors text-lg"
                aria-label="Close payment modal">×</button>
            </div>
            <iframe src={paymobIframeUrl} className="flex-1 w-full border-0" title="Paymob Secure Payment" />
            <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                <span className="text-[11px]">{isRTL ? 'بعد ظهور Approved، اضغط للمتابعة' : 'After "Approved", click to continue'}</span>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => { setShowPaymobModal(false); router.push(`/orders/success?orderId=${createdOrderId}`); }}
              >
                {isRTL ? 'تم الدفع' : "I've Paid"}
              </Button>
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
