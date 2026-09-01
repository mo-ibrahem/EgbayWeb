'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getOrderById, MarketplaceOrder, COURIER_DELIVERY_FEE_EGP } from '@/lib/orderService';
import { 
  ArrowLeft, Package, ShieldCheck, Truck, Clock, MapPin, 
  Loader2, AlertCircle, CheckCircle2, Lock, AlertTriangle, 
  User, MessageCircle, BadgeCheck, FileText, ChevronRight, DollarSign 
} from 'lucide-react';
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

function getStatusLabel(status: string, isRTL: boolean) {
  switch (status) {
    case 'pending_payment': return isRTL ? 'بانتظار الدفع' : 'Awaiting Payment';
    case 'escrow_secured': return isRTL ? 'المدفوعات مؤمنة في الضمان' : 'Payment Secured — Escrow Protected';
    case 'shipped': return isRTL ? 'بانتظار التوصيل' : 'Awaiting Delivery';
    case 'out_for_delivery': return isRTL ? 'في الطريق إليك' : 'Out for Delivery';
    case 'delivered': return isRTL ? 'تم التوصيل' : 'Delivered';
    case 'completed': return isRTL ? 'الطلب مكتمل' : 'Order Completed';
    case 'cancelled': return isRTL ? 'ملغي' : 'Order Cancelled';
    case 'disputed': return isRTL ? 'متنازع عليه' : 'Disputed';
    default: return status.toUpperCase();
  }
}

