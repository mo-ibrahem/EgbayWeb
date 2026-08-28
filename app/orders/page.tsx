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
import ProtectedRoute from '@/components/ProtectedRoute';
import { getUserOrders, verifyAndReleaseOrder, type MarketplaceOrder } from '@/lib/orderService';
import { formatEGP } from '@/lib/products';

function OrdersContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
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
      setVerifyError(err?.message || 'Invalid confirmation PIN');
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
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-600" /> My Orders & Escrow Track
          </h1>
          <p className="text-sm text-gray-500">Track purchase delivery and verify in-person releases</p>
        </div>
        <button
          onClick={loadOrders}
          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-xl transition-colors"
          title="Refresh orders"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 mb-1">No orders placed yet</h3>
          <p className="text-xs text-gray-400 mb-5">Browse the marketplace and buy items with full escrow protection.</p>
          <Link
            href="/"
            className="bg-blue-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors inline-block"
          >
            Explore Marketplace
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const isBuyer = order.buyer_id === user?.id;
            const isCompleted = order.status === 'completed';

            return (
              <div
                key={order.id}
                className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-gray-400">Order #{order.id.slice(-8).toUpperCase()}</span>
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      isCompleted
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {isCompleted ? '✓ Completed & Released' : '🛡️ Escrow Secured'}
                    </span>
                  </div>

                  <span className="text-xs text-gray-400">
                    {new Date(order.created_at).toLocaleDateString('en-EG', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="flex gap-3 min-w-0">
                    <div className="w-16 h-16 rounded-xl bg-gray-50 relative overflow-hidden flex-shrink-0">
                      {order.product?.images?.[0] ? (
                        <Image src={order.product.images[0]} alt={order.product.title || ''} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">{order.product?.title || 'Marketplace Item'}</p>
                      <p className="text-blue-600 font-black text-sm mt-0.5">{formatEGP(order.amount)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {order.handover_method === 'courier' ? '🚚 Bosta Express' : '🤝 Meetup Handover'} · {isBuyer ? 'You are Buyer' : 'You are Seller'}
                      </p>
                    </div>
                  </div>

                  {/* Actions / PIN Display */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {isBuyer && !isCompleted && order.meetup_pin && (
                      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-2 text-center">
                        <span className="block text-[10px] uppercase tracking-wider font-bold text-blue-700">Release PIN</span>
                        <span className="text-base font-mono font-black text-blue-900 tracking-widest">{order.meetup_pin}</span>
                      </div>
                    )}

                    {!isBuyer && !isCompleted && (
                      <button
                        onClick={() => { setPinModalOrder(order); setEnteredPin(''); setVerifyError(''); setVerifyMsg(''); }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
                      >
                        <KeyRound className="w-4 h-4" /> Enter Buyer PIN
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
            <h3 className="text-lg font-black text-gray-900 mb-1">Verify Handover & Release Funds</h3>
            <p className="text-xs text-gray-500 mb-4">Ask the buyer for the 6-digit confirmation PIN shown in their order screen.</p>

            {verifyError && <div className="mb-4 bg-red-50 text-red-700 text-xs p-3 rounded-xl border border-red-200">{verifyError}</div>}
            {verifyMsg && <div className="mb-4 bg-emerald-50 text-emerald-700 text-xs p-3 rounded-xl border border-emerald-200">{verifyMsg}</div>}

            <form onSubmit={handleVerifyRelease} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">6-Digit Release PIN</label>
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
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifying || enteredPin.length !== 6}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs shadow-md transition-colors"
                >
                  {verifying ? 'Verifying...' : 'Release Escrow'}
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
