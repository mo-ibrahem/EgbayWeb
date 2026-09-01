'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Wallet, ShieldCheck, ArrowUpRight, ArrowDownLeft, Clock,
  Plus, CreditCard, Smartphone, Building, CheckCircle2,
  AlertCircle, ChevronRight, Lock, Sparkles, RefreshCw, X, Loader2,
  PartyPopper, ShoppingBag, Video
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import AnimatedNumber from '@/components/AnimatedNumber';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getUserWallet,
  getWalletTransactions,
  getPayoutMethods,
  getSellerTier,
  requestPayout,
  SELLER_TIERS,
  type UserWallet,
  type WalletTransaction,
  type PayoutMethod,
  type SellerTierConfig,
} from '@/lib/walletService';
import { supabase } from '@/lib/supabase';

function WalletContent() {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const router = useRouter();

  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [payoutMethods, setPayoutMethods] = useState<PayoutMethod[]>([]);
  const [sellerTier, setSellerTier] = useState<SellerTierConfig>(SELLER_TIERS[2]);
  const [loading, setLoading] = useState(true);
  const [txFilter, setTxFilter] = useState<'all' | 'escrow' | 'payout' | 'top_up'>('all');

  // Modals
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpMethod, setTopUpMethod] = useState<'card' | 'vodafone_cash' | 'instapay'>('card');
  const [toppingUp, setToppingUp] = useState(false);
  const [topUpSuccess, setTopUpSuccess] = useState(false);
  // Paymob iFrame Modal for Top-up
  const [paymobIframeUrl, setPaymobIframeUrl] = useState('');
  const [showPaymobModal, setShowPaymobModal] = useState(false);

  // Celebratory Top-Up Success Popup Modal
  const [celebrateModal, setCelebrateModal] = useState<{
    open: boolean;
    amount: number;
    newBalance: number;
  }>({
    open: false,
    amount: 0,
    newBalance: 0,
  });

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedPayoutMethod, setSelectedPayoutMethod] = useState<string>('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [w, txs, pms, tier] = await Promise.all([
        getUserWallet(user.id),
        getWalletTransactions(user.id),
        getPayoutMethods(user.id),
        getSellerTier(user.id),
      ]);
      setWallet(w);
      setTransactions(txs);
      setPayoutMethods(pms);
      setSelectedPayoutMethod(prev => {
        if (!prev && pms.length > 0) return pms[0].id;
        return prev;
      });
      setSellerTier(tier);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    // Check if we are waiting for a top-up to complete
    if (typeof window !== 'undefined') {
      const pendingTopupId = sessionStorage.getItem('pending_topup_id');
      if (pendingTopupId && user) {
        let isPolling = true;

        const checkStatus = async () => {
          if (!isPolling) return;
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`/api/wallet/topup/status?id=${pendingTopupId}`, {
              headers: {
                'Authorization': `Bearer ${session?.access_token || ''}`
              }
            });
            const data = await res.json();
            
            if (data.success && data.status === 'paid') {
              sessionStorage.removeItem('pending_topup_id');
              isPolling = false;
              
              setCelebrateModal({
                open: true,
                amount: data.amount,
                newBalance: (wallet?.available_balance || 0) + data.amount,
              });
              
              await loadData();
              window.history.replaceState({}, '', '/wallet');
            }
          } catch (e) {
            console.error('[Wallet] Error checking top-up status:', e);
          }
        };

        // Poll every 3 seconds
        checkStatus();
        const interval = setInterval(checkStatus, 3000);
        return () => {
          isPolling = false;
          clearInterval(interval);
        };
      } else {
        // Just clear the URL params if we were redirected back with success
        const params = new URLSearchParams(window.location.search);
        if (params.has('success') || params.has('merchant_order_id')) {
          window.history.replaceState({}, '', '/wallet');
        }
      }
    }
  }, [user, loadData, wallet]);

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !topUpAmount || Number(topUpAmount) <= 0) return;
    const amount = Number(topUpAmount);

    if (topUpMethod === 'card') {
      setToppingUp(true);
      setErrorMsg('');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/wallet/topup/create', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`
          },
          body: JSON.stringify({ amount })
        });
        const data = await res.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to initialize top-up');
        }
        
        sessionStorage.setItem('pending_topup_id', data.topupId);
        
        setTopUpOpen(false);
        setPaymobIframeUrl(data.iframeUrl);
        setShowPaymobModal(true);
      } catch (err: any) {
        setErrorMsg(err?.message || (isRTL ? 'فشل بدء جلسة الدفع' : 'Failed to start payment session'));
      } finally {
        setToppingUp(false);
      }
    } else {
      // Manual Deposit Guide
      alert(
        topUpMethod === 'vodafone_cash'
          ? (isRTL ? 'تحويل فودافون كاش:\nحول المبلغ إلى الرقم 01098765432 ثم أرسل الإيصال إلى support@egbay.market' : 'Vodafone Cash:\nTransfer to 01098765432 and send receipt to support@egbay.market')
          : (isRTL ? 'تحويل انستاباي:\nحول المبلغ إلى egbay@instapay ثم أرسل الإيصال إلى support@egbay.market' : 'InstaPay IPA:\nTransfer to egbay@instapay and send receipt to support@egbay.market')
      );
      setTopUpOpen(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !withdrawAmount || Number(withdrawAmount) <= 0) return;
    if (!selectedPayoutMethod) {
      setErrorMsg(isRTL ? 'يرجى اختيار طريقة استلام الأرباح' : 'Please select a payout destination');
      return;
    }
    setWithdrawing(true);
    setErrorMsg('');
    try {
      await requestPayout(user.id, Number(withdrawAmount), selectedPayoutMethod);
      setWithdrawSuccess(true);
      setTimeout(async () => {
        setWithdrawOpen(false);
        setWithdrawSuccess(false);
        setWithdrawAmount('');
        await loadData();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err?.message || (isRTL ? 'تعذر إتمام طلب السحب' : 'Failed to submit withdrawal request'));
    } finally {
      setWithdrawing(false);
    }
  };

  const available = wallet?.available_balance || 0;
  const pending = wallet?.pending_balance || 0;

  const filteredTransactions = transactions.filter(t => {
    if (txFilter === 'all') return true;
    if (txFilter === 'escrow') return t.type === 'escrow_hold' || t.type === 'earning';
    if (txFilter === 'top_up') return t.type === 'top_up';
    if (txFilter === 'payout') return t.type === 'withdrawal';
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-blue-600" />
            {isRTL ? 'محفظة إيجي باي والأرباح' : 'EgyBay Wallet & Payouts'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isRTL ? 'إدارة الرصيد المتاح، الأرباح المحجوزة في الضمان وسحب الأرباح الفوري' : 'Manage spendable balance, pending escrow funds & instant payouts'}
          </p>
        </div>

        <Link
          href="/seller-verification"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-blue-800 px-4 py-2 rounded-xl text-xs font-bold hover:shadow-sm transition-all"
        >
          <span>{sellerTier.badge}</span>
          <span className="text-blue-600">{isRTL ? 'ترقية الباقة ›' : 'Upgrade Tier ›'}</span>
        </Link>
      </div>

      {/* Main Balances Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        {/* Available Spendable Balance */}
        <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                <CreditCard className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">
                {isRTL ? 'الرصيد المتاح' : 'Available Balance'}
              </span>
            </div>
            <span className="text-xs bg-emerald-500/20 text-emerald-300 font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {isRTL ? 'جاهز للاستخدام' : 'Ready to Spend'}
            </span>
          </div>

          <div className="mb-6">
            <div className="text-3xl sm:text-4xl font-black tracking-tight">
              <AnimatedNumber value={available} prefix={isRTL ? 'ج.م ' : 'EGP '} />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isRTL ? 'متاح للشراء المباشر في السوق وسحب الأرباح الفوري' : 'Available for direct marketplace checkout & instant payout'}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setTopUpOpen(true); setErrorMsg(''); }}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> {isRTL ? 'شحن الرصيد' : 'Top-Up'}
            </button>
            <button
              onClick={() => { setWithdrawOpen(true); setErrorMsg(''); }}
              disabled={available <= 0}
              className="flex-1 bg-white/15 hover:bg-white/25 disabled:opacity-40 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all border border-white/20 flex items-center justify-center gap-2"
            >
              <ArrowUpRight className="w-4 h-4" /> {isRTL ? 'سحب الأرباح' : 'Withdraw'}
            </button>
          </div>
        </div>

        {/* Pending Escrow Balance */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-sm">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                {isRTL ? 'الأرباح المحجوزة في الضمان' : 'Pending in Escrow'}
              </span>
            </div>
            <span className="text-xs bg-amber-50 text-amber-700 font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
              <Clock className="w-3 h-3" /> {isRTL ? 'مؤمّنة بالضمان' : 'Protected'}
            </span>
          </div>

          <div className="mb-6">
            <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              <AnimatedNumber value={pending} prefix={isRTL ? 'ج.م ' : 'EGP '} />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isRTL ? 'محفوظة بأمان في حساب الضمان حتى يستلم المشتري ويفحص طلبه' : 'Held securely in escrow until buyers verify and receive their orders'}
            </p>
          </div>

          <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-3.5 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-900 leading-relaxed">
              <strong>{isRTL ? 'حماية الضمان المالي:' : 'Escrow Protection:'}</strong>{' '}
              {isRTL
                ? 'تتحول الأموال فوراً إلى رصيدك المتاح بمجرد مسح كود QR أو تأكيد مندوب الشحن لتسليم السلعة.'
                : 'Funds auto-clear into your available balance immediately once the buyer scans your pickup QR or delivery courier finishes drop-off.'}
            </p>
          </div>
        </div>
      </div>

      {/* Seller Tier Details Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 rounded-3xl p-5 text-white mb-8 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span className="text-xs font-bold uppercase tracking-wider text-white/80">
                {isRTL ? 'باقة البائع الحالية' : 'Active Seller Plan'}
              </span>
            </div>
            <h3 className="text-lg font-black">{sellerTier.name} ({sellerTier.badge})</h3>
            <p className="text-xs text-white/80 mt-0.5">
              {isRTL ? 'نسبة العمولة:' : 'Commission Fee:'} <strong>{(sellerTier.commissionFeePercent * 100).toFixed(1)}%</strong> · {isRTL ? 'سرعة السحب:' : 'Payout Speed:'} <strong>{sellerTier.payoutSpeed}</strong>
            </p>
          </div>

          <Link
            href="/seller-verification"
            className="bg-white text-blue-900 font-bold px-4 py-2 rounded-xl text-xs hover:bg-blue-50 transition-colors self-start sm:self-auto"
          >
            {isRTL ? 'الترقية للباقة الاحترافية' : 'Upgrade to Pro'}
          </Link>
        </div>
      </div>

      {/* Payout Methods & Transaction History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Saved Payout Methods */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              {isRTL ? 'وجهات استلام الأرباح' : 'Payout Channels'}
            </h3>
            <Link href="/seller-verification" className="text-xs text-blue-600 hover:underline font-semibold">
              {isRTL ? '+ إضافة' : '+ Add'}
            </Link>
          </div>

          <div className="space-y-2.5">
            {payoutMethods.map(pm => (
              <div
                key={pm.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                  {pm.type === 'instapay_ipa' ? <Smartphone className="w-5 h-5" /> : pm.type === 'vodafone_cash' ? <CreditCard className="w-5 h-5" /> : <Building className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {pm.type === 'instapay_ipa' ? 'InstaPay IPA' : pm.type === 'vodafone_cash' ? 'Vodafone Cash' : (isRTL ? 'حساب بنكي' : 'Bank Account')}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">{pm.account_identifier}</p>
                </div>
                {pm.is_default && (
                  <span className="text-[10px] bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-full">
                    {isRTL ? 'الافتراضية' : 'Default'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Transaction Log */}
        <div className="lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              {isRTL ? 'سجل المعاملات والتحويلات' : 'Transaction Activity'}
            </h3>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: isRTL ? 'الكل' : 'All' },
                { id: 'escrow', label: isRTL ? 'الضمان' : 'Escrow' },
                { id: 'top_up', label: isRTL ? 'شحن رصيد' : 'Deposits' },
                { id: 'payout', label: isRTL ? 'سحب أرباح' : 'Withdrawals' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setTxFilter(f.id as any)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                    txFilter === f.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-slate-400">
              <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs">{isRTL ? 'لا توجد معاملات مسجلة في هذا القسم.' : 'No transactions found in this category.'}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 shadow-sm overflow-hidden">
              {filteredTransactions.map(tx => {
                let isPositive = ['top_up', 'earning'].includes(tx.type);
                if (tx.delta_available !== undefined && tx.delta_available !== null && tx.delta_available !== 0) {
                  isPositive = tx.delta_available > 0;
                } else if (tx.delta_pending !== undefined && tx.delta_pending !== null && tx.delta_pending !== 0) {
                  isPositive = tx.delta_pending > 0;
                }
                
                const isPending = tx.type === 'escrow_hold';
                
                return (
                  <div key={tx.id} className="p-4 flex items-center gap-3.5 hover:bg-slate-50/50 transition-colors">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isPending ? 'bg-amber-50 text-amber-600' :
                      isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {isPending ? <ShieldCheck className="w-4 h-4" /> : isPositive ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {tx.description || tx.type.replace('_', ' ').toUpperCase()}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(tx.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-EG', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>

                    <div className="text-right rtl:text-left">
                      <p className={`text-xs sm:text-sm font-black ${
                        isPending ? 'text-amber-600' :
                        isPositive ? 'text-emerald-600' : 'text-slate-900'
                      }`}>
                        {isPositive ? '+' : '-'}{isRTL ? 'ج.م ' : 'EGP '}{Math.abs(tx.amount).toLocaleString(isRTL ? 'ar-EG' : 'en-EG')}
                      </p>
                      <span className="text-[10px] text-slate-400 capitalize">{tx.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top-Up Modal */}
      <AnimatePresence>
        {topUpOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setTopUpOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-black text-slate-900">
                  {isRTL ? 'شحن رصيد المحفظة' : 'Top-Up Spendable Balance'}
                </h3>
                <button onClick={() => setTopUpOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {errorMsg && <div className="mb-4 bg-rose-50 text-rose-700 text-xs p-3 rounded-xl border border-rose-200">{errorMsg}</div>}

              {topUpSuccess ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                  <h4 className="text-base font-black text-slate-900">
                    {isRTL ? 'تم شحن الرصيد بنجاح! 🎉' : 'Funds Added! 🎉'}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {isRTL ? 'تم تحديث رصيدك المتاح في المحفظة.' : 'Your available balance has been updated.'}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleTopUp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {isRTL ? 'مبلغ الإيداع (بالجنيه المصري)' : 'Deposit Amount (EGP)'}
                    </label>
                    <input
                      type="number"
                      value={topUpAmount}
                      onChange={e => setTopUpAmount(e.target.value)}
                      placeholder="500"
                      min="10"
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold outline-none focus:border-blue-500 text-center"
                      autoFocus
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {isRTL ? 'طريقة الدفع' : 'Payment Method'}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'card', label: isRTL ? 'بطاقة بنكية' : 'Debit/Credit Card', icon: CreditCard },
                        { id: 'instapay', label: 'InstaPay IPA', icon: Smartphone },
                        { id: 'vodafone_cash', label: 'Vodafone Cash', icon: Smartphone },
                      ].map(m => {
                        const Icon = m.icon;
                        return (
                          <button
                            type="button"
                            key={m.id}
                            onClick={() => setTopUpMethod(m.id as any)}
                            className={`p-3 rounded-2xl border-2 text-center text-xs font-bold transition-all ${
                              topUpMethod === m.id
                                ? 'border-blue-600 bg-blue-50 text-blue-700'
                                : 'border-slate-100 hover:border-slate-200 text-slate-600'
                            }`}
                          >
                            <Icon className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={toppingUp || !topUpAmount}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors text-xs shadow-md"
                  >
                    {toppingUp ? (isRTL ? 'جاري معالجة الإيداع...' : 'Processing Deposit...') : (isRTL ? `إيداع ${Number(topUpAmount || 0).toLocaleString('ar-EG')} ج.م الآن` : `Add EGP ${Number(topUpAmount || 0).toLocaleString('en-EG')} Now`)}
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Withdraw Modal */}
      <AnimatePresence>
        {withdrawOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setWithdrawOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-black text-slate-900">
                  {isRTL ? 'سحب الأرباح' : 'Withdraw Earnings'}
                </h3>
                <button onClick={() => setWithdrawOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {errorMsg && <div className="mb-4 bg-rose-50 text-rose-700 text-xs p-3 rounded-xl border border-rose-200">{errorMsg}</div>}

              {withdrawSuccess ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                  <h4 className="text-base font-black text-slate-900">
                    {isRTL ? 'تم إرسال طلب السحب! 🚀' : 'Payout Submitted! 🚀'}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {isRTL ? 'جاري تحويل المبلغ إلى الوجهة المختارة.' : 'Funds are being transferred to your selected account.'}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleWithdraw} className="space-y-4">
                  <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-600">
                    {isRTL ? 'الرصيد المتاح للسحب:' : 'Available for withdrawal:'}{' '}
                    <strong className="text-slate-900">{isRTL ? `${available.toLocaleString('ar-EG')} ج.م` : `EGP ${available.toLocaleString('en-EG')}`}</strong>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {isRTL ? 'مبلغ السحب (بالجنيه المصري)' : 'Withdrawal Amount (EGP)'}
                    </label>
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={e => setWithdrawAmount(e.target.value)}
                      placeholder="1000"
                      max={available}
                      min="50"
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold outline-none focus:border-blue-500 text-center"
                      autoFocus
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {isRTL ? 'جهة استلام الأرباح' : 'Payout Channel'}
                    </label>
                    <select
                      value={selectedPayoutMethod}
                      onChange={e => setSelectedPayoutMethod(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-blue-500 bg-white"
                    >
                      {payoutMethods.map(pm => (
                        <option key={pm.id} value={pm.id}>
                          {pm.type === 'instapay_ipa' ? 'InstaPay' : pm.type === 'vodafone_cash' ? 'Vodafone Cash' : (isRTL ? 'حساب بنكي' : 'Bank')} — {pm.account_identifier}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={withdrawing || !withdrawAmount || Number(withdrawAmount) > available}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors text-xs shadow-md"
                  >
                    {withdrawing ? (isRTL ? 'جاري إرسال الطلب...' : 'Submitting Request...') : (isRTL ? `سحب ${Number(withdrawAmount || 0).toLocaleString('ar-EG')} ج.م` : `Withdraw EGP ${Number(withdrawAmount || 0).toLocaleString('en-EG')}`)}
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ── Paymob Card Deposit Modal ──────────────────────────── */}
      {showPaymobModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl flex flex-col overflow-hidden shadow-2xl"
               style={{ height: '85vh', maxHeight: 720 }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0 bg-white">
              <div>
                <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  {isRTL ? 'إيداع رصيد آمن عبر Paymob' : 'Secure Wallet Deposit'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isRTL ? `إيداع ${Number(topUpAmount || 0).toLocaleString('ar-EG')} ج.م` : `Deposit EGP ${Number(topUpAmount || 0).toLocaleString('en-EG')}`}
                </p>
              </div>
              <button
                onClick={() => { setShowPaymobModal(false); setPaymobIframeUrl(''); loadData(); }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors text-lg font-light"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            
            <iframe
              src={paymobIframeUrl}
              className="flex-1 w-full border-0"
              title="Paymob Wallet Deposit"
            />

            {/* Bottom Bar — Quick return once approved */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="text-[11px]">
                  {isRTL ? 'بعد ظهور علامة Approved، اضغط لتحديث الرصيد' : 'After "Approved", click to refresh your balance'}
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setShowPaymobModal(false);
                  setPaymobIframeUrl('');
                  await loadData();
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 flex-shrink-0"
              >
                <span>{isRTL ? 'تحديث الرصيد الآن 🔄' : 'Refresh Wallet 🔄'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Celebratory Top-Up Success Popup Modal ─────────────────── */}
      <AnimatePresence>
        {celebrateModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md"
            onClick={() => setCelebrateModal(prev => ({ ...prev, open: false }))}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 25 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white border border-slate-100 rounded-3xl p-7 sm:p-9 max-w-md w-full text-center shadow-2xl relative overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Glow Accents */}
              <div className="absolute -top-16 -left-16 w-36 h-36 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -top-16 -right-16 w-36 h-36 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />

              {/* Party Popper Icon */}
              <div className="relative mb-5 flex items-center justify-center">
                <div className="w-20 h-20 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 transform -rotate-3 hover:rotate-0 transition-transform">
                  <PartyPopper className="w-10 h-10" />
                </div>
                <div className="absolute -top-1 -right-1 bg-amber-400 text-amber-950 p-1.5 rounded-full shadow-md">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>

              {/* Title & Description */}
              <h2 className="text-2xl font-black text-slate-900 mb-1.5 tracking-tight">
                {isRTL ? 'تهانينا! تم شحن محفظتك 🎉' : 'Top-Up Successful! 🎉'}
              </h2>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                {isRTL
                  ? 'تمت إضافة الرصيد بنجاح إلى حسابك في إيجي باي وهو جاهز للاستخدام فوراً!'
                  : 'Your funds have been deposited safely and are ready to spend across the marketplace!'}
              </p>

              {/* Amount Badge Card */}
              <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 rounded-2xl p-4 mb-6 shadow-sm">
                <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
                  {isRTL ? 'المبلغ المودع' : 'Amount Credited'}
                </p>
                <div className="text-3xl font-black text-emerald-600 tracking-tight">
                  +{celebrateModal.amount.toLocaleString(isRTL ? 'ar-EG' : 'en-EG')}{' '}
                  <span className="text-base font-bold text-emerald-700">EGP</span>
                </div>
                <div className="mt-3 pt-3 border-t border-emerald-200/60 flex items-center justify-between text-xs text-slate-600">
                  <span>{isRTL ? 'إجمالي الرصيد المتاح الآن:' : 'Total Available Balance:'}</span>
                  <span className="font-extrabold text-slate-900">
                    {(wallet?.available_balance || celebrateModal.newBalance || 0).toLocaleString(isRTL ? 'ar-EG' : 'en-EG')} EGP
                  </span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-2.5">
                <Link
                  href="/"
                  onClick={() => setCelebrateModal(prev => ({ ...prev, open: false }))}
                  className="w-full bg-[#3665F3] hover:bg-[#2B54D4] text-white font-bold py-3.5 rounded-xl transition-all shadow-md shadow-blue-500/20 text-xs flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>{isRTL ? 'ابدأ التسوق في السوق 🛍️' : 'Start Shopping Deals 🛍️'}</span>
                </Link>

                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/live/book"
                    onClick={() => setCelebrateModal(prev => ({ ...prev, open: false }))}
                    className="w-full bg-red-50 hover:bg-red-100 text-red-700 font-bold py-2.5 rounded-xl transition-colors text-xs flex items-center justify-center gap-1.5 border border-red-200"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'حجز بث مباشر 🎥' : 'Go Live 🎥'}</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setCelebrateModal(prev => ({ ...prev, open: false }))}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-colors text-xs"
                  >
                    {isRTL ? 'عرض المحفظة' : 'View Wallet'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function WalletPage() {
  return (
    <ProtectedRoute>
      <WalletContent />
    </ProtectedRoute>
  );
}