export default function OrderDetailsPage() {
  const { id: orderId } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { isRTL } = useLanguage();

  const [order, setOrder] = useState<MarketplaceOrder | null>(null);
  const [sellerProfile, setSellerProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // PIN Logic
  const [buyerPin, setBuyerPin] = useState<string | null>(null);
  const [sellerPinInput, setSellerPinInput] = useState('');
  const [releasing, setReleasing] = useState(false);
  const [releaseSuccess, setReleaseSuccess] = useState(false);
  const [releaseError, setReleaseError] = useState('');
  
  const [markingDispatched, setMarkingDispatched] = useState(false);
  const [dispatchError, setDispatchError] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    async function loadOrder() {
      if (!orderId || !user) return;
      try {
        const fetchedOrder = await getOrderById(orderId as string);
        
        if (!fetchedOrder) {
          setErrorMsg(isRTL ? 'الطلب غير موجود' : 'Order not found');
          return;
        }

        if (fetchedOrder.buyer_id !== user.id && fetchedOrder.seller_id !== user.id) {
          setErrorMsg(isRTL ? 'غير مصرح بعرض هذا الطلب' : 'Unauthorized to view this order');
          return;
        }

        setOrder(fetchedOrder);

        // Fetch seller profile securely
        const { data: profile } = await supabase
          .from('public_profiles')
          .select('id, full_name, avatar_url, is_verified_seller')
          .eq('id', fetchedOrder.seller_id)
          .maybeSingle();
        if (profile) {
          setSellerProfile(profile);
        }

        // Load PIN from order or sessionStorage if buyer
        if (fetchedOrder.buyer_id === user.id) {
          if (fetchedOrder.handover_pin) {
            setBuyerPin(fetchedOrder.handover_pin);
          } else {
            const storedPin = sessionStorage.getItem(`egbay_pin_${orderId}`);
            if (storedPin) {
              setBuyerPin(storedPin);
            }
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

  const handleReleaseEscrow = async (e: React.FormEvent | null) => {
    if (e) e.preventDefault();
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
      const fetchedOrder = await getOrderById(orderId as string);
      if (fetchedOrder) setOrder(fetchedOrder);
    } catch (err: any) {
      setReleaseError(err.message || 'Invalid PIN or server error');
    } finally {
      setReleasing(false);
    }
  };

  const handleMarkDispatched = async () => {
    if (!orderId || !user) return;
    setMarkingDispatched(true);
    setDispatchError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ action: 'mark_dispatched', orderId })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to mark as dispatched');
      }
      const fetchedOrder = await getOrderById(orderId as string);
      if (fetchedOrder) setOrder(fetchedOrder);
    } catch (err: any) {
      setDispatchError(err.message || 'Server error');
    } finally {
      setMarkingDispatched(false);
    }
  };

  const handleOpenDispute = () => {
    window.location.href = `mailto:info@egbay.shop?subject=Dispute for Order ${orderId}`;
  };

  const handleChatSeller = async () => {
    if (!user || !order || chatLoading) return;
    setChatLoading(true);
    try {
      const participants = [user.id, order.seller_id].sort();
      const { data: existing } = await supabase
        .from('chat_rooms')
        .select('id')
        .contains('participant_ids', participants)
        .maybeSingle();

      let roomId: string;
      if (existing) {
        roomId = existing.id;
      } else {
        const { data: created, error } = await supabase
          .from('chat_rooms')
          .insert({ participant_ids: participants })
          .select('id')
          .single();
        if (error || !created) throw error;
        roomId = created.id;
      }
      router.push(`/chat/${roomId}`);
    } catch (err) {
      console.error('[OrderDetails] Failed to open chat:', err);
    } finally {
      setChatLoading(false);
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
  
  const isMeetup = order.handover_method === 'qr_meetup';
  const isCourier = order.handover_method === 'courier';

  // order.amount (and the product snapshot's price) already include the
  // courier fee for courier orders -- there's no separately stored base
  // item price, so derive it from the known fee constant instead of
  // computing a (structurally always-zero) difference.
  const deliveryFee = isCourier ? COURIER_DELIVERY_FEE_EGP : 0;
  const productPrice = Math.max(0, order.amount - deliveryFee);

  // 1. STATUS BADGE COLOR
  let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
  if (order.status === 'completed') badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  else if (order.status === 'escrow_secured') badgeColor = 'bg-blue-100 text-blue-800 border-blue-300';
  else if (['shipped', 'out_for_delivery', 'delivered'].includes(order.status)) badgeColor = 'bg-indigo-100 text-indigo-800 border-indigo-300';
  else if (order.status === 'cancelled') badgeColor = 'bg-slate-200 text-slate-600 border-slate-300';
  else if (order.status === 'disputed') badgeColor = 'bg-rose-100 text-rose-800 border-rose-300';

  // 2. TIMELINE LOGIC
  const timelineSteps = [
    { id: 'payment', label: isRTL ? 'الدفع مضمون' : 'Payment Secured', desc: isRTL ? 'أموالك محمية في الضمان' : 'Your payment is protected in escrow.', active: true },
    { id: 'dispatch', label: isRTL ? 'تنسيق الطلب' : (isMeetup ? 'Meetup Arranged' : 'Awaiting Dispatch'), desc: isRTL ? 'جاري تجهيز طلبك' : 'The seller is preparing your order.', active: ['escrow_secured', 'shipped', 'out_for_delivery', 'delivered', 'completed'].includes(order.status) },
    { id: 'transit', label: isRTL ? 'في الطريق' : (isMeetup ? 'Handover' : 'In Transit'), desc: isRTL ? 'الطلب في طريقه إليك' : 'Your order is on the way.', active: ['shipped', 'out_for_delivery', 'delivered', 'completed'].includes(order.status) },
    { id: 'delivered', label: isRTL ? 'تم التوصيل' : 'Delivered', desc: isRTL ? 'تم توصيل الطلب' : 'The item has been delivered.', active: ['delivered', 'completed'].includes(order.status) },
    { id: 'completed', label: isRTL ? 'مكتمل' : 'Completed', desc: isRTL ? 'الطلب مكتمل وتم تحرير الضمان' : 'The order is complete and escrow has been released.', active: order.status === 'completed' },
  ];

  // Derive current step
  const activeStepIndex = [...timelineSteps].reverse().findIndex(s => s.active);
  const currentStepIndex = activeStepIndex !== -1 ? timelineSteps.length - 1 - activeStepIndex : 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* 1. HEADER */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={(e) => { e.stopPropagation(); router.back(); }} 
              className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors"
            >
              <ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                {isRTL ? 'الطلب' : 'Order'} {shortOrderId}
              </h1>
              <p className="text-sm text-slate-500 font-medium">
                {isRTL ? 'تاريخ الطلب:' : 'Placed'} {new Date(order.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className={`px-4 py-2 rounded-full border font-bold text-sm flex items-center justify-center ${badgeColor}`}>
            {getStatusLabel(order.status, isRTL)}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* LEFT COLUMN: Main Info */}
        <div className="md:col-span-2 space-y-6">
          
          {/* 3. ESCROW PROTECTION — HIGH PRIORITY */}
          {order.status !== 'completed' && order.status !== 'cancelled' && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <ShieldCheck className="w-6 h-6 text-blue-600" />
                <h2 className="text-lg font-black text-blue-900 uppercase tracking-wide">
                  {isRTL ? 'مدفوعاتك محمية' : 'Your Payment is Protected'}
                </h2>
              </div>
              <p className="text-blue-800 text-sm font-medium leading-relaxed mb-4">
                {formatEGP(order.amount, isRTL)} {isRTL ? 'في أمان بحساب الضمان.' : 'is safely held in escrow.'} <br/>
                {isRTL 
                  ? 'لم يستلم البائع أمواله بعد. سيتم تحريرها فقط بعد تأكيد الاستلام.' 
                  : 'The seller has NOT received the funds yet. Funds are released only after the delivery/confirmation requirements are successfully completed.'}
              </p>
              <div className="space-y-2 text-sm text-blue-800 font-medium bg-blue-100/50 p-4 rounded-xl">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span>{isRTL ? 'تم استلام الدفعة' : 'Buyer payment received'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span>{isRTL ? 'المدفوعات مؤمنة' : 'Funds secured in escrow'}</span>
                </div>
                <div className="flex items-center gap-2 opacity-70">
                  <div className="w-4 h-4 rounded-full border-2 border-blue-400" />
                  <span>{isRTL ? 'بانتظار تأكيد الاستلام' : 'Seller payout pending delivery confirmation'}</span>
                </div>
              </div>
            </div>
          )}

          {/* 4. DELIVERY STATUS / TIMELINE */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm overflow-hidden">
            <h3 className="text-lg font-bold text-slate-900 mb-6">
              {isRTL ? 'تتبع الطلب' : 'Order Timeline'}
            </h3>
            
            <div className="relative">
              <div className="absolute top-4 left-4 sm:left-6 bottom-4 w-0.5 bg-slate-100 z-0" />
              
              <div className="space-y-6 relative z-10">
                {timelineSteps.map((step, idx) => {
                  const isCurrent = idx === currentStepIndex;
                  const isPast = idx < currentStepIndex;
                  
                  return (
                    <div key={step.id} className={`flex gap-4 sm:gap-6 ${!step.active && 'opacity-40 grayscale'}`}>
                      <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 border-4 border-white ${
                        isPast ? 'bg-blue-600 text-white' : 
                        isCurrent ? 'bg-blue-100 text-blue-600 border-blue-50 ring-2 ring-blue-600' : 
                        'bg-slate-200 text-slate-500'
                      }`}>
                        {isPast ? <CheckCircle2 className="w-4 h-4 sm:w-6 sm:h-6" /> : <span className="font-bold text-sm sm:text-base">{idx + 1}</span>}
                      </div>
                      <div className="pt-1 sm:pt-2 flex-1">
                        <h4 className={`font-bold ${isCurrent ? 'text-blue-700' : 'text-slate-900'}`}>{step.label}</h4>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 6. HANDOVER PIN */}
          {(isMeetup || (isCourier && isBuyer)) && order.status !== 'completed' && order.status !== 'cancelled' && (
            <div className={`rounded-2xl p-6 sm:p-8 shadow-sm border ${isBuyer ? 'bg-indigo-900 border-indigo-800 text-white' : 'bg-white border-blue-200'}`}>
              <h2 className={`text-lg font-black mb-2 uppercase tracking-wide flex items-center gap-2 ${isBuyer ? 'text-indigo-300' : 'text-slate-900'}`}>
                <Lock className="w-5 h-5" />
                {isRTL ? 'رمز التسليم الخاص بك' : (isCourier ? 'Your Delivery PIN' : 'Your Handover PIN')}
              </h2>
              
              {isBuyer ? (
                <div>
                  {buyerPin ? (
                    <div>
                      <div className="bg-indigo-950/50 border border-indigo-500/30 rounded-xl p-6 text-center my-6">
                        <div className="text-5xl sm:text-6xl font-mono font-black tracking-[0.25em] text-white">
                          {buyerPin}
                        </div>
                      </div>
                      <div className="bg-indigo-800/50 p-4 rounded-xl flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-indigo-300 flex-shrink-0 mt-0.5" />
                        <p className="text-indigo-100 text-sm font-medium leading-relaxed">
                          {isCourier 
                            ? (isRTL ? 'أعط هذا الرمز لمندوب الشحن فقط بعد استلامك وفحصك للطلب.' : 'Give this PIN to the courier only after you receive and inspect the item.') 
                            : (isRTL ? 'أعط هذا الرمز للبائع فقط بعد استلامك وفحصك للمنتج.' : 'Give this PIN to the seller only after you receive and inspect the item.')}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 mt-4">
                      <p className="text-rose-200 text-sm font-medium flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        {isRTL 
                          ? 'الرمز السري غير متاح لهذا الطلب (قد يكون الطلب قديماً أو مكتملاً).' 
                          : 'PIN is no longer available for this order (it may be a legacy order or already completed).'}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-slate-500 text-sm font-medium mb-6 leading-relaxed">
                    {isRTL 
                      ? 'أدخل الرمز السري المكون من ٦ أرقام الذي سيعطيه لك المشتري عند الاستلام.' 
                      : 'Enter the 6-digit PIN provided by the buyer upon successful handover to release funds.'}
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
                        className="flex-1 border border-slate-300 rounded-xl px-4 py-3 text-2xl text-center font-mono tracking-widest outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
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
                    <p className="text-rose-600 text-sm mt-3 font-bold">{releaseError}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 11. ORDER ACTIVITY */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              {isRTL ? 'سجل النشاط' : 'Order Activity'}
            </h3>
            <div className="space-y-4">
              {order.events?.length ? order.events.map((evt, i) => (
                <div key={i} className="flex justify-between items-start border-b border-slate-50 pb-4 last:pb-0 last:border-0">
                  <div>
                    <p className="font-bold text-sm text-slate-700">
                      {evt.event_type.replace(/_/g, ' ').toUpperCase()}
                    </p>
                    {evt.payload?.method && (
                      <p className="text-xs text-slate-500 mt-0.5">Method: {evt.payload.method}</p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap font-medium text-right">
                    {new Date(evt.created_at).toLocaleString(isRTL ? 'ar-EG' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              )) : (
                <p className="text-sm text-slate-400">No events found.</p>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Sidebar */}
        <div className="space-y-6">
          
          {/* 9. PRIMARY ACTIONS */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col gap-3">
            {order.status === 'completed' ? (
              <div className="bg-emerald-50 text-emerald-700 font-bold p-4 rounded-xl text-center border border-emerald-200 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                {isRTL ? 'الطلب مكتمل' : 'Order Completed ✓'}
              </div>
            ) : order.status === 'cancelled' ? (
              <div className="bg-slate-100 text-slate-600 font-bold p-4 rounded-xl text-center border border-slate-200">
                {isRTL ? 'الطلب ملغي' : 'Order Cancelled'}
              </div>
            ) : order.status === 'disputed' ? (
              <div className="bg-rose-50 text-rose-700 font-bold p-4 rounded-xl text-center border border-rose-200">
                {isRTL ? 'عرض النزاع' : 'View Dispute'}
              </div>
            ) : (
              <>
                {/* Dynamic CTAs */}
                {isCourier && isSeller && order.status === 'escrow_secured' && (
                  <button
                    onClick={handleMarkDispatched}
                    disabled={markingDispatched}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition-colors flex justify-center items-center shadow-md"
                  >
                    {markingDispatched ? <Loader2 className="w-5 h-5 animate-spin" /> : (isRTL ? 'تحديد كـ تم الشحن' : 'Mark as Dispatched')}
                  </button>
                )}
                
                {isCourier && isBuyer && order.status === 'escrow_secured' && (
                  <p className="text-xs text-slate-500 text-center font-medium mb-2">
                    {isRTL ? 'ستتمكن من تتبع طلبك بمجرد الشحن.' : 'Tracking will be available after dispatch.'}
                  </p>
                )}

                {isCourier && isBuyer && (order.status === 'shipped' || order.status === 'out_for_delivery') && (
                  releaseSuccess ? (
                    <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl border border-emerald-200 flex items-center gap-3 font-bold justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                      {isRTL ? 'تم تأكيد الاستلام وتحرير الأموال!' : 'Delivery confirmed, funds released!'}
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleReleaseEscrow(null)}
                        disabled={releasing}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition-colors flex justify-center items-center gap-2 shadow-md"
                      >
                        {releasing ? <Loader2 className="w-5 h-5 animate-spin" /> : (isRTL ? 'تأكيد استلام الطلب' : 'Confirm Delivery Received')}
                      </button>
                      <p className="text-xs text-slate-500 text-center font-medium">
                        {isRTL ? 'اضغط فقط بعد استلام وفحص طلبك. سيتم تحرير الأموال للبائع فوراً.' : 'Only confirm after you’ve received and inspected your item. This immediately releases funds to the seller.'}
                      </p>
                    </>
                  )
                )}

                {/* Dispute CTA */}
                {isBuyer && (
                  <button
                    onClick={handleOpenDispute}
                    className="w-full bg-white border-2 border-slate-200 hover:border-rose-300 hover:text-rose-600 text-slate-700 font-bold py-3 px-4 rounded-xl transition-colors"
                  >
                    {isRTL ? 'فتح نزاع' : 'Open Dispute'}
                  </button>
                )}
              </>
            )}
            
            {/* Seller Action Info */}
            {isCourier && isSeller && order.status === 'shipped' && (
               <div className="bg-amber-50 text-amber-700 p-4 rounded-xl border border-amber-200 text-center text-sm font-bold">
                 {isRTL ? 'بانتظار توصيل المندوب' : 'Awaiting Courier Delivery'}
               </div>
            )}
            {isCourier && isSeller && order.status === 'out_for_delivery' && (
               <div className="bg-blue-50 text-blue-700 p-4 rounded-xl border border-blue-200 text-center text-sm font-bold">
                 {isRTL ? 'المندوب يقوم بتوصيل طلبك' : 'Courier is delivering your order'}
               </div>
            )}
            {dispatchError && <p className="text-rose-600 text-xs mt-1 font-bold text-center">{dispatchError}</p>}
            {releaseError && !isMeetup && <p className="text-rose-600 text-xs mt-1 font-bold text-center">{releaseError}</p>}
            
            {/* 10. DISPUTE COPY */}
            {isBuyer && order.status !== 'completed' && order.status !== 'cancelled' && (
              <p className="text-xs text-slate-500 text-center mt-2 font-medium px-2">
                {isRTL ? 'لديك مشكلة؟ افتح نزاعاً قبل تحرير الضمان.' : 'Having a problem with your order? Open a dispute before escrow is released.'}
              </p>
            )}
          </div>

          {/* 2. PRODUCT SUMMARY CARD */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4">
              {isRTL ? 'المنتج' : 'Item Summary'}
            </h3>
            <div className="flex items-start gap-4 mb-6">
              <div className="w-16 h-16 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden relative flex-shrink-0">
                {order.product?.images?.[0] ? (
                  <SmartImage src={order.product.images[0]} alt={order.product.title || 'Product'} fill className="object-cover" sizes="64px" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <Package className="w-6 h-6" />
                  </div>
                )}
              </div>
              <div>
                <Link href={`/products/${order.product_id}`} className="text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors line-clamp-2" onClick={(e) => e.stopPropagation()}>
                  {order.product?.title || 'Marketplace Item'}
                </Link>
                <div className="mt-1 text-sm font-bold text-slate-500">
                  {formatEGP(productPrice, isRTL)} <span className="font-normal mx-1">×</span> 1
                </div>
              </div>
            </div>

            {/* 8. SELLER SECTION */}
            {sellerProfile && (
              <div className="border-t border-slate-100 pt-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
                  {isRTL ? 'البائع' : 'Seller'}
                </h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                      {sellerProfile.avatar_url ? (
                        <SmartImage src={sellerProfile.avatar_url} alt="Avatar" fill className="object-cover" sizes="40px" />
                      ) : (
                        <User className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 flex items-center gap-1">
                        {sellerProfile.full_name || 'Marketplace Seller'}
                        {sellerProfile.is_verified_seller && <BadgeCheck className="w-4 h-4 text-blue-500" />}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleChatSeller}
                    disabled={chatLoading}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50"
                    title={isRTL ? 'مراسلة البائع' : 'Chat Seller'}
                  >
                    <MessageCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 7. PAYMENT SUMMARY */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4">
              {isRTL ? 'ملخص الدفع' : 'Payment Summary'}
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-600 font-medium">
                <span>{isRTL ? 'سعر المنتج' : 'Item Price'}</span>
                <span>{formatEGP(productPrice, isRTL)}</span>
              </div>
              <div className="flex justify-between text-slate-600 font-medium">
                <span>{isRTL ? 'رسوم التوصيل' : 'Delivery Fee'}</span>
                <span>{formatEGP(deliveryFee, isRTL)}</span>
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-between font-black text-slate-900 text-base">
                <span>{isRTL ? 'إجمالي المدفوع' : 'Total Paid'}</span>
                <span>{formatEGP(order.amount, isRTL)}</span>
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">{isRTL ? 'طريقة الدفع' : 'Payment Method'}</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1">
                    {/* Simplified for MVP, assumes Wallet if Escrow is used natively */}
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    {isRTL ? 'محفظة Egbay' : 'Egbay Wallet'}
                  </span>
                </div>
              </div>
              
              {/* Financial direction explicit */}
              <div className="mt-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                {isBuyer ? (
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    <span className="font-bold text-rose-600">You paid:</span> {formatEGP(order.amount, isRTL)} <br/>
                  </p>
                ) : (
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    <span className="font-bold text-emerald-600">Escrow holding:</span> {formatEGP(order.amount, isRTL)} pending <br/>
                    <span className="text-slate-400 mt-1 block">Payout pending legitimate release.</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 5. DELIVERY DETAILS */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4">
              {isRTL ? 'بيانات الشحن' : 'Delivery Details'}
            </h3>
            <div className="space-y-4">
              <div className="flex flex-col">
                <span className="text-xs text-slate-400 font-medium">{isRTL ? 'الوسيلة' : 'Method'}</span>
                <span className="text-sm font-bold text-slate-900">{isMeetup ? 'Local Meetup' : 'Courier Delivery'}</span>
              </div>
              
              {isCourier && (
                <>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 font-medium">{isRTL ? 'شركة الشحن' : 'Courier'}</span>
                    <span className="text-sm font-bold text-slate-900">{order.courier_name || 'Bosta Express'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 font-medium">{isRTL ? 'رقم التتبع (AWB)' : 'AWB / Tracking'}</span>
                    {order.tracking_number ? (
                      <span className="text-sm font-mono font-bold text-blue-600">{order.tracking_number}</span>
                    ) : (
                      <span className="text-sm font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded inline-block w-max mt-1">
                        {isRTL ? 'بانتظار الشحن' : 'Awaiting dispatch'}
                      </span>
                    )}
                  </div>
                </>
              )}

              {order.shipping_address && (
                <div className="border-t border-slate-100 pt-4 mt-2">
                  <div className="flex flex-col gap-1 text-sm text-slate-600 font-medium">
                    <span className="font-bold text-slate-900">{order.shipping_address.full_name}</span>
                    <span>{order.shipping_address.phone}</span>
                    <span>{order.shipping_address.street}{order.shipping_address.building ? `, Bldg ${order.shipping_address.building}` : ''}</span>
                    <span>{order.shipping_address.city}, {order.shipping_address.governorate}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
