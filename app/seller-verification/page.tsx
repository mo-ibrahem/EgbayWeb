'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, ShieldCheck, CheckCircle2, AlertCircle, Upload,
  Camera, User, Smartphone, Building, Sparkles, Lock, CreditCard
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  validateEgyptianNationalId,
  upgradeSellerTier,
  addPayoutMethod,
  type NationalIdInfo
} from '@/lib/walletService';

function SellerVerificationContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [selectedTier, setSelectedTier] = useState<2 | 3>(2);
  const [fullName, setFullName] = useState('');
  const [nationalIdNum, setNationalIdNum] = useState('');
  const [idInfo, setIdInfo] = useState<NationalIdInfo | null>(null);
  const [instapayIpa, setInstapayIpa] = useState('');
  const [vodafoneCash, setVodafoneCash] = useState('');
  const [bankIban, setBankIban] = useState('');
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const handleIdChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 14);
    setNationalIdNum(cleaned);
    if (cleaned.length === 14) {
      const parsed = validateEgyptianNationalId(cleaned);
      setIdInfo(parsed);
    } else {
      setIdInfo(null);
    }
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (side === 'front') setFrontImage(url);
    else setBackImage(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (nationalIdNum.length !== 14 || !idInfo?.isValid) {
      setErrorMsg('Please enter a valid 14-digit Egyptian National ID');
      return;
    }
    const hasAtLeastOne = instapayIpa.trim() || vodafoneCash.trim() || bankIban.trim();
    if (!hasAtLeastOne) {
      setErrorMsg('Please provide at least one payout destination (InstaPay, Vodafone Cash, or Bank IBAN)');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      await upgradeSellerTier(user.id, selectedTier);

      let isFirst = true;

      if (instapayIpa.trim()) {
        await addPayoutMethod(user.id, {
          user_id: user.id,
          type: 'instapay_ipa',
          account_identifier: instapayIpa.trim(),
          account_holder_name: fullName.trim() || user.user_metadata?.full_name || 'Seller',
          is_default: isFirst,
          is_verified: true,
        });
        isFirst = false;
      }

      if (vodafoneCash.trim()) {
        await addPayoutMethod(user.id, {
          user_id: user.id,
          type: 'vodafone_cash',
          account_identifier: vodafoneCash.trim(),
          account_holder_name: fullName.trim() || user.user_metadata?.full_name || 'Seller',
          is_default: isFirst,
          is_verified: true,
        });
        isFirst = false;
      }

      if (bankIban.trim()) {
        await addPayoutMethod(user.id, {
          user_id: user.id,
          type: 'bank_account',
          account_identifier: bankIban.trim(),
          account_holder_name: fullName.trim() || user.user_metadata?.full_name || 'Seller',
          is_default: isFirst,
          is_verified: true,
        });
      }

      setSuccess(true);
      setTimeout(() => router.push('/wallet'), 2000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to submit verification');
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">Seller Verified! 🛡️✨</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Your account is now upgraded to <strong>{selectedTier === 3 ? 'EgyBay Pro Merchant' : 'Verified Trader'}</strong> with lower fees and fast payouts!
        </p>
        <Link
          href="/wallet"
          className="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-blue-700 transition-colors inline-block"
        >
          Go to My Wallet
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-600" /> Seller Verification & KYC
        </h1>
      </div>

      {errorMsg && (
        <div className="mb-6 bg-red-50 text-red-700 text-sm p-4 rounded-2xl border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" /> {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tier Selection */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">1. Select Target Tier</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedTier(2)}
              className={`p-4 rounded-2xl border-2 text-left transition-all ${
                selectedTier === 2
                  ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                  : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-gray-900 text-sm">🛡️ Verified Trader (Tier 2)</span>
                <span className="text-xs font-bold text-blue-600">4% Fee</span>
              </div>
              <p className="text-xs text-gray-500">
                Unlock instant InstaPay & Vodafone Cash payouts. Requires National ID.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTier(3)}
              className={`p-4 rounded-2xl border-2 text-left transition-all ${
                selectedTier === 3
                  ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                  : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-gray-900 text-sm">⭐ Pro Merchant (Tier 3)</span>
                <span className="text-xs font-bold text-purple-600">2.5% Fee</span>
              </div>
              <p className="text-xs text-gray-500">
                Instant clearance upon courier scan & unlimited listings.
              </p>
            </button>
          </div>
        </div>

        {/* National ID 14 Digits */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">2. Egyptian National ID Details</h2>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Full Legal Name (as on ID)</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="الاسم ثلاثي أو رباعي كما في بطاقة الرقم القومي"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">14-Digit Egyptian National ID (الرقم القومي)</label>
            <input
              type="text"
              value={nationalIdNum}
              onChange={e => handleIdChange(e.target.value)}
              placeholder="298XXXXXXXXXXX"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg font-mono font-bold tracking-widest outline-none focus:border-blue-500"
              maxLength={14}
              required
            />
          </div>

          {/* Real-time Decoded ID Info */}
          {idInfo && (
            <div className={`p-4 rounded-2xl border text-xs space-y-1 ${
              idInfo.isValid ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              {idInfo.isValid ? (
                <>
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Valid Egyptian National ID
                  </div>
                  <p>Governorate: <strong>{idInfo.governorate}</strong></p>
                  <p>Birth Date: <strong>{idInfo.birthDate}</strong> · Gender: <strong>{idInfo.gender}</strong></p>
                </>
              ) : (
                <div className="flex items-center gap-1.5 text-rose-700">
                  <AlertCircle className="w-4 h-4 text-rose-600" /> {idInfo.error}
                </div>
              )}
            </div>
          )}

          {/* ID Card Photos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2">ID Card Front (الوجه الأمامي)</label>
              <div
                onClick={() => frontInputRef.current?.click()}
                className="aspect-[16/10] rounded-2xl border-2 border-dashed border-gray-200 hover:border-blue-400 bg-gray-50 flex flex-col items-center justify-center cursor-pointer relative overflow-hidden transition-all"
              >
                {frontImage ? (
                  <Image src={frontImage} alt="Front ID" fill className="object-cover" />
                ) : (
                  <div className="text-center p-4 text-gray-400">
                    <Camera className="w-8 h-8 mx-auto mb-1 text-gray-300" />
                    <span className="text-xs font-semibold">Upload Front Photo</span>
                  </div>
                )}
                <input ref={frontInputRef} type="file" accept="image/*" onChange={e => handleImagePick(e, 'front')} className="hidden" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2">ID Card Back (الوجه الخلفي)</label>
              <div
                onClick={() => backInputRef.current?.click()}
                className="aspect-[16/10] rounded-2xl border-2 border-dashed border-gray-200 hover:border-blue-400 bg-gray-50 flex flex-col items-center justify-center cursor-pointer relative overflow-hidden transition-all"
              >
                {backImage ? (
                  <Image src={backImage} alt="Back ID" fill className="object-cover" />
                ) : (
                  <div className="text-center p-4 text-gray-400">
                    <Camera className="w-8 h-8 mx-auto mb-1 text-gray-300" />
                    <span className="text-xs font-semibold">Upload Back Photo</span>
                  </div>
                )}
                <input ref={backInputRef} type="file" accept="image/*" onChange={e => handleImagePick(e, 'back')} className="hidden" />
              </div>
            </div>
          </div>
        </div>

        {/* Payout Details */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">3. Payout Destinations</h2>
            <p className="text-xs text-gray-500">Link your Egyptian payout destinations. You can add all 3 (at least 1 is required).</p>
          </div>

          <div className="space-y-4 pt-2">
            {/* 1. InstaPay IPA */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-1.5">
                <Building className="w-4 h-4 text-blue-600" />
                <span>1. InstaPay IPA Handle</span>
              </label>
              <input
                type="text"
                value={instapayIpa}
                onChange={e => setInstapayIpa(e.target.value)}
                placeholder="e.g. username@instapay"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            {/* 2. Vodafone Cash */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-1.5">
                <Smartphone className="w-4 h-4 text-rose-600" />
                <span>2. Vodafone Cash / Mobile Wallet</span>
              </label>
              <input
                type="tel"
                value={vodafoneCash}
                onChange={e => setVodafoneCash(e.target.value)}
                placeholder="e.g. 010XXXXXXXX"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            {/* 3. Bank IBAN */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-1.5">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>3. Bank Account IBAN</span>
              </label>
              <input
                type="text"
                value={bankIban}
                onChange={e => setBankIban(e.target.value)}
                placeholder="e.g. EG380002000100000000012345678"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !idInfo?.isValid || (!instapayIpa.trim() && !vodafoneCash.trim() && !bankIban.trim())}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-sm transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
        >
          <ShieldCheck className="w-5 h-5" />
          {submitting ? 'Submitting Verification...' : 'Submit Verification & Upgrade Tier'}
        </button>
      </form>
    </div>
  );
}

export default function SellerVerificationPage() {
  return (
    <ProtectedRoute>
      <SellerVerificationContent />
    </ProtectedRoute>
  );
}
