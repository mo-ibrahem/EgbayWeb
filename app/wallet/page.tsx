'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Wallet, ShieldCheck, ArrowUpRight, ArrowDownLeft, Clock,
  Plus, CreditCard, Smartphone, Building, CheckCircle2,
  AlertCircle, ChevronRight, Lock, Sparkles, RefreshCw, X, Loader2
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import AnimatedNumber from '@/components/AnimatedNumber';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getUserWallet,
  getWalletTransactions,
  getPayoutMethods,
  getSellerTier,
  topUpUserWallet,
  requestPayout,
  SELLER_TIERS,
  type UserWallet,
  type WalletTransaction,
  type PayoutMethod,
  type SellerTierConfig,
} from '@/lib/walletService';

function WalletContent() {
  const { user } = useAuth();

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
      setSellerTier(tier);
      if (pms.length > 0) {
        setSelectedPayoutMethod(pms.find(p => p.is_default)?.id || pms[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !topUpAmount || Number(topUpAmount) <= 0) return;
    setToppingUp(true);
    setErrorMsg('');
    try {
      await topUpUserWallet(user.id, Number(topUpAmount), topUpMethod);
      setTopUpSuccess(true);
      setTimeout(async () => {
        setTopUpOpen(false);
        setTopUpSuccess(false);
        setTopUpAmount('');
        await loadData();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to process deposit');
    } finally {
      setToppingUp(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !withdrawAmount || Number(withdrawAmount) <= 0) return;
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
      setErrorMsg(err?.message || 'Failed to request payout');
    } finally {
      setWithdrawing(false);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    if (txFilter === 'all') return true;
    if (txFilter === 'escrow') return tx.type === 'escrow_hold' || tx.type === 'escrow_release';
    if (txFilter === 'payout') return tx.type === 'payout';
    if (txFilter === 'top_up') return tx.type === 'top_up' || tx.type === 'deposit';
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs font-semibold text-slate-400">Loading wallet balances...</p>
      </div>
    );
  }

  const available = Number(wallet?.available_balance || 0);
  const pending = Number(wallet?.pending_balance || 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Title & Tier Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-blue-600" /> My EgyBay Wallet
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage spendable balance, pending escrow funds & instant payouts</p>
        </div>

        <Link
          href="/seller-verification"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-blue-800 px-4 py-2 rounded-xl text-xs font-bold hover:shadow-sm transition-all"
        >
          <span>{sellerTier.badge}</span>
          <span className="text-blue-600">Upgrade Tier ›</span>
        </Link>
      </div>

      {/* Main Balances Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        {/* Available Spendable Balance */}
        <div className="bg-gradient-to-br from-[#0B132B] via-[#1C2541] to-[#3A506B] rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-slate-700">
          <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                <CreditCard className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">Available Balance</span>
            </div>
            <span className="text-xs bg-emerald-500/20 text-emerald-300 font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Ready to Spend
            </span>
          </div>

          <div className="mb-6">
            <div className="text-3xl sm:text-4xl font-black tracking-tight">
              <AnimatedNumber value={available} prefix="EGP " />
            </div>
            <p className="text-xs text-slate-400 mt-1">Available for direct marketplace checkout & instant payout</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setTopUpOpen(true); setErrorMsg(''); }}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Top-Up
            </button>
            <button
              onClick={() => { setWithdrawOpen(true); setErrorMsg(''); }}
              disabled={available <= 0}
              className="flex-1 bg-white/15 hover:bg-white/25 disabled:opacity-40 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all border border-white/20 flex items-center justify-center gap-2"
            >
              <ArrowUpRight className="w-4 h-4" /> Withdraw
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
              <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">Pending in Escrow</span>
            </div>
            <span className="text-xs bg-amber-50 text-amber-700 font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
              <Clock className="w-3 h-3" /> Protected
            </span>
          </div>

          <div className="mb-6">
            <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              <AnimatedNumber value={pending} prefix="EGP " />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Held securely in escrow until buyers verify and receive their orders
            </p>
          </div>

          <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-3.5 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-900 leading-relaxed">
              <strong>Escrow Protection:</strong> Funds auto-clear into your available balance immediately once the buyer scans your pickup QR or delivery courier finishes drop-off.
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
              <span className="text-xs font-bold uppercase tracking-wider text-white/80">Active Seller Plan</span>
            </div>
            <h3 className="text-lg font-black">{sellerTier.name} ({sellerTier.badge})</h3>
            <p className="text-xs text-white/80 mt-0.5">
              Commission Fee: <strong>{(sellerTier.commissionFeePercent * 100).toFixed(1)}%</strong> · Payout Speed: <strong>{sellerTier.payoutSpeed}</strong>
            </p>
          </div>

          <Link
            href="/seller-verification"
            className="bg-white text-blue-900 font-bold px-4 py-2 rounded-xl text-xs hover:bg-blue-50 transition-colors self-start sm:self-auto"
          >
            Upgrade to Pro
          </Link>
        </div>
      </div>

      {/* Payout Methods & Transaction History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Saved Payout Methods */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Payout Channels</h3>
            <Link href="/seller-verification" className="text-xs text-blue-600 hover:underline font-semibold">
              + Add
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
                    {pm.type === 'instapay_ipa' ? 'InstaPay IPA' : pm.type === 'vodafone_cash' ? 'Vodafone Cash' : 'Bank Account'}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">{pm.account_identifier}</p>
                </div>
                {pm.is_default && (
                  <span className="text-[10px] bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-full">
                    Default
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Transaction Log */}
        <div className="lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Transaction Activity</h3>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: 'All' },
                { id: 'escrow', label: 'Escrow' },
                { id: 'top_up', label: 'Deposits' },
                { id: 'payout', label: 'Withdrawals' },
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
              <p className="text-xs">No transactions found in this category.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 shadow-sm overflow-hidden">
              {filteredTransactions.map(tx => {
                const isPositive = tx.amount > 0 && tx.type !== 'fee_deduction';
                return (
                  <div key={tx.id} className="p-4 flex items-center gap-3.5 hover:bg-slate-50/50 transition-colors">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {isPositive ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {tx.description || tx.type.replace('_', ' ').toUpperCase()}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(tx.created_at).toLocaleDateString('en-EG', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className={`text-xs sm:text-sm font-black ${isPositive ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {isPositive ? '+' : ''}EGP {Math.abs(tx.amount).toLocaleString('en-EG')}
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
                <h3 className="text-base font-black text-slate-900">Top-Up Spendable Balance</h3>
                <button onClick={() => setTopUpOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>

              {errorMsg && <div className="mb-4 bg-rose-50 text-rose-700 text-xs p-3 rounded-xl border border-rose-200">{errorMsg}</div>}

              {topUpSuccess ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                  <h4 className="text-base font-black text-slate-900">Funds Added! 🎉</h4>
                  <p className="text-xs text-slate-500">Your available balance has been updated.</p>
                </div>
              ) : (
                <form onSubmit={handleTopUp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Deposit Amount (EGP)</label>
                    <input
                      type="number"
                      value={topUpAmount}
                      onChange={e => setTopUpAmount(e.target.value)}
                      placeholder="e.g. 500"
                      min="10"
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold outline-none focus:border-blue-500"
                      autoFocus
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Payment Method</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'card', label: 'Debit/Credit Card', icon: CreditCard },
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
                    {toppingUp ? 'Processing Deposit...' : `Add EGP ${Number(topUpAmount || 0).toLocaleString('en-EG')} Now`}
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
                <h3 className="text-base font-black text-slate-900">Withdraw Earnings</h3>
                <button onClick={() => setWithdrawOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>

              {errorMsg && <div className="mb-4 bg-rose-50 text-rose-700 text-xs p-3 rounded-xl border border-rose-200">{errorMsg}</div>}

              {withdrawSuccess ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                  <h4 className="text-base font-black text-slate-900">Payout Submitted! 🚀</h4>
                  <p className="text-xs text-slate-500">Funds are being transferred to your selected account.</p>
                </div>
              ) : (
                <form onSubmit={handleWithdraw} className="space-y-4">
                  <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-600">
                    Available for withdrawal: <strong className="text-slate-900">EGP {available.toLocaleString('en-EG')}</strong>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Withdrawal Amount (EGP)</label>
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={e => setWithdrawAmount(e.target.value)}
                      placeholder="e.g. 1000"
                      max={available}
                      min="50"
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold outline-none focus:border-blue-500"
                      autoFocus
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Payout Channel</label>
                    <select
                      value={selectedPayoutMethod}
                      onChange={e => setSelectedPayoutMethod(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-blue-500 bg-white"
                    >
                      {payoutMethods.map(pm => (
                        <option key={pm.id} value={pm.id}>
                          {pm.type === 'instapay_ipa' ? 'InstaPay' : pm.type === 'vodafone_cash' ? 'Vodafone Cash' : 'Bank'} — {pm.account_identifier}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={withdrawing || !withdrawAmount || Number(withdrawAmount) > available}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors text-xs shadow-md"
                  >
                    {withdrawing ? 'Submitting Request...' : `Withdraw EGP ${Number(withdrawAmount || 0).toLocaleString('en-EG')}`}
                  </button>
                </form>
              )}
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
