'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Package, ShieldCheck, Clock, CheckCircle2, Truck, QrCode,
  MapPin, AlertCircle, ArrowLeft, RefreshCw, KeyRound, ExternalLink
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getUserOrders, verifyAndReleaseOrder, type MarketplaceOrder } from '@/lib/orderService';
import { formatEGP } from '@/lib/products';
import SmartImage from '@/components/SmartImage';

function OrdersContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isRTL } = useLanguage();
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinModalOrder, setPinModalOrder] = useState<MarketplaceOrder | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState('');
  const [verifyError, setVerifyError] = useState('');

  const loadOrders = async () => {
    if (!user) return;
    try {
      const data = await getUserOrders(user.id);
      setOrders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    loadOrders();
  }, [user, authLoading, router]);

  const handleVerifyRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinModalOrder || !user || !enteredPin) return;
    setVerifying(true);
    setVerifyError('');
    setVerifyMsg('');
    try {
      const res = await verifyAndReleaseOrder(pinModalOrder.id, enteredPin, user.id);
      setVerifyMsg(res.message);
      setTimeout(async () => {
        setPinModalOrder(null);
        setEnteredPin('');
        setVerifyMsg('');
        await loadOrders();
      }, 1500);
    } catch (err: any) {
      setVerifyError(err?.message || (isRTL ? 'كود PIN غير صحيح' : 'Invalid confirmation PIN'));
    } finally {
      setVerifying(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-600" />
            {isRTL ? 'الطلبات وتتبع الضمان المالي' : 'My Orders & Escrow Track'}
          </h1>
          <p className="text-sm text-gray-500">
            {isRTL ? 'تتبع حالة الشحن واستلام كود PIN لتحرير الأرباح للبائعين' : 'Track purchase delivery and verify in-person releases'}
          </p>
        </div>
        <button
          onClick={loadOrders}
          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-xl transition-colors"
          title={isRTL ? 'تحديث الطلبات' : 'Refresh orders'}
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 mb-1">
            {isRTL ? 'لا توجد طلبات مسجلة حتى الآن' : 'No orders placed yet'}
          </h3>
          <p className="text-xs text-gray-400 mb-5">
            {isRTL ? 'تصفح الإعلانات واشترِ بأمان مع حماية الضمان المالي ١٠٠٪.' : 'Browse the marketplace and buy items with full escrow protection.'}
          </p>
          <Link
            href="/"
            className="bg-blue-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors inline-block"
          >
            {isRTL ? 'تصفح السوق الآن' : 'Start Shopping'}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isBuyer = user?.id === order.buyer_id;
            const isCompleted = order.status === 'completed';

            return (
              <div
                key={order.id}
                className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row gap-6 items-start md:items-center justify-between"
              >
                {/* Product details */}
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-gray-100 overflow-hidden relative flex-shrink-0">
                    {order.product?.images?.[0] ? (
                      <SmartImage
                        src={order.product.images[0]}
                        alt={order.product.title || ''}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <Package className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm truncate">{order.product?.title || (isRTL ? 'منتج معروض' : 'Marketplace Item')}</p>
                    <p className="text-blue-600 font-black text-sm mt-0.5">{formatEGP(order.amount)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {order.handover_method === 'courier' ? (isRTL ? '🚚 شحن بوسطة' : '🚚 Bosta Express') : (isRTL ? '🤝 تسليم يدوي' : '🤝 Meetup Handover')} · {isBuyer ? (isRTL ? 'أنت المشتري' : 'You are Buyer') : (isRTL ? 'أنت البائع' : 'You are Seller')}
                    </p>
                  </div>
                </div>

                {/* Actions / PIN Display */}
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                  <div className="text-right rtl:text-left hidden md:block">
                    <span className="block text-xs font-mono font-bold text-gray-400">#{order.id.slice(-8).toUpperCase()}</span>
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      isCompleted
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {isCompleted
                        ? (isRTL ? '✓ مكتمل ومُحرر للمحفظة' : '✓ Completed & Released')
                        : (isRTL ? '🛡️ مؤمّن في حساب الضمان' : '🛡️ Escrow Secured')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isBuyer && !isCompleted && order.meetup_pin && (
                      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-2 text-center">
                        <span className="block text-[10px] uppercase tracking-wider font-bold text-blue-700">
                          {isRTL ? 'كود تحرير المبلغ (PIN)' : 'Release PIN'}
                        </span>
                        <span className="text-base font-mono font-black text-blue-900 tracking-widest">{order.meetup_pin}</span>
                      </div>
                    )}

                    {!isBuyer && !isCompleted && (
                      <button
                        onClick={() => { setPinModalOrder(order); setEnteredPin(''); setVerifyError(''); setVerifyMsg(''); }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
                      >
                        <KeyRound className="w-4 h-4" />
                        {isRTL ? 'إدخال كود المشتري' : 'Enter Buyer PIN'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Enter PIN Modal */}
      {pinModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setPinModalOrder(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-gray-900 mb-1">
              {isRTL ? 'تأكيد التسليم وتحرير الأرباح' : 'Verify Handover & Release Funds'}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {isRTL ? 'اطلب من المشتري كود الـ PIN الظاهر في شاشة طلبه لتحرير المبلغ لمحفظتك فوراً.' : 'Ask the buyer for the 6-digit confirmation PIN shown in their order screen.'}
            </p>

            {verifyError && <div className="mb-4 bg-red-50 text-red-700 text-xs p-3 rounded-xl border border-red-200">{verifyError}</div>}
            {verifyMsg && <div className="mb-4 bg-emerald-50 text-emerald-700 text-xs p-3 rounded-xl border border-emerald-200">{verifyMsg}</div>}

            <form onSubmit={handleVerifyRelease} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  {isRTL ? 'كود الـ PIN المكون من ٦ أرقام' : '6-Digit Release PIN'}
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={enteredPin}
                  onChange={e => setEnteredPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-2xl font-mono font-bold tracking-widest text-center outline-none focus:border-blue-500"
                  autoFocus
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPinModalOrder(null)}
                  className="flex-1 border border-gray-200 text-gray-700 font-bold py-3 rounded-xl text-xs hover:bg-gray-50"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={verifying || enteredPin.length !== 6}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs shadow-md transition-colors"
                >
                  {verifying ? (isRTL ? 'جاري التحقق...' : 'Verifying...') : (isRTL ? 'تحرير المبلغ للمحفظة' : 'Release Escrow')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <ProtectedRoute>
      <OrdersContent />
    </ProtectedRoute>
  );
}
