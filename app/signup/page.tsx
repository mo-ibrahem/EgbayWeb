'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, CheckCircle2, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/components/LanguageProvider';

export default function SignupPage() {
  const router = useRouter();
  const { isRTL } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password) {
      setError(isRTL ? 'يرجى ملء جميع الحقول المطلوبة.' : 'Please fill in all required fields.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setError(isRTL ? 'يرجى إدخال بريد إلكتروني صالح.' : 'Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError(isRTL ? 'يجب ألا تقل كلمة المرور عن ٦ أحرف.' : 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            name: cleanName,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
      } else if (data?.user && !data?.session) {
        // Confirmation email was sent by Supabase
        setNeedsConfirmation(true);
        setSuccess(true);
        setLoading(false);
      } else {
        // User is immediately authenticated
        setSuccess(true);
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 1500);
      }
    } catch (err: any) {
      setError(err?.message || (isRTL ? 'فشل إنشاء الحساب. يرجى المحاولة مرة أخرى.' : 'Failed to create account. Please try again.'));
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-[#F8FAFC]">
        <div className="bg-white border border-gray-200/80 rounded-3xl p-10 max-w-md w-full text-center shadow-xl shadow-slate-900/5">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-gray-900 mb-2">
            {isRTL ? 'تم إنشاء حسابك بنجاح! 🎉' : 'Account Created! 🎉'}
          </h2>
          {needsConfirmation ? (
            <div>
              <p className="text-gray-600 text-xs leading-relaxed mb-6">
                {isRTL
                  ? `أرسلنا رسالة تأكيد إلى ${email}. يرجى التحقق من بريدك لتفعيل الحساب ثم تسجيل الدخول.`
                  : `We sent a verification email to ${email}. Please confirm your email to activate your account.`}
              </p>
              <Link
                href="/login"
                className="w-full inline-flex items-center justify-center gap-2 bg-[#3665F3] hover:bg-[#2B54D4] text-white font-bold py-3.5 rounded-xl transition-all shadow-md text-xs"
              >
                <span>{isRTL ? 'الانتقال إلى تسجيل الدخول' : 'Go to Sign In'}</span>
                <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
              </Link>
            </div>
          ) : (
            <p className="text-gray-500 text-xs">
              {isRTL ? 'جاري تحويلك إلى السوق...' : 'Redirecting you to the marketplace...'}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-[#F8FAFC]">
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
              {isRTL ? 'إنشاء حساب جديد' : 'Create your account'}
            </h1>
            <p className="text-gray-500 text-xs mt-1.5">
              {isRTL ? 'انضم إلى سوق إيجي باي الموثق بالضمان المالي' : 'Join Egypt\'s trusted escrow marketplace'}
            </p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-2xl p-3.5 text-red-700 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                {isRTL ? 'الاسم بالكامل' : 'Full Name'}
              </label>
              <div className="relative">
                <User className={`absolute ${isRTL ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isRTL ? 'مثال: أحمد محمد' : 'Ahmed Mohamed'}
                  className={`w-full bg-white border border-gray-300 rounded-xl ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 text-gray-900 placeholder-gray-400 text-xs outline-none focus:border-[#3665F3] focus:ring-2 focus:ring-blue-100 transition-all shadow-sm`}
                  required
                  autoFocus
                />
              </div>
            </div>

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
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                {isRTL ? 'كلمة المرور' : 'Password'}
              </label>
              <div className="relative">
                <Lock className={`absolute ${isRTL ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRTL ? '٦ أحرف على الأقل' : 'At least 6 characters'}
                  className={`w-full bg-white border border-gray-300 rounded-xl ${isRTL ? 'pr-10 pl-12' : 'pl-10 pr-12'} py-3 text-gray-900 placeholder-gray-400 text-xs outline-none focus:border-[#3665F3] focus:ring-2 focus:ring-blue-100 transition-all shadow-sm`}
                  required
                  minLength={6}
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

            <p className="text-[11px] text-gray-500 leading-relaxed">
              {isRTL ? 'بإنشاء الحساب، أنت توافق على ' : 'By creating an account, you agree to our '}
              <Link href="/terms" className="text-[#3665F3] hover:underline font-semibold">
                {isRTL ? 'الشروط والأحكام' : 'Terms'}
              </Link>{' '}
              {isRTL ? 'و' : 'and'}{' '}
              <Link href="/privacy" className="text-[#3665F3] hover:underline font-semibold">
                {isRTL ? 'سياسة الخصوصية' : 'Privacy Policy'}
              </Link>.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#3665F3] hover:bg-[#2B54D4] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all shadow-md shadow-blue-500/20 text-xs flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isRTL ? 'جاري إنشاء الحساب...' : 'Creating account...'}</span>
                </>
              ) : (
                <>
                  <span>{isRTL ? 'إنشاء الحساب' : 'Create Account'}</span>
                  <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-500">
              {isRTL ? 'لديك حساب بالفعل؟' : 'Already have an account?'}{' '}
              <Link href="/login" className="text-[#3665F3] hover:underline font-bold ml-1">
                {isRTL ? 'تسجيل الدخول' : 'Sign In'}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
