'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Package, ShieldCheck, Clock, CheckCircle2, Truck, QrCode,
  MapPin, AlertCircle, ArrowLeft, RefreshCw, KeyRound, ExternalLink,
  ChevronRight, Phone, MessageSquare, AlertTriangle, CheckCircle,
  HelpCircle, Eye, FileText, Send, X
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  getUserOrders,
  verifyAndReleaseOrder,
  updateOrderTracking,
  approveOrderDelivery,
  fileOrderDispute,
  getBostaTrackingUrl,
  type MarketplaceOrder
} from '@/lib/orderService';
import { formatEGP } from '@/lib/products';
import SmartImage from '@/components/SmartImage';

function OrdersContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isRTL } = useLanguage();

  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'purchases' | 'sales'>('all');

  // Modals
  const [pinModalOrder, setPinModalOrder] = useState<MarketplaceOrder | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [pinSuccessMsg, setPinSuccessMsg] = useState('');
  const [pinErrorMsg, setPinErrorMsg] = useState('');

  // Seller Tracking Modal
  const [trackingModalOrder, setTrackingModalOrder] = useState<MarketplaceOrder | null>(null);
  const [trackingNumberInput, setTrackingNumberInput] = useState('');
  const [trackingCourierInput, setTrackingCourierInput] = useState('Bosta Express (بوسطة مصر)');
  const [trackingStatusInput, setTrackingStatusInput] = useState<MarketplaceOrder['status']>('shipped');
  const [updatingTracking, setUpdatingTracking] = useState(false);
  const [trackingSuccessMsg, setTrackingSuccessMsg] = useState('');
  const [trackingErrorMsg, setTrackingErrorMsg] = useState('');

  // Dispute Modal
  const [disputeModalOrder, setDisputeModalOrder] = useState<MarketplaceOrder | null>(null);
  const [disputeReason, setDisputeReason] = useState('item_not_as_described');
  const [disputeNotes, setDisputeNotes] = useState('');
  const [filingDispute, setFilingDispute] = useState(false);
  const [disputeSuccessMsg, setDisputeSuccessMsg] = useState('');
  const [disputeErrorMsg, setDisputeErrorMsg] = useState('');

  // Buyer Early Approval
  const [approvingOrderId, setApprovingOrderId] = useState<string | null>(null);

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
    if (!user) { router.push('/login?redirect=/orders'); return; }
    loadOrders();
  }, [user, authLoading, router]);

  // Handlers
  const handleVerifyRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinModalOrder || !user || !enteredPin) return;
    setVerifyingPin(true);
    setPinErrorMsg('');
    setPinSuccessMsg('');
    try {
      const res = await verifyAndReleaseOrder(pinModalOrder.id, enteredPin, user.id);
      setPinSuccessMsg(res.message);
      setTimeout(async () => {
        setPinModalOrder(null);
        setEnteredPin('');
        setPinSuccessMsg('');
        await loadOrders();
      }, 1200);
    } catch (err: any) {
      setPinErrorMsg(err?.message || (isRTL ? 'كود PIN غير صحيح' : 'Invalid confirmation PIN'));
    } finally {
      setVerifyingPin(false);
    }
  };

  const handleUpdateTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingModalOrder || !trackingNumberInput.trim()) return;
    setUpdatingTracking(true);
    setTrackingErrorMsg('');
    setTrackingSuccessMsg('');
    try {
      await updateOrderTracking(trackingModalOrder.id, {
        tracking_number: trackingNumberInput.trim(),
        courier_name: trackingCourierInput,
        status: trackingStatusInput,
      });
      setTrackingSuccessMsg(isRTL ? 'تم تحديث رقم تتبع بوسطة بنجاح!' : 'Bosta tracking updated successfully!');
      setTimeout(async () => {
        setTrackingModalOrder(null);
        setTrackingSuccessMsg('');
        await loadOrders();
      }, 1200);
    } catch (err: any) {
      setTrackingErrorMsg(err?.message || 'Failed to update tracking');
    } finally {
      setUpdatingTracking(false);
    }
  };

  const handleApproveDelivery = async (orderId: string) => {
    if (!user) return;
    if (!confirm(isRTL ? 'هل تؤكد استلام السلعة ورضاك التام عنها لتحرير المبلغ للبائع؟' : 'Confirm you received and inspected the item to release funds to the seller?')) return;
    setApprovingOrderId(orderId);
    try {
      await approveOrderDelivery(orderId, user.id);
      await loadOrders();
    } catch (err: any) {
      alert(err?.message || 'Failed to approve order');
    } finally {
      setApprovingOrderId(null);
    }
  };

  const handleFileDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeModalOrder || !user || !disputeNotes.trim()) return;
    setFilingDispute(true);
    setDisputeErrorMsg('');
    setDisputeSuccessMsg('');
    try {
      const res = await fileOrderDispute(disputeModalOrder.id, {
        buyer_id: user.id,
        reason: disputeReason,
        notes: disputeNotes.trim(),
      });
      setDisputeSuccessMsg(res.message);
      setTimeout(async () => {
        setDisputeModalOrder(null);
        setDisputeNotes('');
        setDisputeSuccessMsg('');
        await loadOrders();
      }, 1500);
    } catch (err: any) {
      setDisputeErrorMsg(err?.message || 'Failed to file dispute');
    } finally {
      setFilingDispute(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'purchases') return order.buyer_id === user?.id;
    if (activeTab === 'sales') return order.seller_id === user?.id;
    return true;
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#3665F3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10">
      {/* ─── Header & Refresher ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-[#3665F3]" />
            {isRTL ? 'سجل الطلبات وتتبع الشحن والضمان' : 'Orders, Tracking & Escrow'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            {isRTL
              ? 'تتبع شحنات بوسطة، مهلة الفحص ٢٤ ساعة، وكود تحرير الأرباح للمشتري والبائع.'
              : 'Live Bosta courier updates, 24-hr inspection timer, and escrow PIN releases.'}
          </p>
        </div>

        <button
          onClick={loadOrders}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl shadow-sm transition-all"
        >
          <RefreshCw className="w-4 h-4 text-[#3665F3]" />
          <span>{isRTL ? 'تحديث الطلبات' : 'Refresh Orders'}</span>
        </button>
      </div>

      {/* ─── Tab Filters ─── */}
      <div className="flex items-center gap-2 mb-6 p-1 bg-gray-100 rounded-2xl max-w-md">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all text-center ${
            activeTab === 'all'
              ? 'bg-white text-[#3665F3] shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          {isRTL ? `الكل (${orders.length})` : `All (${orders.length})`}
        </button>
        <button
          onClick={() => setActiveTab('purchases')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all text-center ${
            activeTab === 'purchases'
              ? 'bg-white text-[#3665F3] shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          {isRTL ? 'مشترياتي 🛍️' : 'Purchases 🛍️'}
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all text-center ${
            activeTab === 'sales'
              ? 'bg-white text-[#3665F3] shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          {isRTL ? 'مبيعاتي 🏷️' : 'Sales 🏷️'}
        </button>
      </div>

      {/* ─── Orders List ─── */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-8 sm:p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-blue-50 text-[#3665F3] rounded-3xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">
            {isRTL ? 'لا توجد طلبات في هذا القسم' : 'No orders found'}
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mb-6">
            {isRTL
              ? 'تصفح أحدث السلع والإلكترونيات واشترِ بأمان مع حماية الضمان المالي ١٠٠٪.'
              : 'Explore the marketplace and buy items with 100% escrow protection and Bosta shipping.'}
          </p>
          <Link
            href="/"
            className="bg-[#3665F3] hover:bg-[#2B54D4] text-white text-xs font-bold px-6 py-3 rounded-2xl shadow-lg shadow-blue-500/20 transition-all inline-block"
          >
            {isRTL ? 'تصفح السوق الآن' : 'Start Shopping'}
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredOrders.map((order) => {
            const isBuyer = user?.id === order.buyer_id;
            const isCompleted = order.status === 'completed';
            const isDisputed = order.status === 'disputed';
            const isDelivered = order.status === 'delivered';
            const isShipped = order.status === 'shipped' || order.status === 'out_for_delivery';
            const isBosta = order.handover_method === 'courier';

            return (
              <div
                key={order.id}
                className="bg-white rounded-3xl border border-gray-200/80 shadow-sm overflow-hidden transition-all hover:shadow-md"
              >
                {/* Order Top Ribbon */}
                <div className="bg-gray-50/80 border-b border-gray-100 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-gray-500">#{order.id.slice(-8).toUpperCase()}</span>
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-500">
                      {new Date(order.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-EG', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                      isBuyer
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-purple-50 text-purple-700 border border-purple-200'
                    }`}>
                      {isBuyer ? (isRTL ? 'أنت المشتري 🛍️' : 'Buyer 🛍️') : (isRTL ? 'أنت البائع 🏷️' : 'Seller 🏷️')}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isCompleted && (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isRTL ? 'مكتمل ومُحرر للمحفظة ✅' : 'Completed & Released ✅'}
                      </span>
                    )}
                    {isDisputed && (
                      <span className="bg-rose-50 text-rose-700 border border-rose-200 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {isRTL ? 'نزاع مفتوح — الأموال مجمدة ⚠️' : 'Dispute Active ⚠️'}
                      </span>
                    )}
                    {!isCompleted && !isDisputed && isDelivered && (
                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1.5 animate-pulse">
                        <Clock className="w-3.5 h-3.5" />
                        {isRTL ? 'تم التسليم — مهلة الفحص ٢٤ ساعة نشطة' : 'Delivered — 24h Inspection Active'}
                      </span>
                    )}
                    {!isCompleted && !isDisputed && isShipped && (
                      <span className="bg-blue-50 text-blue-700 border border-blue-200 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5" />
                        {order.status === 'out_for_delivery'
                          ? (isRTL ? 'مع مندوب بوسطة للتسليم 🚚' : 'Out for Delivery 🚚')
                          : (isRTL ? 'تم الشحن في الطريق 📦' : 'Shipped with Courier 📦')}
                      </span>
                    )}
                    {!isCompleted && !isDisputed && !isDelivered && !isShipped && (
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {isRTL ? 'محجوز في الضمان 🛡️ (بانتظار الشحن)' : 'Escrow Secured 🛡️ (Awaiting Dispatch)'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Order Main Content */}
                <div className="p-4 sm:p-6 space-y-6">
                  {/* Product Details Row */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gray-100 relative overflow-hidden flex-shrink-0 border border-gray-100">
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
                        <Link
                          href={`/products/${order.product_id}`}
                          className="font-bold text-gray-900 text-sm sm:text-base hover:text-[#3665F3] transition-colors line-clamp-1"
                        >
                          {order.product?.title || (isRTL ? 'سلعة معروضة' : 'Marketplace Item')}
                        </Link>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-base font-black text-[#3665F3]">
                            {formatEGP(order.amount)}
                          </span>
                          <span className="text-xs text-gray-400">
                            • {order.handover_method === 'courier' ? (isRTL ? 'شحن بوسطة مصر' : 'Bosta Express') : (isRTL ? 'تسليم يدوي (PIN)' : 'In-Person PIN')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Chat with Counterparty */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Link
                        href={`/chat/${order.product_id}`}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-gray-500" />
                        <span>{isBuyer ? (isRTL ? 'محادثة البائع' : 'Chat Seller') : (isRTL ? 'محادثة المشتري' : 'Chat Buyer')}</span>
                      </Link>
                    </div>
                  </div>

                  {/* ─── Interactive Visual Delivery Stepper ─── */}
                  {isBosta && (
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-[#3665F3]" />
                          <span className="text-xs font-bold text-gray-900">
                            {isRTL ? 'خط سير الشحنة عبر بوسطة (Bosta)' : 'Bosta Live Delivery Tracking'}
                          </span>
                        </div>

                        {order.tracking_number && (
                          <span className="text-xs font-mono font-bold text-gray-600 bg-white px-2.5 py-1 rounded-lg border border-gray-200">
                            AWB: {order.tracking_number}
                          </span>
                        )}
                      </div>

                      {/* 4-Step Visual Progress Bar */}
                      <div className="grid grid-cols-4 gap-2 text-center text-[10px] sm:text-xs">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold mb-1 shadow-sm">
                            ✓
                          </div>
                          <span className="font-bold text-gray-800">{isRTL ? 'حجز الضمان' : 'Escrow Paid'}</span>
                        </div>

                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-1 transition-all ${
                            order.tracking_number || isShipped || isDelivered || isCompleted
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-gray-200 text-gray-400'
                          }`}>
                            {order.tracking_number || isShipped || isDelivered || isCompleted ? '✓' : '2'}
                          </div>
                          <span className="font-bold text-gray-800">{isRTL ? 'إصدار البوليصة' : 'AWB Issued'}</span>
                        </div>

                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-1 transition-all ${
                            isShipped || isDelivered || isCompleted
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-gray-200 text-gray-400'
                          }`}>
                            {isShipped || isDelivered || isCompleted ? '✓' : '3'}
                          </div>
                          <span className="font-bold text-gray-800">{isRTL ? 'مع المندوب' : 'In Transit'}</span>
                        </div>

                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-1 transition-all ${
                            isDelivered || isCompleted
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-gray-200 text-gray-400'
                          }`}>
                            {isDelivered || isCompleted ? '✓' : '4'}
                          </div>
                          <span className="font-bold text-gray-800">{isRTL ? 'تم التسليم' : 'Delivered'}</span>
                        </div>
                      </div>

                      {/* Deep Link to Official Bosta Portal */}
                      {order.tracking_number && (
                        <div className="mt-4 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] text-gray-500">
                            {isRTL ? 'الموعد التقديري:' : 'Estimated Delivery:'} <strong>{order.estimated_delivery || '24–48 Hours'}</strong>
                          </span>

                          <a
                            href={order.bosta_tracking_url || getBostaTrackingUrl(order.tracking_number)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#3665F3] hover:underline"
                          >
                            <span>{isRTL ? 'فتح التتبع المباشر على بوسطة' : 'Track Live on Bosta Portal'}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ─── Destination Address ─── */}
                  {order.shipping_address && (
                    <div className="bg-gray-50/70 rounded-2xl p-3.5 text-xs text-gray-600 flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-gray-900">
                          {isRTL ? 'عنوان التوصيل المستلم:' : 'Delivery Address:'} {order.shipping_address.full_name} ({order.shipping_address.phone})
                        </p>
                        <p className="text-gray-500 mt-0.5">
                          {order.shipping_address.governorate} — {order.shipping_address.city} — {order.shipping_address.street}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ─── Buyer Inspection & Protection Actions ─── */}
                  {isBuyer && !isCompleted && (
                    <div className="border border-blue-100 bg-blue-50/50 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      {order.meetup_pin && !isBosta ? (
                        <div>
                          <span className="block text-[10px] uppercase font-bold tracking-wider text-blue-700">
                            {isRTL ? 'كود تحرير الأرباح (PIN) للمقابلة اليدوية' : 'Handover Confirmation PIN'}
                          </span>
                          <span className="text-2xl font-mono font-black text-blue-900 tracking-widest">{order.meetup_pin}</span>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {isRTL ? 'أعطِ هذا الكود للبائع فقط بعد فحص واستلام السلعة.' : 'Give this code to seller ONLY after physically inspecting the item.'}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <h4 className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-[#3665F3]" />
                            {isRTL ? 'حماية الضمان المالي — مهلة فحص ٢٤ ساعة' : '100% Escrow Protection Active'}
                          </h4>
                          <p className="text-[11px] text-gray-600 mt-0.5 max-w-md">
                            {isRTL
                              ? 'أموالك محفوظة في الضمان. بعد استلام الطرد من بوسطة، يمكنك الموافقة على تحرير المبلغ للبائع أو فتح نزاع في حال وجود أي مشكلة.'
                              : 'Your money is safe in Escrow. Once received from Bosta, confirm satisfaction or open a dispute if there is any issue.'}
                          </p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => handleApproveDelivery(order.id)}
                          disabled={approvingOrderId === order.id}
                          className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{approvingOrderId === order.id ? (isRTL ? 'جاري التحقق...' : 'Releasing...') : (isRTL ? 'استلمت السلعة وأوافق' : 'Approve & Release Funds')}</span>
                        </button>

                        <button
                          onClick={() => { setDisputeModalOrder(order); setDisputeNotes(''); setDisputeErrorMsg(''); setDisputeSuccessMsg(''); }}
                          className="flex-1 sm:flex-none bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          <span>{isRTL ? 'طلب استرجاع / نزاع' : 'Open Dispute'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ─── Seller Dispatch & PIN Actions ─── */}
                  {!isBuyer && !isCompleted && (
                    <div className="border border-purple-100 bg-purple-50/50 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-purple-900">
                          {isRTL ? 'إدارة شحن الطلب واستحقاق الأرباح' : 'Order Fulfillment & Payout'}
                        </h4>
                        <p className="text-[11px] text-gray-600 mt-0.5">
                          {isRTL
                            ? 'أضف رقم بوليصة بوسطة لإرسال كود التتبع للمشتري، أو أدخل كود PIN في التسليم اليدوي لتحرير الأرباح لمحفظتك.'
                            : 'Add Bosta AWB number or enter buyer PIN for in-person handovers to release escrow to your wallet.'}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        {isBosta ? (
                          <button
                            onClick={() => {
                              setTrackingModalOrder(order);
                              setTrackingNumberInput(order.tracking_number || '');
                              setTrackingCourierInput(order.courier_name || 'Bosta Express (بوسطة مصر)');
                              setTrackingStatusInput(order.status || 'shipped');
                              setTrackingErrorMsg('');
                              setTrackingSuccessMsg('');
                            }}
                            className="flex-1 sm:flex-none bg-[#3665F3] hover:bg-[#2B54D4] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>{order.tracking_number ? (isRTL ? 'تعديل رقم بوسطة' : 'Update Bosta AWB') : (isRTL ? 'إضافة رقم بوليصة بوسطة' : 'Add Bosta AWB')}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => { setPinModalOrder(order); setEnteredPin(''); setPinErrorMsg(''); setPinSuccessMsg(''); }}
                            className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>{isRTL ? 'إدخال كود PIN المشتري' : 'Enter Buyer PIN'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Modal 1: Seller Update Bosta Tracking Number ─── */}
      {trackingModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setTrackingModalOrder(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-100" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#3665F3]" />
                {isRTL ? 'إضافة بوليصة شحن بوسطة' : 'Update Bosta Tracking AWB'}
              </h3>
              <button onClick={() => setTrackingModalOrder(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              {isRTL
                ? 'أدخل رقم الشحنة (AWB) الخاص ببوسطة ليتمكن المشتري من تتبع مسار الطرد لحظياً.'
                : 'Enter your Bosta shipment AWB number to enable real-time tracking for the buyer.'}
            </p>

            {trackingErrorMsg && <div className="mb-4 bg-red-50 text-red-700 text-xs p-3 rounded-xl border border-red-200">{trackingErrorMsg}</div>}
            {trackingSuccessMsg && <div className="mb-4 bg-emerald-50 text-emerald-700 text-xs p-3 rounded-xl border border-emerald-200">{trackingSuccessMsg}</div>}

            <form onSubmit={handleUpdateTracking} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  {isRTL ? 'رقم بوليصة بوسطة (AWB Number)' : 'Bosta Tracking AWB Number'}
                </label>
                <input
                  type="text"
                  value={trackingNumberInput}
                  onChange={e => setTrackingNumberInput(e.target.value)}
                  placeholder="مثال: 10482914 أو BOS-EG-9841"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono font-bold outline-none focus:border-[#3665F3]"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  {isRTL ? 'حالة الشحن الحالية' : 'Current Shipment Status'}
                </label>
                <select
                  value={trackingStatusInput}
                  onChange={e => setTrackingStatusInput(e.target.value as any)}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-[#3665F3] bg-white"
                >
                  <option value="shipped">{isRTL ? 'تم تسليم الطرد للمندوب (Shipped)' : 'Shipped with Courier'}</option>
                  <option value="out_for_delivery">{isRTL ? 'مع مندوب بوسطة للتسليم (Out for Delivery)' : 'Out for Delivery'}</option>
                  <option value="delivered">{isRTL ? 'تم التسليم للمشتري (Delivered)' : 'Delivered to Customer'}</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTrackingModalOrder(null)}
                  className="flex-1 border border-gray-200 text-gray-700 font-bold py-3 rounded-xl text-xs hover:bg-gray-50"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={updatingTracking || !trackingNumberInput.trim()}
                  className="flex-1 bg-[#3665F3] hover:bg-[#2B54D4] disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs shadow-md transition-colors"
                >
                  {updatingTracking ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ وإرسال التتبع' : 'Save & Notify Buyer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal 2: Verify Handover PIN ─── */}
      {pinModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setPinModalOrder(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-100" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-black text-gray-900">
                {isRTL ? 'تأكيد التسليم وتحرير الأرباح' : 'Verify Handover & Release Funds'}
              </h3>
              <button onClick={() => setPinModalOrder(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              {isRTL ? 'اطلب من المشتري كود الـ PIN الظاهر في شاشة طلبه لتحرير المبلغ لمحفظتك فوراً.' : 'Ask the buyer for the 6-digit confirmation PIN shown in their order screen.'}
            </p>

            {pinErrorMsg && <div className="mb-4 bg-red-50 text-red-700 text-xs p-3 rounded-xl border border-red-200">{pinErrorMsg}</div>}
            {pinSuccessMsg && <div className="mb-4 bg-emerald-50 text-emerald-700 text-xs p-3 rounded-xl border border-emerald-200">{pinSuccessMsg}</div>}

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
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-2xl font-mono font-bold tracking-widest text-center outline-none focus:border-[#3665F3]"
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
                  disabled={verifyingPin || enteredPin.length !== 6}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs shadow-md transition-colors"
                >
                  {verifyingPin ? (isRTL ? 'جاري التحقق...' : 'Verifying...') : (isRTL ? 'تحرير المبلغ للمحفظة' : 'Release Escrow')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal 3: Open Dispute / Return Claim ─── */}
      {disputeModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDisputeModalOrder(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-100" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-black text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                {isRTL ? 'فتح نزاع رسمي / طلب استرجاع' : 'Open Dispute & Return Claim'}
              </h3>
              <button onClick={() => setDisputeModalOrder(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              {isRTL
                ? 'سيتم تجميد أموال الضمان فوراً وسيتواصل معك فريق الوساطة لمراجعة تفاصيل الشحنة واسترجاع المبلغ.'
                : 'Escrow funds will be frozen immediately. Our compliance team will review your claim within 24 hours.'}
            </p>

            {disputeErrorMsg && <div className="mb-4 bg-red-50 text-red-700 text-xs p-3 rounded-xl border border-red-200">{disputeErrorMsg}</div>}
            {disputeSuccessMsg && <div className="mb-4 bg-emerald-50 text-emerald-700 text-xs p-3 rounded-xl border border-emerald-200">{disputeSuccessMsg}</div>}

            <form onSubmit={handleFileDispute} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  {isRTL ? 'سبب النزاع' : 'Dispute Reason'}
                </label>
                <select
                  value={disputeReason}
                  onChange={e => setDisputeReason(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-rose-500 bg-white"
                >
                  <option value="item_not_as_described">{isRTL ? 'السلعة غير مطابقة للمواصفات أو الصور' : 'Item not as described / photos'}</option>
                  <option value="damaged_in_shipping">{isRTL ? 'السلعة تالفة أو مكسورة بسبب الشحن' : 'Damaged in transit / broken'}</option>
                  <option value="counterfeit_replica">{isRTL ? 'السلعة مقلدة أو غير أصلية (Fake)' : 'Counterfeit / Replica item'}</option>
                  <option value="missing_accessories">{isRTL ? 'نقص في الملحقات أو الصندوق الموعود' : 'Missing accessories or parts'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  {isRTL ? 'تفاصيل المشكلة والعيب' : 'Issue Description & Details'}
                </label>
                <textarea
                  rows={3}
                  value={disputeNotes}
                  onChange={e => setDisputeNotes(e.target.value)}
                  placeholder={isRTL ? 'اشرح بالتفصيل ما العيب الموجود في السلعة المستلمة...' : 'Describe what was wrong with the item in detail...'}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 text-xs outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDisputeModalOrder(null)}
                  className="flex-1 border border-gray-200 text-gray-700 font-bold py-3 rounded-xl text-xs hover:bg-gray-50"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={filingDispute || !disputeNotes.trim()}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs shadow-md transition-colors"
                >
                  {filingDispute ? (isRTL ? 'جاري الإرسال...' : 'Submitting...') : (isRTL ? 'تجميد الضمان وتقديم النزاع' : 'Submit Claim & Freeze Escrow')}
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
