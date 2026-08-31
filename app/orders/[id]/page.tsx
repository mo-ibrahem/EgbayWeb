'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getOrderById, MarketplaceOrder } from '@/lib/orderService';
import { ArrowLeft, Package, ShieldCheck, Truck, Clock, MapPin, Loader2, AlertCircle, CheckCircle2, ChevronRight, Lock, DollarSign, User, AlertTriangle } from 'lucide-react';
import SmartImage from '@/components/SmartImage';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';

function formatEGP(amount: number, isRTL: boolean = false) {
  return new Intl.NumberFormat(isRTL ? 'ar-EG' : 'en-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function OrderDetailsPage() {
  const { id: orderId } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { isRTL } = useLanguage();

  const [order, setOrder] = useState<MarketplaceOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // PIN Logic
  const [buyerPin, setBuyerPin] = useState<string | null>(null);
  const [sellerPinInput, setSellerPinInput] = useState('');
  const [releasing, setReleasing] = useState(false);
  const [releaseSuccess, setReleaseSuccess] = useState(false);
  const [releaseError, setReleaseError] = useState('');

  useEffect(() => {
    async function loadOrder() {
      if (!orderId || !user) return;
      try {
        const fetchedOrder = await getOrderById(orderId);
        
        if (!fetchedOrder) {
          setErrorMsg(isRTL ? 'الطلب غير موجود' : 'Order not found');
          return;
        }

        // Strict Authorization (Buyer or Seller ONLY)
        if (fetchedOrder.buyer_id !== user.id && fetchedOrder.seller_id !== user.id) {
          setErrorMsg(isRTL ? 'غير مصرح بعرض هذا الطلب' : 'Unauthorized to view this order');
          return;
        }

        setOrder(fetchedOrder);

        // Load PIN from sessionStorage if buyer
        if (fetchedOrder.buyer_id === user.id) {
          const storedPin = sessionStorage.getItem(`egbay_pin_${orderId}`);
          if (storedPin) {
            setBuyerPin(storedPin);
          }
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Error loading order details');
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadOrder();
    }
  }, [orderId, user, isRTL]);

  const handleReleaseEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId || !user) return;
    setReleasing(true);
    setReleaseError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ action: 'release_escrow', orderId, pin: sellerPinInput })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to release escrow');
      }
      setReleaseSuccess(true);
      // Reload order to get new status
      const fetchedOrder = await getOrderById(orderId as string);
      if (fetchedOrder) setOrder(fetchedOrder);
    } catch (err: any) {
      setReleaseError(err.message || 'Invalid PIN or server error');
    } finally {
      setReleasing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (errorMsg || !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <AlertCircle className="w-16 h-16 text-rose-500 mb-4" />
        <h1 className="text-2xl font-black text-slate-900 mb-2">{errorMsg || 'Order Not Found'}</h1>
        <button onClick={() => router.back()} className="mt-4 px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors">
          {isRTL ? 'الرجوع' : 'Go Back'}
        </button>
      </div>
    );
  }

  const isBuyer = user?.id === order.buyer_id;
  const isSeller = user?.id === order.seller_id;
  const shortOrderId = `#${order.id.slice(-8).toUpperCase()}`;

  const productPrice = order.product?.price || order.amount;
  const deliveryFee = Math.max(0, order.amount - productPrice);

  // Timeline Progress Calculation
  const timelineSteps = [
    { id: 'payment', label: isRTL ? 'الدفع مضمون' : 'Payment Secured', active: true },
    { id: 'dispatch', label: isRTL ? 'بانتظار الشحن' : 'Awaiting Dispatch', active: ['shipped', 'delivered', 'completed'].includes(order.status) || order.tracking_number },
    { id: 'transit', label: isRTL ? 'في الطريق' : 'In Transit', active: ['shipped', 'delivered', 'completed'].includes(order.status) && !!order.tracking_number },
    { id: 'delivered', label: isRTL ? 'تم التوصيل' : 'Delivered', active: ['delivered', 'completed'].includes(order.status) },
    { id: 'completed', label: isRTL ? 'مكتمل' : 'Completed', active: order.status === 'completed' },
  ];

  if (order.handover_method === 'qr_meetup') {
    timelineSteps[1].label = isRTL ? 'تنسيق المقابلة' : 'Meetup Arranged';
    timelineSteps[2].label = isRTL ? 'جاري التسليم' : 'Handover';
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation */}
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">
          <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
          {isRTL ? 'الرجوع للطلبات' : 'Back to Orders'}
        </button>

        {/* Header Summary */}
        <div className="bg-white rounded-[2rem] border border-slate-200/80 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                {isRTL ? 'تفاصيل الطلب' : 'Order Details'}
                <span className="font-mono text-base font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg select-all">
                  {shortOrderId}
                </span>
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {new Date(order.created_at).toLocaleString(isRTL ? 'ar-EG' : 'en-EG')}
              </p>
            </div>
            
            <span className={`px-4 py-2 rounded-xl text-sm font-bold border ${
              order.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              order.status === 'disputed' ? 'bg-rose-50 text-rose-700 border-rose-200' :
              order.status === 'pending_payment' ? 'bg-amber-50 text-amber-700 border-amber-200' :
              'bg-blue-50 text-blue-700 border-blue-200'
            }`}>
              {isRTL ? 'الحالة: ' : 'Status: '}
              {order.status === 'escrow_secured' ? (isRTL ? 'الضمان مؤمن' : 'PAYMENT SECURED') : order.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="w-20 h-20 bg-white rounded-xl border border-slate-200 overflow-hidden relative flex-shrink-0">
              {order.product?.images?.[0] ? (
                <SmartImage src={order.product.images[0]} alt={order.product.title || 'Product'} fill className="object-cover" sizes="80px" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <Package className="w-8 h-8" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <Link href={`/products/${order.product_id}`} className="text-lg font-bold text-slate-900 hover:text-blue-600 transition-colors line-clamp-2">
                {order.product?.title || 'Marketplace Item'}
              </Link>
              <div className="mt-2 text-xl font-black text-blue-600">
                {formatEGP(order.amount, isRTL)}
              </div>
            </div>
          </div>
        </div>

        {/* Handover PIN Section (Critical Security Flow) */}
        {order.status !== 'completed' && order.status !== 'cancelled' && (
          <div className={`rounded-[2rem] p-6 sm:p-8 shadow-sm border ${isBuyer ? 'bg-indigo-900 border-indigo-800 text-white' : 'bg-white border-blue-200'}`}>
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${isBuyer ? 'bg-indigo-800 text-indigo-300' : 'bg-blue-50 text-blue-600'}`}>
                <Lock className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2 className={`text-lg font-bold mb-2 ${isBuyer ? 'text-white' : 'text-slate-900'}`}>
                  {isRTL ? 'رمز التسليم الآمن (PIN)' : 'Secure Handover PIN'}
                </h2>
                
                {isBuyer ? (
                  <div>
                    {buyerPin ? (
                      <div>
                        <p className="text-indigo-200 text-sm mb-4">
                          {isRTL 
                            ? 'هذا هو الرمز السري الخاص بك. أعطه للبائع فقط عند استلامك المنتج وتأكدك من مطابقته للمواصفات. إعطاء الرمز للبائع يعني تحرير الأموال له.' 
                            : 'This is your secure PIN. Only give this to the seller/courier AFTER you have received and inspected the item. Giving them the PIN releases your funds.'}
                        </p>
                        <div className="bg-indigo-950/50 border border-indigo-500/30 rounded-xl p-4 text-center">
                          <div className="text-4xl font-mono font-black tracking-[0.25em] text-white">
                            {buyerPin}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
                        <p className="text-rose-200 text-sm flex items-start gap-2">
                          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                          {isRTL 
                            ? 'لدواعي أمنية، الرمز السري يظهر مرة واحدة فقط بعد الدفع مباشرة. إذا فقدت الرمز، يرجى مراجعة بريدك الإلكتروني أو التواصل مع الدعم الفني.' 
                            : 'For your security, the plaintext PIN was only shown immediately after checkout. If you lost it, please check your email receipt or contact support.'}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-slate-500 text-sm mb-4">
                      {isRTL 
                        ? 'أدخل الرمز السري المكون من ٦ أرقام الذي سيعطيه لك المشتري عند استلام المنتج لتحرير أموالك فوراً إلى محفظتك.' 
                        : 'Enter the 6-digit PIN provided by the buyer upon successful handover to immediately release funds to your wallet.'}
                    </p>
                    
                    {releaseSuccess ? (
                      <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl border border-emerald-200 flex items-center gap-3 font-bold">
                        <CheckCircle2 className="w-5 h-5" />
                        {isRTL ? 'تم تحرير الأموال بنجاح!' : 'Funds released successfully!'}
                      </div>
                    ) : (
                      <form onSubmit={handleReleaseEscrow} className="flex gap-2">
                        <input
                          type="text"
                          value={sellerPinInput}
                          onChange={(e) => setSellerPinInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                          placeholder="123456"
                          className="flex-1 border border-slate-300 rounded-xl px-4 py-3 text-lg font-mono tracking-widest outline-none focus:border-blue-500"
                          required
                          disabled={releasing}
                        />
                        <button 
                          type="submit" 
                          disabled={releasing || sellerPinInput.length !== 6}
                          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition-colors whitespace-nowrap"
                        >
                          {releasing ? <Loader2 className="w-5 h-5 animate-spin" /> : (isRTL ? 'تأكيد وتحرير' : 'Release Funds')}
                        </button>
                      </form>
                    )}
                    {releaseError && (
                      <p className="text-rose-600 text-xs mt-2 font-bold">{releaseError}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Timeline Progress */}
        <div className="bg-white rounded-[2rem] border border-slate-200/80 p-6 sm:p-8 shadow-sm overflow-hidden">
          <h3 className="text-lg font-bold text-slate-900 mb-6">
            {isRTL ? 'تتبع الطلب' : 'Order Timeline'}
          </h3>
          <div className="relative flex justify-between">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -translate-y-1/2 z-0 rounded-full" />
            <div 
              className="absolute top-1/2 left-0 h-1 bg-blue-500 -translate-y-1/2 z-0 rounded-full transition-all duration-500" 
              style={{ 
                width: `${(timelineSteps.filter(s => s.active).length - 1) / (timelineSteps.length - 1) * 100}%`,
                ...(isRTL ? { left: 'auto', right: 0 } : {})
              }} 
            />
            
            {timelineSteps.map((step, idx) => (
              <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 transition-colors duration-300 ${
                  step.active 
                    ? 'bg-blue-500 border-blue-500 text-white' 
                    : 'bg-white border-slate-200 text-slate-300'
                }`}>
                  {step.active ? <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" /> : <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-slate-200" />}
                </div>
                <span className={`text-[10px] sm:text-xs font-bold w-16 text-center leading-tight ${
                  step.active ? 'text-blue-900' : 'text-slate-400'
                }`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Breakdown & Logistics Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Financial Breakdown */}
          <div className="bg-white rounded-[2rem] border border-slate-200/80 p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              {isRTL ? 'تفاصيل الدفع' : 'Payment Summary'}
            </h3>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">{isRTL ? 'سعر المنتج' : 'Item Price'}</span>
              <span className="font-bold text-slate-900">{formatEGP(productPrice, isRTL)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">{isRTL ? 'رسوم التوصيل' : 'Delivery Fee'}</span>
              <span className="font-bold text-slate-900">{formatEGP(deliveryFee, isRTL)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-900 font-black">{isRTL ? 'إجمالي المدفوع' : 'Total Paid'}</span>
              <span className="font-black text-emerald-600 text-lg">{formatEGP(order.amount, isRTL)}</span>
            </div>
          </div>

          {/* Delivery Info */}
          <div className="bg-white rounded-[2rem] border border-slate-200/80 p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-2">
              <Truck className="w-5 h-5 text-blue-600" />
              {isRTL ? 'بيانات الشحن' : 'Delivery Details'}
            </h3>
            
            <div className="flex flex-col py-2 border-b border-slate-100 gap-1">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{isRTL ? 'طريقة التسليم' : 'Method'}</span>
              <span className="font-bold text-slate-900">
                {order.handover_method === 'courier' ? (isRTL ? 'شحن بوسطة' : 'Bosta Express Courier') : (isRTL ? 'تسليم يدوي' : 'In-Person Meetup')}
              </span>
            </div>

            {order.handover_method === 'courier' && (
              <div className="flex flex-col py-2 border-b border-slate-100 gap-1">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{isRTL ? 'رقم التتبع' : 'AWB Tracking'}</span>
                <span className="font-mono font-bold text-blue-600">
                  {order.tracking_number || (isRTL ? 'جاري الإصدار...' : 'Pending...')}
                </span>
              </div>
            )}
            
            {order.shipping_address && (
              <div className="flex flex-col py-2 gap-1">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{isRTL ? 'العنوان' : 'Address'}</span>
                <p className="font-medium text-slate-900 text-sm">
                  {order.shipping_address.street}<br/>
                  {order.shipping_address.city}, {order.shipping_address.governorate}
                </p>
                <p className="font-medium text-slate-600 text-xs mt-1 flex items-center gap-1">
                  <User className="w-3 h-3" /> {order.shipping_address.full_name} | {order.shipping_address.phone}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Escrow Status Footer */}
        <div className="bg-emerald-900 rounded-[2rem] p-6 sm:p-8 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <ShieldCheck className="w-8 h-8 text-emerald-400 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-lg mb-1">
                {isRTL ? 'الضمان المالي ١٠٠٪' : '100% Escrow Protection'}
              </h4>
              <p className="text-emerald-100 text-sm leading-relaxed opacity-90">
                {order.status === 'completed' 
                  ? (isRTL ? 'تم تحرير الأموال للبائع بنجاح.' : 'Funds have been safely released to the seller.')
                  : (isRTL ? 'أموالك محفوظة بأمان حتى تؤكد الاستلام عبر الرمز.' : 'Funds are held safely in escrow until you release the PIN.')}
              </p>
            </div>
          </div>
          {isBuyer && order.status !== 'completed' && order.status !== 'cancelled' && (
            <button className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 rounded-xl transition-colors whitespace-nowrap text-sm border border-white/20">
              {isRTL ? 'فتح نزاع' : 'Open Dispute'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
