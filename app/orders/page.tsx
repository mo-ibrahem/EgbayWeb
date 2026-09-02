'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Package, ShieldCheck, Clock, CheckCircle2, Truck,
  RefreshCw, MessageSquare, AlertTriangle, ExternalLink
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  getUserOrders,
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
            {isRTL ? 'سجل الطلبات' : 'My Orders'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            {isRTL
              ? 'تتبع طلباتك وإدارة المبيعات بكل سهولة.'
              : 'Track your purchases and manage your sales.'}
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
              : 'Explore the marketplace and buy items with 100% escrow protection.'}
          </p>
          <Link
            href="/"
            className="bg-[#3665F3] hover:bg-[#2B54D4] text-white text-xs font-bold px-6 py-3 rounded-2xl shadow-lg shadow-blue-500/20 transition-all inline-block"
          >
            {isRTL ? 'تصفح السوق الآن' : 'Start Shopping'}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isBuyer = user?.id === order.buyer_id;
            const isCompleted = order.status === 'completed';
            const isDisputed = order.status === 'disputed';
            const isShipped = order.status === 'shipped' || order.status === 'out_for_delivery';
            const isDelivered = order.status === 'delivered';
            
            return (
              <div
                key={order.id}
                onClick={() => router.push(`/orders/${order.id}`)}
                className="bg-white rounded-3xl border border-gray-200/80 shadow-sm overflow-hidden transition-all hover:shadow-md hover:border-blue-300 cursor-pointer group"
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
                        {isRTL ? 'مكتمل ✅' : 'Completed ✅'}
                      </span>
                    )}
                    {isDisputed && (
                      <span className="bg-rose-50 text-rose-700 border border-rose-200 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {isRTL ? 'نزاع مفتوح ⚠️' : 'Dispute Active ⚠️'}
                      </span>
                    )}
                    {!isCompleted && !isDisputed && isShipped && (
                      <span className="bg-blue-50 text-blue-700 border border-blue-200 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5" />
                        {isRTL ? 'تم الشحن 📦' : 'Shipped 📦'}
                      </span>
                    )}
                    {!isCompleted && !isDisputed && isDelivered && (
                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {isRTL ? 'تم التسليم' : 'Delivered'}
                      </span>
                    )}
                    {!isCompleted && !isDisputed && !isShipped && !isDelivered && (
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {order.handover_method === 'courier' 
                          ? (isRTL ? 'بانتظار الشحن 🛡️' : 'Awaiting Dispatch 🛡️')
                          : (isRTL ? 'بانتظار التسليم اليدوي 🛡️' : 'Awaiting Meetup 🛡️')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Order Main Content */}
                <div className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
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
                      <h3 className="font-bold text-gray-900 text-sm sm:text-base group-hover:text-[#3665F3] transition-colors line-clamp-1">
                        {order.product?.title || (isRTL ? 'سلعة معروضة' : 'Marketplace Item')}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-base font-black text-[#3665F3]">
                          {formatEGP(order.amount)}
                        </span>
                        <span className="text-xs text-gray-400">
                          • {order.handover_method === 'courier' ? (isRTL ? 'شحن' : 'Courier') : (isRTL ? 'تسليم يدوي' : 'Meetup')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions (Delegated & Informational) */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/chat/${order.product_id}`);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors z-10"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-gray-500" />
                      <span>{isBuyer ? (isRTL ? 'محادثة البائع' : 'Chat Seller') : (isRTL ? 'محادثة المشتري' : 'Chat Buyer')}</span>
                    </button>

                    <button
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition-colors z-10"
                    >
                      <span>{isRTL ? 'التفاصيل' : 'Details'}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
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
