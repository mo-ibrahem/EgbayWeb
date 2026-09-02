'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, AlertCircle, ArrowRight, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/components/LanguageProvider';

function ForgotPasswordForm() {
  const { isRTL } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError(isRTL ? 'يرجى إدخال البريد الإلكتروني.' : 'Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setError(isRTL ? 'يرجى إدخال بريد إلكتروني صالح.' : 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl,
      });

      if (resetError) {
        setError(resetError.message);
      } else {
        setSubmitted(true);
      }
    } catch (err: any) {
      setError(err?.message || (isRTL ? 'حدث خطأ ما. يرجى المحاولة مرة أخرى.' : 'An error occurred. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="w-full max-w-md bg-white border border-gray-200/80 rounded-3xl p-8 sm:p-10 text-center shadow-xl shadow-slate-900/5">
        <div className="w-16 h-16 bg-blue-50 text-brand rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Mail className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">
          {isRTL ? 'تحقق من بريدك الإلكتروني 📩' : 'Check your email 📩'}
        </h2>
        <p className="text-gray-500 text-xs leading-relaxed mb-6">
          {isRTL
            ? `لقد أرسلنا رابط إعادة تعيين كلمة المرور إلى ${email}. يرجى الضغط على الرابط في رسالتك لتحديد كلمة مرور جديدة.`
            : `We've sent a password reset link to ${email}. Click the link in your email to set a new password.`}
        </p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="w-full text-xs text-gray-600 hover:text-gray-900 font-semibold py-2.5 transition-colors"
          >
            {isRTL ? 'إعادة الإرسال أو تغيير البريد الإلكتروني' : 'Resend or change email'}
          </button>

          <Link
            href="/login"
            className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-blue-500/20 text-xs flex items-center justify-center gap-2"
          >
            {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            <span>{isRTL ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}</span>
          </Link>
        </div>
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
            {isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset your password'}
          </h1>
          <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">
            {isRTL
              ? 'أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور'
              : 'Enter your email and we’ll send you a link to reset your password'}
          </p>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-2xl p-3.5 text-red-700 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
                className={`w-full bg-white border border-gray-300 rounded-xl ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 text-gray-900 placeholder-gray-400 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-blue-100 transition-all shadow-sm`}
                required
                autoFocus
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-brand-dark disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all shadow-md shadow-blue-500/20 text-xs flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isRTL ? 'جاري إرسال الرابط...' : 'Sending link...'}</span>
              </>
            ) : (
              <>
                <span>{isRTL ? 'إرسال رابط إعادة التعيين' : 'Send Reset Link'}</span>
                <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-100 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 font-semibold transition-colors"
          >
            {isRTL ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
            <span>{isRTL ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-[#F8FAFC]">
      <Suspense fallback={<div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />}>
        <ForgotPasswordForm />
      </Suspense>
    </div>
  );
}
