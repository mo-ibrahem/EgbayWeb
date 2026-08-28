'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, ShieldCheck, Truck, QrCode, CreditCard,
  Smartphone, Wallet, CheckCircle2, AlertCircle, MapPin,
  Lock, ChevronRight, Package, User
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import { productService, formatEGP, type Product } from '@/lib/products';
import { getUserWallet, deductWalletSpendableFunds, type UserWallet } from '@/lib/walletService';
import { createMarketplaceOrder } from '@/lib/orderService';

const GOVERNORATES = [
  'Cairo', 'Giza', 'Alexandria', 'Dakahlia', 'Sharqia',
  'Qalyubia', 'Gharbia', 'Red Sea', 'Suez', 'Port Said',
  'Luxor', 'Aswan', 'Asyut', 'Beheira', 'Beni Suef'
];

function CheckoutContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [useWalletBalance, setUseWalletBalance] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form
  const [deliveryMethod, setDeliveryMethod] = useState<'courier' | 'qr_meetup'>('courier');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'instapay' | 'cod'>('card');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [governorate, setGovernorate] = useState('Cairo');
  const [city, setCity] = useState('New Cairo');
  const [streetAddress, setStreetAddress] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    (async () => {
      try {
        if (!id) return;
        const [prod, w] = await Promise.all([
          productService.getProductById(id),
          getUserWallet(user.id),
        ]);
        if (!prod) { router.push('/'); return; }
        setProduct(prod);
        setWallet(w);
        setFullName(user.user_metadata?.full_name || '');
      } catch (e) {
        console.error(e);
        router.push('/');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user, authLoading, router]);

  const deliveryFee = deliveryMethod === 'courier' ? 65 : 0;
  const itemPrice = Number(product?.price || 0);
  const totalPrice = itemPrice + deliveryFee;
  const walletAvailable = Number(wallet?.available_balance || 0);
  const walletDeduction = useWalletBalance ? Math.min(walletAvailable, totalPrice) : 0;
  const remainingDue = Math.max(0, totalPrice - walletDeduction);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !user) return;
    if (deliveryMethod === 'courier' && (!phoneNumber || !streetAddress || !city)) {
      setErrorMsg('Please complete your shipping address and contact number');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const order = await createMarketplaceOrder({
        product_id: product.id,
        buyer_id: user.id,
        seller_id: product.seller_id,
        amount: totalPrice,
        handover_method: deliveryMethod,
        shipping_address: {
          full_name: fullName || 'Buyer',
          phone: phoneNumber,
          governorate,
          city,
          street: streetAddress,
        },
        product_snapshot: {
          id: product.id,
          title: product.title,
          price: product.price,
          images: product.images,
          condition: product.condition,
          category: product.category,
        },
      });

      if (walletDeduction > 0) {
        await deductWalletSpendableFunds(user.id, walletDeduction, order.id, product.title);
      }

      setCreatedOrderId(order.id);
      setOrderComplete(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to place order. Please try again.');
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (orderComplete) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">Order Confirmed & Escrow Secured! 🎉</h1>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Your payment of <strong>{formatEGP(totalPrice)}</strong> is held in safe escrow. Funds will only be released to the seller once you inspect and receive the item.
        </p>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm text-left mb-6 space-y-2">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Order Reference:</span>
            <span className="font-mono font-bold text-gray-900">{createdOrderId}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Handover Mode:</span>
            <span className="font-bold text-gray-900">{deliveryMethod === 'courier' ? '🚚 Bosta Express Courier' : '🤝 In-Person QR / PIN Meetup'}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Escrow Status:</span>
            <span className="font-bold text-emerald-600">🛡️ Protected in Escrow</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/orders"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-md"
          >
            Track My Orders
          </Link>
          <Link
            href="/"
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-6 py-3 rounded-xl text-sm transition-all"
          >
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-black text-gray-900">Secure Escrow Checkout</h1>
      </div>

      {errorMsg && (
        <div className="mb-6 bg-red-50 text-red-700 text-sm p-4 rounded-2xl border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {errorMsg}
        </div>
      )}

      <form onSubmit={handlePlaceOrder}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Cols: Form Options */}
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery Method */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-600" /> 1. Delivery & Handover Method
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDeliveryMethod('courier')}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    deliveryMethod === 'courier'
                      ? 'border-blue-600 bg-blue-50/50'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-900 text-sm">🚚 Courier Delivery (Bosta)</span>
                    <span className="text-xs font-bold text-blue-600">+EGP 65</span>
                  </div>
                  <p className="text-xs text-gray-500">Doorstep delivery across all Egypt governorates with live tracking.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryMethod('qr_meetup')}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    deliveryMethod === 'qr_meetup'
                      ? 'border-blue-600 bg-blue-50/50'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-900 text-sm">🤝 In-Person Meetup</span>
                    <span className="text-xs font-bold text-emerald-600">FREE</span>
                  </div>
                  <p className="text-xs text-gray-500">Meet in public, inspect item, release escrow with 6-digit PIN.</p>
                </button>
              </div>
            </div>

            {/* Shipping Address (Courier only) */}
            {deliveryMethod === 'courier' && (
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" /> 2. Shipping Address in Egypt
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="Receiver's name"
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number (+20)</label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      placeholder="010XXXXXXXX"
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Governorate</label>
                    <select
                      value={governorate}
                      onChange={e => setGovernorate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 bg-white"
                    >
                      {GOVERNORATES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">City / District</label>
                    <input
                      type="text"
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      placeholder="e.g. Nasr City, Maadi, Dokki"
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Street Address, Building & Apt</label>
                  <input
                    type="text"
                    value={streetAddress}
                    onChange={e => setStreetAddress(e.target.value)}
                    placeholder="e.g. Street 9, Bldg 14, Apt 3"
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>
            )}

            {/* Payment Method */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" /> 3. Payment Option
              </h2>

              {/* Wallet Balance Deduction Option */}
              {walletAvailable > 0 && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="wallet-deduct"
                      checked={useWalletBalance}
                      onChange={e => setUseWalletBalance(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <label htmlFor="wallet-deduct" className="text-xs font-bold text-blue-900 cursor-pointer">
                      Use Spendable Wallet Balance
                      <span className="block text-[11px] font-normal text-blue-700">
                        Available: EGP {walletAvailable.toLocaleString('en-EG')} (Deducts up to {formatEGP(Math.min(walletAvailable, totalPrice))})
                      </span>
                    </label>
                  </div>
                  <span className="text-xs font-black text-blue-600">
                    -{formatEGP(walletDeduction)}
                  </span>
                </div>
              )}

              {remainingDue > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'card', label: 'Debit / Credit Card', icon: '💳', sub: 'Visa & MasterCard' },
                    { id: 'instapay', label: 'InstaPay Transfer', icon: '⚡', sub: 'Instant Central Bank' },
                    { id: 'cod', label: 'Cash On Delivery', icon: '💵', sub: 'Pay upon receipt' },
                  ].map(pm => (
                    <button
                      type="button"
                      key={pm.id}
                      onClick={() => setPaymentMethod(pm.id as any)}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                        paymentMethod === pm.id
                          ? 'border-blue-600 bg-blue-50/50'
                          : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div className="text-lg mb-1">{pm.icon}</div>
                      <p className="font-bold text-gray-900 text-xs">{pm.label}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{pm.sub}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Col: Order Summary & Place Order */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm sticky top-28">
              <h3 className="font-black text-gray-900 text-base mb-4">Order Summary</h3>

              {/* Product mini card */}
              {product && (
                <div className="flex gap-3 pb-4 border-b border-gray-100 mb-4">
                  <div className="w-16 h-16 rounded-xl bg-gray-50 relative overflow-hidden flex-shrink-0">
                    {product.images?.[0] ? (
                      <Image src={product.images[0]} alt={product.title} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">📦</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 text-xs line-clamp-2">{product.title}</p>
                    <p className="text-blue-600 font-black text-sm mt-1">{formatEGP(product.price)}</p>
                  </div>
                </div>
              )}

              {/* Breakdown */}
              <div className="space-y-2 text-xs text-gray-600 pb-4 border-b border-gray-100">
                <div className="flex justify-between">
                  <span>Item Subtotal</span>
                  <span className="font-bold text-gray-900">{formatEGP(itemPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery ({deliveryMethod === 'courier' ? 'Bosta' : 'Meetup'})</span>
                  <span className="font-bold text-gray-900">{deliveryFee === 0 ? 'FREE' : formatEGP(deliveryFee)}</span>
                </div>
                {walletDeduction > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Wallet Applied</span>
                    <span className="font-bold">-{formatEGP(walletDeduction)}</span>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="flex justify-between items-center py-4">
                <span className="text-sm font-black text-gray-900">Total Due</span>
                <span className="text-xl font-black text-blue-600">{formatEGP(remainingDue)}</span>
              </div>

              {/* Escrow Guarantee */}
              <div className="bg-emerald-50 rounded-xl p-3 text-[11px] text-emerald-800 flex items-start gap-2 mb-4">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Protected by EgyBay Escrow. Funds held safe until you verify delivery.</span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                {submitting ? 'Securing Escrow...' : `Pay ${formatEGP(remainingDue)} with Escrow`}
              </button>
            </div>
          </div>
        </div>
      </form>
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
