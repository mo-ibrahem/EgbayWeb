'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/components/LanguageProvider';

function ResetPasswordForm() {
  const router = useRouter();
  const { isRTL } = useLanguage();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if we have an active recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Also check hash parameters in case of access_token in URL
      const hash = window.location.hash;
      if (session || hash.includes('access_token') || hash.includes('type=recovery')) {
        setHasSession(true);
      } else {
        // Give Supabase client a moment to parse the URL hash
        setTimeout(async () => {
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          setHasSession(!!retrySession || window.location.hash.includes('access_token'));
        }, 500);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setHasSession(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setError(isRTL ? 'يرجى ملء جميع الحقول.' : 'Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setError(isRTL ? 'يجب ألا تقل كلمة المرور عن ٦ أحرف.' : 'Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError(isRTL ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 2500);
      }
    } catch (err: any) {
      setError(err?.message || (isRTL ? 'حدث خطأ ما. يرجى المحاولة مرة أخرى.' : 'An error occurred. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md bg-white border border-gray-200/80 rounded-3xl p-8 sm:p-10 text-center shadow-xl shadow-slate-900/5">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">
          {isRTL ? 'تم تحديث كلمة المرور بنجاح! 🎉' : 'Password Updated! 🎉'}
        </h2>
        <p className="text-gray-500 text-xs leading-relaxed mb-6">
          {isRTL
            ? 'تم حفظ كلمة المرور الجديدة. جاري تحويلك إلى صفحة تسجيل الدخول...'
            : 'Your password has been successfully reset. Redirecting you to sign in...'}
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 w-full bg-[#3665F3] hover:bg-[#2B54D4] text-white font-bold py-3 rounded-xl transition-all text-xs shadow-md shadow-blue-500/20"
        >
          <span>{isRTL ? 'تسجيل الدخول الآن' : 'Sign In Now'}</span>
          <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
        </Link>
      </div>
    );
  }

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
            {isRTL ? 'تعيين كلمة مرور جديدة' : 'Create New Password'}
          </h1>
          <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">
            {isRTL
              ? 'اختر كلمة مرور قوية لحماية حسابك ومعاملاتك'
              : 'Choose a secure password to protect your account & transactions'}
          </p>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-2xl p-3.5 text-red-700 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              {isRTL ? 'كلمة المرور الجديدة' : 'New Password'}
            </label>
            <div className="relative">
              <Lock className={`absolute ${isRTL ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRTL ? '٦ أحرف على الأقل' : 'At least 6 characters'}
                className={`w-full bg-white border border-gray-300 rounded-xl ${isRTL ? 'pr-10 pl-12' : 'pl-10 pr-12'} py-3 text-gray-900 placeholder-gray-400 text-xs outline-none focus:border-[#3665F3] focus:ring-2 focus:ring-blue-100 transition-all shadow-sm`}
                required
                minLength={6}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute ${isRTL ? 'left-3.5' : 'right-3.5'} top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors`}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              {isRTL ? 'تأكيد كلمة المرور' : 'Confirm New Password'}
            </label>
            <div className="relative">
              <Lock className={`absolute ${isRTL ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={isRTL ? 'أعد إدخال كلمة المرور' : 'Re-enter your password'}
                className={`w-full bg-white border border-gray-300 rounded-xl ${isRTL ? 'pr-10 pl-12' : 'pl-10 pr-12'} py-3 text-gray-900 placeholder-gray-400 text-xs outline-none focus:border-[#3665F3] focus:ring-2 focus:ring-blue-100 transition-all shadow-sm`}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className={`absolute ${isRTL ? 'left-3.5' : 'right-3.5'} top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors`}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                <span>{isRTL ? 'جاري حفظ كلمة المرور...' : 'Updating password...'}</span>
              </>
            ) : (
              <>
                <span>{isRTL ? 'حفظ وتأكيد كلمة المرور' : 'Update Password'}</span>
                <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-100 text-center">
          <Link
            href="/login"
            className="text-xs text-gray-500 hover:text-gray-800 font-semibold transition-colors"
          >
            {isRTL ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-[#F8FAFC]">
      <Suspense fallback={<div className="w-8 h-8 border-2 border-[#3665F3] border-t-transparent rounded-full animate-spin" />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
