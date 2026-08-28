'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2, ShieldCheck, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/components/LanguageProvider';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';
  const { isRTL } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError(isRTL ? 'يرجى إدخال البريد الإلكتروني وكلمة المرور.' : 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    } else {
      router.push(redirectUrl);
      router.refresh();
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white border border-gray-200/80 rounded-3xl p-8 sm:p-10 shadow-xl shadow-slate-900/5">
        {/* Official egbay Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center mb-5 group">
            <div className="h-10 relative flex items-center">
              <Image
                src="/egbay.svg"
                alt="egbay"
                width={128}
                height={40}
                className="h-10 w-auto object-contain group-hover:opacity-90 transition-opacity"
                unoptimized
                priority
              />
            </div>
          </Link>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            {isRTL ? 'تسجيل الدخول إلى حسابك' : 'Sign in to your account'}
          </h1>
          <p className="text-gray-500 text-xs mt-1.5">
            {isRTL ? 'إدارة إعلاناتك، طلباتك، ومحفظتك المالية' : 'Manage your marketplace orders, listings & wallet'}
          </p>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-2xl p-3.5 text-red-700 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              {isRTL ? 'البريد الإلكتروني' : 'Email Address'}
            </label>
            <div className="relative">
              <Mail className={`absolute ${isRTL ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className={`w-full bg-white border border-gray-300 rounded-xl ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 text-gray-900 placeholder-gray-400 text-xs outline-none focus:border-[#3665F3] focus:ring-2 focus:ring-blue-100 transition-all shadow-sm`}
                required
                autoFocus
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-gray-700">
                {isRTL ? 'كلمة المرور' : 'Password'}
              </label>
            </div>
            <div className="relative">
              <Lock className={`absolute ${isRTL ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full bg-white border border-gray-300 rounded-xl ${isRTL ? 'pr-10 pl-12' : 'pl-10 pr-12'} py-3 text-gray-900 placeholder-gray-400 text-xs outline-none focus:border-[#3665F3] focus:ring-2 focus:ring-blue-100 transition-all shadow-sm`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className={`absolute ${isRTL ? 'left-3.5' : 'right-3.5'} top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors`}
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#3665F3] hover:bg-[#2B54D4] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all shadow-md shadow-blue-500/20 text-xs flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isRTL ? 'جاري تسجيل الدخول...' : 'Signing in...'}</span>
              </>
            ) : (
              <>
                <span>{isRTL ? 'تسجيل الدخول' : 'Sign In'}</span>
                <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500">
            {isRTL ? 'ليس لديك حساب بعد؟' : "Don't have an account yet?"}{' '}
            <Link
              href={`/signup?redirect=${encodeURIComponent(redirectUrl)}`}
              className="text-[#3665F3] hover:underline font-bold ml-1"
            >
              {isRTL ? 'إنشاء حساب جديد' : 'Create Account'}
            </Link>
          </p>
        </div>

        {/* Escrow note */}
        <div className="mt-6 bg-gray-50 rounded-2xl p-3.5 flex items-center gap-2.5 text-[11px] text-gray-500 border border-gray-100">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>
            {isRTL
              ? 'جميع المعاملات والمدفوعات مؤمّنة بنظام الضمان المالي المصري.'
              : 'All marketplace orders and payments are protected by Egyptian escrow.'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-[#F8FAFC]">
      <Suspense fallback={<div className="w-8 h-8 border-2 border-[#3665F3] border-t-transparent rounded-full animate-spin" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
