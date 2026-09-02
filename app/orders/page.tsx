'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package, RefreshCw, MessageSquare, ChevronRight } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getUserOrders, type MarketplaceOrder } from '@/lib/orderService';
import { formatEGP } from '@/lib/products';
import { supabase } from '@/lib/supabase';
import { getOrCreateChatRoom } from '@/lib/chatService';
import SmartImage from '@/components/SmartImage';
import StatusPill from '@/components/ui/StatusPill';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';

function OrdersContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isRTL } = useLanguage();

  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'purchases' | 'sales'>('all');
  const [chattingOrderId, setChattingOrderId] = useState<string | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, router]);

  // Opens (or creates) the real chat room between the order's buyer and
  // seller -- the previous version linked to /chat/${order.product_id},
  // which is not a chat room id and never resolved to a real
  // conversation. Chat rooms are looked up by the participant pair, the
  // same pattern used on the product detail page.
  const handleChatAboutOrder = async (order: MarketplaceOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    const otherPartyId = user.id === order.buyer_id ? order.seller_id : order.buyer_id;
    if (!otherPartyId) return;
    setChattingOrderId(order.id);
    try {
      const roomId = await getOrCreateChatRoom(user.id, otherPartyId, order.product_id);
      router.push(`/chat/${roomId}`);
    } catch (err) {
      console.error('[Orders] Failed to open chat:', err);
    } finally {
      setChattingOrderId(null);
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
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    // `w-full` is load-bearing, not decoration: this div is the page root,
    // and PageTransition used to wrap it in a flex column, which made it a
    // flex item -- and a flex item with `mx-auto` sizes to fit-content
    // instead of stretching, so this list shrink-wrapped to its cards and
    // ignored max-w-7xl entirely. PageTransition no longer does that, and
    // `w-full` keeps this page correct regardless.
    <div className="w-full max-w-7xl mx-auto px-4 py-6 sm:py-8">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-black text-slate-900">{isRTL ? 'سجل الطلبات' : 'My Orders'}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{isRTL ? 'تتبع مشترياتك ومبيعاتك' : 'Track your purchases and sales'}</p>
        </div>
        <button onClick={loadOrders} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors flex-shrink-0">
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isRTL ? 'تحديث' : 'Refresh'}</span>
        </button>
      </div>

      <div className="flex items-center gap-1 mb-5 p-1 bg-slate-100 rounded-md max-w-md">
        {([
          { key: 'all', label: isRTL ? `الكل (${orders.length})` : `All (${orders.length})` },
          { key: 'purchases', label: isRTL ? 'مشترياتي' : 'Purchases' },
          { key: 'sales', label: isRTL ? 'مبيعاتي' : 'Sales' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-1.5 rounded-sm text-xs font-bold transition-colors ${
              activeTab === tab.key ? 'bg-white text-brand shadow-card' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={<Package className="w-6 h-6" />}
          title={isRTL ? 'لا توجد طلبات في هذا القسم' : 'No orders found'}
          description={isRTL ? 'تصفح السوق واشترِ بأمان مع حماية الضمان المالي.' : 'Browse the marketplace and buy with escrow protection.'}
          action={<Button href="/">{isRTL ? 'تصفح السوق' : 'Start Shopping'}</Button>}
          className="bg-white border border-slate-200 rounded-lg"
        />
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isBuyer = user?.id === order.buyer_id;
            return (
              <div
                key={order.id}
                onClick={() => router.push(`/orders/${order.id}`)}
                className="card-hover bg-white rounded-lg border border-slate-200 overflow-hidden cursor-pointer group"
              >
                <div className="bg-slate-50 border-b border-slate-100 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="font-mono font-bold">#{order.id.slice(-8).toUpperCase()}</span>
                    <span className="text-slate-300">•</span>
                    <span>{new Date(order.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-EG', { month: 'short', day: 'numeric' })}</span>
                    <span className="text-slate-300">•</span>
                    <span className="font-bold">{isBuyer ? (isRTL ? 'مشتري' : 'Buyer') : (isRTL ? 'بائع' : 'Seller')}</span>
                  </div>
                  <StatusPill status={order.status} size="sm" />
                </div>

                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-14 h-14 rounded-md bg-slate-100 relative overflow-hidden flex-shrink-0">
                      {order.product?.images?.[0] ? (
                        <SmartImage src={order.product.images[0]} alt={order.product.title || ''} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300"><Package className="w-6 h-6" /></div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 text-sm group-hover:text-brand transition-colors line-clamp-1">
                        {order.product?.title || (isRTL ? 'سلعة معروضة' : 'Marketplace Item')}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs">
                        <span className="font-black text-slate-900">{formatEGP(order.amount)}</span>
                        <span className="text-slate-400">• {order.handover_method === 'courier' ? (isRTL ? 'شحن' : 'Courier') : (isRTL ? 'تسليم يدوي' : 'Meetup')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={(e) => handleChatAboutOrder(order, e)}
                      disabled={chattingOrderId === order.id}
                      className="p-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors disabled:opacity-50"
                      aria-label={isRTL ? 'محادثة' : 'Chat'}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className={`w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors ${isRTL ? 'rotate-180' : ''}`} />
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
