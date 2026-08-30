'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, ShieldCheck, Zap, X, Wallet, CreditCard,
  MapPin, CheckCircle2, AlertCircle, Loader2, Sparkles, Package
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { getUserWallet, deductWalletSpendableFunds, type UserWallet } from '@/lib/walletService';
import { sendChatMessage, type LiveSession, type LivePinnedProduct } from '@/lib/liveService';

const formatEGP = (amount: number) => `EGP ${(Number(amount) || 0).toLocaleString('en-EG')}`;

interface LiveQuickCheckoutProps {
  isOpen: boolean;
  onClose: () => void;
  session: LiveSession;
  pinnedItem: LivePinnedProduct;
  onPurchaseSuccess?: (order: any) => void;
}

export default function LiveQuickCheckout({
  isOpen,
  onClose,
  session,
  pinnedItem,
  onPurchaseSuccess,
}: LiveQuickCheckoutProps) {
  const { user } = useAuth();
  const { isRTL } = useLanguage();

  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  // Shipping Form
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [phone, setPhone] = useState(user?.user_metadata?.phone || '01000000000');
  const [city, setCity] = useState('Cairo');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'card'>('wallet');

  const price = pinnedItem.display_price || pinnedItem.product?.price || 0;
  const deliveryFee = 45; // Standard Bosta Live Delivery flat rate in EGP
  const totalAmount = price + deliveryFee;

  useEffect(() => {
    if (user && isOpen) {
      getUserWallet(user.id).then(setWallet).catch(console.error);
    }
  }, [user, isOpen]);

  const availableBalance = Number(wallet?.available_balance || 0);
  const canPayWithWallet = availableBalance >= totalAmount;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || submitting) return;

    if (!address.trim()) {
      setError(isRTL ? 'يرجى إدخال عنوان التوصيل' : 'Please enter delivery address');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (paymentMethod === 'wallet') {
        if (!canPayWithWallet) {
          throw new Error(
            isRTL
              ? `رصيد المحفظة غير كافٍ (المتاح: ${formatEGP(availableBalance)}). يرجى شحن المحفظة أو الدفع بالبطاقة.`
              : `Insufficient wallet balance (Available: ${formatEGP(availableBalance)}). Top up or pay with card.`
          );
        }

        // Deduct from spendable wallet
        await deductWalletSpendableFunds(
          user.id,
          totalAmount,
          `live_order_${Date.now()}`,
          `Live Purchase: ${pinnedItem.product?.title || 'Spotlight Item'}`
        );
      }

      // Broadcast celebratory purchase message to live stream room
      const buyerName = user.user_metadata?.full_name || 'Buyer';
      await sendChatMessage({
        sessionId: session.id,
        userId: user.id,
        username: buyerName,
        message: `🎉 اشترى للتو "${pinnedItem.product?.title}" بسعر ${formatEGP(price)}!`,
        msgType: 'purchase',
      });

      setSuccess(true);
      if (onPurchaseSuccess) {
        onPurchaseSuccess({
          productId: pinnedItem.product_id,
          amount: totalAmount,
          buyerId: user.id,
        });
      }

      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 2500);
    } catch (err: any) {
      setError(err?.message || (isRTL ? 'فشل إتمام الشراء' : 'Failed to complete order'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          className="bg-slate-900 border border-slate-800 w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-white"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-red-600/20 text-red-400 flex items-center justify-center font-bold">
                <Zap className="w-4 h-4 text-red-500 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  {isRTL ? 'شراء فوري من البث المباشر' : 'Live Stream Instant Checkout'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {isRTL ? 'حماية الضمان المالي ١٠٠٪ · شحن سريع مع بوسطة' : '100% Escrow Protection · Express Bosta Delivery'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Success Overlay */}
          {success ? (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 rounded-3xl flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-500/20">
                <Sparkles className="w-8 h-8 text-emerald-400" />
              </div>
              <h4 className="text-xl font-black text-white">
                {isRTL ? 'مبروك! تم تأكيد طلبك بنجاح 🎉' : 'Congratulations! Order Confirmed 🎉'}
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {isRTL
                  ? 'تم حجز القطعة وتحويل المبلغ للضمان المالي. سيتم شحن الطلب إليك مباشرة!'
                  : 'Item secured in escrow! The seller has been notified for immediate Bosta dispatch.'}
              </p>
            </div>
          ) : (
            <form onSubmit={handleCheckout} className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* Pinned Product Spotlight Mini Card */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3.5 flex items-center gap-3.5">
                <div className="w-16 h-16 rounded-xl bg-slate-950 overflow-hidden flex-shrink-0 border border-slate-700">
                  {pinnedItem.product?.images?.[0] ? (
                    <img src={pinnedItem.product.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="inline-block bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] font-black px-2 py-0.5 rounded-full mb-1">
                    {isRTL ? 'عرض البث المباشر ⚡' : 'LIVE DEAL ⚡'}
                  </span>
                  <p className="text-xs font-bold text-white truncate">{pinnedItem.product?.title || 'Product'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-base font-black text-emerald-400">{formatEGP(price)}</span>
                    {pinnedItem.product?.price && pinnedItem.product.price > price && (
                      <span className="text-xs text-slate-500 line-through">{formatEGP(pinnedItem.product.price)}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  {isRTL ? 'طريقة الدفع' : 'Payment Method'}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('wallet')}
                    className={`p-3 rounded-2xl border flex flex-col items-start gap-1 transition-all ${
                      paymentMethod === 'wallet'
                        ? 'border-emerald-500 bg-emerald-500/10 text-white ring-1 ring-emerald-500'
                        : 'border-slate-800 bg-slate-800/50 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold flex items-center gap-1.5 text-white">
                        <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                        {isRTL ? 'محفظة إيجي باي' : 'EgyBay Wallet'}
                      </span>
                      {paymentMethod === 'wallet' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {isRTL ? `المتاح: ${formatEGP(availableBalance)}` : `Bal: ${formatEGP(availableBalance)}`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`p-3 rounded-2xl border flex flex-col items-start gap-1 transition-all ${
                      paymentMethod === 'card'
                        ? 'border-blue-500 bg-blue-500/10 text-white ring-1 ring-blue-500'
                        : 'border-slate-800 bg-slate-800/50 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold flex items-center gap-1.5 text-white">
                        <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                        {isRTL ? 'بطاقة بنكية / ميزة' : 'Bank Card / Meeza'}
                      </span>
                      {paymentMethod === 'card' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {isRTL ? 'دفع آمن Paymob' : 'Secured via Paymob'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Delivery Details */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-300">
                  {isRTL ? 'بيانات التوصيل (شحن بوسطة)' : 'Delivery Address (Bosta Express)'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder={isRTL ? 'الاسم الكامل' : 'Full Name'}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
                  />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder={isRTL ? 'رقم الهاتف' : 'Phone Number'}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                  >
                    <option value="Cairo">القاهرة (Cairo)</option>
                    <option value="Giza">الجيزة (Giza)</option>
                    <option value="Alexandria">الإسكندرية (Alex)</option>
                    <option value="Mansoura">المنصورة (Mansoura)</option>
                    <option value="Tanta">طنطا (Tanta)</option>
                    <option value="Other">محافظة أخرى (Other)</option>
                  </select>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder={isRTL ? 'العنوان بالتفصيل (الشارع، العمارة)' : 'Street, Building, Apt'}
                    className="col-span-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-slate-800/40 rounded-2xl p-3 space-y-1.5 text-xs text-slate-400 border border-slate-800">
                <div className="flex justify-between">
                  <span>{isRTL ? 'سعر القطعة بالبث:' : 'Live Item Price:'}</span>
                  <span className="text-white font-bold">{formatEGP(price)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{isRTL ? 'شحن بوسطة السريع:' : 'Bosta Courier Shipping:'}</span>
                  <span className="text-white font-bold">{formatEGP(deliveryFee)}</span>
                </div>
                <div className="border-t border-slate-700/60 pt-2 flex justify-between text-sm font-black text-white">
                  <span>{isRTL ? 'الإجمالي المطلوب:' : 'Total Amount:'}</span>
                  <span className="text-emerald-400 font-black">{formatEGP(totalAmount)}</span>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs p-3 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3.5 rounded-2xl text-xs transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isRTL ? 'جاري التأكيد في الضمان المالي...' : 'Securing in Escrow...'}</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>{isRTL ? `تأكيد الشراء الفوري — ${formatEGP(totalAmount)}` : `Confirm Instant Order — ${formatEGP(totalAmount)}`}</span>
                  </>
                )}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
