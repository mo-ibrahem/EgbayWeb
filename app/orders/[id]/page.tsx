'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getOrderById, MarketplaceOrder } from '@/lib/orderService';
import { ArrowLeft, Package, ShieldCheck, Truck, Clock, MapPin, Loader2, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import SmartImage from '@/components/SmartImage';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { formatEGP } from '@/lib/products';

export default function OrderDetailsPage() {
  const { id: orderId } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { isRTL } = useLanguage();

  const [order, setOrder] = useState<MarketplaceOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function loadOrder() {
      if (!orderId || !user) return;
      try {
        const fetchedOrder = await getOrderById(orderId);
        
        if (!fetchedOrder) {
          setErrorMsg('Order not found');
          return;
        }

        // Strict Authorization (Buyer or Seller ONLY)
        if (fetchedOrder.buyer_id !== user.id && fetchedOrder.seller_id !== user.id) {
          setErrorMsg('Unauthorized to view this order');
          return;
        }

        setOrder(fetchedOrder);
      } catch (err: any) {
        setErrorMsg(err.message || 'Error loading order details');
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadOrder();
    }
  }, [orderId, user]);

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
  const shortOrderId = `#${order.id.slice(-8).toUpperCase()}`;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation */}
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">
          <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
          {isRTL ? 'الرجوع للطلبات' : 'Back to Orders'}
        </button>

        {/* Header */}
        <div className="bg-white rounded-[2rem] border border-slate-200/80 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                {isRTL ? 'تفاصيل الطلب' : 'Order Details'}
                <span className="font-mono text-base font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
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
              {isRTL ? 'حالة الطلب: ' : 'Status: '}
              {order.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="w-20 h-20 bg-white rounded-xl border border-slate-200 overflow-hidden relative flex-shrink-0">
              {order.product?.images?.[0] ? (
                <SmartImage src={order.product.images[0]} alt={order.product.title} fill className="object-cover" sizes="80px" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <Package className="w-8 h-8" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <Link href={`/products/${order.product_id}`} className="text-lg font-bold text-slate-900 hover:text-blue-600 transition-colors line-clamp-1">
                {order.product?.title || 'Marketplace Item'}
              </Link>
              <div className="mt-2 text-xl font-black text-blue-600">
                {formatEGP(order.amount)}
              </div>
            </div>
          </div>
        </div>

        {/* Delivery Info */}
        <div className="bg-white rounded-[2rem] border border-slate-200/80 p-6 sm:p-8 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
            <Truck className="w-5 h-5 text-blue-600" />
            {isRTL ? 'تفاصيل التسليم' : 'Delivery Information'}
          </h2>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-slate-100">
              <span className="text-slate-500 font-medium">{isRTL ? 'طريقة التسليم' : 'Handover Method'}</span>
              <span className="font-bold text-slate-900">
                {order.handover_method === 'courier' ? (isRTL ? 'شحن بوسطة' : 'Bosta Express Courier') : (isRTL ? 'تسليم يدوي' : 'In-Person Handover')}
              </span>
            </div>

            {order.handover_method === 'courier' && (
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-slate-500 font-medium">{isRTL ? 'رقم التتبع (بوسطة)' : 'Tracking Number (AWB)'}</span>
                <span className="font-mono font-bold text-slate-900">
                  {order.tracking_number || (isRTL ? 'قيد الانتظار' : 'Pending')}
                </span>
              </div>
            )}
            
            {order.shipping_address && (
              <div className="py-3">
                <span className="text-slate-500 font-medium block mb-1">{isRTL ? 'عنوان الشحن' : 'Shipping Address'}</span>
                <p className="font-medium text-slate-900 bg-slate-50 p-3 rounded-xl border border-slate-100 text-sm">
                  {order.shipping_address.street}<br/>
                  {order.shipping_address.city}, {order.shipping_address.governorate}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Escrow Status */}
        <div className="bg-emerald-900 rounded-[2rem] p-6 sm:p-8 text-white shadow-lg flex items-start gap-4">
          <ShieldCheck className="w-8 h-8 text-emerald-400 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-lg mb-1">
              {isRTL ? 'حماية الضمان المالي ١٠٠٪' : '100% Escrow Protection'}
            </h4>
            <p className="text-emerald-100 text-sm leading-relaxed opacity-90">
              {order.status === 'completed' 
                ? (isRTL ? 'اكتملت العملية وتم تحرير الأموال بنجاح.' : 'Order completed and funds released successfully.')
                : (isRTL ? 'الأموال محفوظة في حساب الضمان حتى تؤكد الاستلام.' : 'Funds are held safely in escrow until delivery is confirmed.')}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
