'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, ShieldCheck, ArrowRight, Package, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import SmartImage from '@/components/SmartImage';
import { useLanguage } from '@/components/LanguageProvider';

function formatEGP(amount: number, isRTL: boolean) {
  return new Intl.NumberFormat(isRTL ? 'ar-EG' : 'en-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 0,
  }).format(amount);
}

interface OrderStatusSummary {
  id: string;
  buyer_id: string;
  status: string;
  created_at: string;
  amount: number;
  handover_method: 'courier' | 'qr_meetup';
}

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isRTL } = useLanguage();
  const orderId = searchParams.get('orderId');

  const [order, setOrder] = useState<OrderStatusSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [plaintextPin, setPlaintextPin] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrder() {
      if (!orderId) {
        setErrorMsg('Order ID is missing');
        setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setErrorMsg('Unauthorized. Please log in.');
          setLoading(false);
          return;
        }

        // Explicit column list -- never select('*') on orders from the
        // client. handover_pin_hash/handover_pin_encrypted must not be
        // readable directly (a seller could otherwise read the hash for
        // an order they're on and brute-force the 6-digit PIN offline);
        // the buyer-only decrypted PIN is delivered exclusively via
        // /api/orders, not via a direct table select.
        const { data: fetchedOrder, error: fetchErr } = await supabase
          .from('orders')
          .select('id, buyer_id, status, created_at, amount, handover_method')
          .eq('id', orderId)
          .single();
        
        if (fetchErr || !fetchedOrder) {
          setErrorMsg('Order not found');
          setLoading(false);
          return;
        }

        if (fetchedOrder.buyer_id !== user.id) {
          setErrorMsg('Unauthorized to view this order');
          setLoading(false);
          return;
        }

        setOrder(fetchedOrder);

        // Retrieve PIN from sessionStorage if available
        const stashedPin = sessionStorage.getItem(`egbay_pin_${orderId}`);
        if (stashedPin) {
          setPlaintextPin(stashedPin);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Error loading order');
      } finally {
        setLoading(false);
      }
    }

    loadOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">{isRTL ? 'عفواً، حدث خطأ' : 'Oops, an error occurred'}</h1>
        <p className="text-slate-500 mb-6">{errorMsg}</p>
        <Link href="/" className="px-6 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-colors">
          {isRTL ? 'العودة للرئيسية' : 'Return Home'}
        </Link>
      </div>
    );
  }

  if (!order) return null;

  const shortOrderId = `#${order.id.split('-')[0].toUpperCase()}`;
  const isPending = order.status === 'pending_payment';

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 flex justify-center">
      <div className="max-w-xl w-full space-y-6">
        {/* Success Header */}
        <div className="bg-white rounded-[2rem] border border-slate-200/80 p-8 text-center shadow-xl">
          <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-lg ${
            isPending ? 'bg-amber-100 text-amber-600 shadow-amber-500/20' : 'bg-emerald-100 text-emerald-600 shadow-emerald-500/20'
          }`}>
            {isPending ? <Loader2 className="w-10 h-10 animate-spin" /> : <CheckCircle2 className="w-10 h-10" />}
          </div>

          <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">
            {isPending 
              ? (isRTL ? 'جاري تأكيد الدفع...' : 'Payment Pending...')
              : (isRTL ? 'تم تأكيد طلبك بنجاح! 🎉' : 'Order Confirmed! 🎉')}
          </h1>
          
          <p className="text-sm text-slate-500 mb-8 max-w-sm mx-auto">
            {isPending
              ? (isRTL ? 'نحن في انتظار تأكيد البنك. برجاء الانتظار بضع دقائق وتحديث الصفحة.' : 'Waiting for bank confirmation. Please wait a few minutes and refresh.')
              : (isRTL ? 'تم حجز المبلغ بأمان في حساب الضمان. سيتم إشعار البائع لتجهيز طلبك.' : 'Funds are held safely in escrow. The seller has been notified.')}
          </p>

          {/* Order Info Card */}
          <div className="bg-slate-50 rounded-3xl p-5 text-sm space-y-3 text-left rtl:text-right border border-slate-100">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">{isRTL ? 'رقم الطلب' : 'Order No.'}</span>
              <span className="font-mono font-bold text-slate-800 bg-white px-2 py-1 rounded-lg border border-slate-200">{shortOrderId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">{isRTL ? 'التاريخ' : 'Date'}</span>
              <span className="font-bold text-slate-800">
                {new Date(order.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-slate-200/60">
              <span className="text-slate-500 font-medium">{isRTL ? 'إجمالي المدفوع' : 'Total Paid'}</span>
              <span className="font-black text-lg text-emerald-600">{formatEGP(order.amount, isRTL)}</span>
            </div>
          </div>
        </div>

        {/* PIN Box for Handover */}
        {order.handover_method === 'qr_meetup' && !isPending && (
          <div className="bg-white rounded-[2rem] border border-blue-200/80 p-8 text-center shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {isRTL ? 'كود التسليم السري (PIN)' : 'Secret Handover PIN'}
            </h3>
            
            {plaintextPin ? (
              <>
                <p className="text-xs text-slate-500 mb-6">
                  {isRTL ? 'أعط هذا الكود للبائع فقط بعد استلام ومعاينة المنتج.' : 'Give this PIN to the seller ONLY after inspecting your item.'}
                </p>
                <div className="bg-blue-50 border-2 border-blue-100 rounded-2xl py-6 px-4">
                  <span className="text-5xl font-black tracking-[0.2em] text-blue-700 font-mono">
                    {plaintextPin}
                  </span>
                </div>
              </>
            ) : (
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <p className="text-xs text-slate-500 leading-relaxed">
                  {isRTL 
                    ? 'لدواعي أمنية، تم إخفاء الكود السري. برجاء مراجعة رسائل البريد الإلكتروني أو الـ SMS للحصول عليه، أو يمكنك إيجاده في صفحة "طلباتي".'
                    : 'For your security, the PIN is hidden. Please check your Email/SMS or view your active orders to retrieve it.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Escrow Banner */}
        <div className="bg-emerald-900 rounded-3xl p-6 text-white shadow-xl flex items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl" />
          <ShieldCheck className="w-10 h-10 text-emerald-400 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-lg mb-1">{isRTL ? 'حماية الضمان المالي ١٠٠٪' : '100% Escrow Protection'}</h4>
            <p className="text-emerald-100 text-xs leading-relaxed opacity-90">
              {isRTL 
                ? 'أموالك محفوظة بأمان لدى إيجي باي. لن يتم تحويلها للبائع إلا بعد استلامك للمنتج وتأكيد مطابقته للمواصفات.' 
                : 'Your funds are secured by EgyBay. They will not be released to the seller until you receive and verify the item.'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <Link
            href="/orders"
            className="block w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl text-sm transition-all text-center shadow-md shadow-slate-900/10"
          >
            {isRTL ? 'تتبع طلباتي' : 'View My Orders'}
          </Link>
          <Link
            href="/"
            className="block w-full bg-white hover:bg-slate-50 text-slate-700 font-bold py-4 rounded-2xl text-sm transition-all text-center border border-slate-200 shadow-sm"
          >
            {isRTL ? 'الاستمرار في التسوق' : 'Continue Shopping'}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 animate-spin text-emerald-600 rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    }>
      <OrderSuccessContent />
    </Suspense>
  );
}
