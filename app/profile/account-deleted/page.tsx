'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/components/LanguageProvider';
import { supabase } from '@/lib/supabase';

type Status = 'pending' | 'complete' | 'unavailable';

// Deliberately not behind ProtectedRoute: the user is signed out by the
// time they land here. Status comes from the delete-account response and is
// then refreshed from account_deletion_status(receipt); nothing is claimed
// as complete unless one of those said so.
function DeletionStatus() {
  const { isRTL } = useLanguage();
  const params = useSearchParams();
  const receipt = params.get('receipt') ?? '';
  const validReceipt = /^[0-9a-f-]{36}$/i.test(receipt);
  const [status, setStatus] = useState<Status>(params.get('status') === 'complete' ? 'complete' : 'pending');

  useEffect(() => {
    if (status === 'complete' || !validReceipt) return;
    let alive = true;
    const refresh = async () => {
      const { data, error } = await supabase.rpc('account_deletion_status', { p_receipt: receipt });
      const next = !error && data?.[0]?.status;
      if (alive && (next === 'complete' || next === 'pending')) setStatus(next);
      else if (alive && (error || !data?.[0])) setStatus('unavailable');
    };
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => { alive = false; clearInterval(timer); };
  }, [receipt, validReceipt, status]);

  const title = status === 'complete'
    ? (isRTL ? 'تم حذف الحساب' : 'Account deleted')
    : (isRTL ? 'طلب حذف الحساب' : 'Account deletion requested');
  const body = status === 'complete'
    ? (isRTL ? 'تم حذف حسابك والمحتوى الذي رفعته.' : 'Your account and uploaded content have been removed.')
    : status === 'unavailable'
    ? (isRTL ? 'تعذر التحقق من طلب الحذف. حاول لاحقاً أو راسلنا على info@egbay.shop.' : 'We could not verify this deletion request. Please try again later or contact info@egbay.shop.')
    : (isRTL ? 'تم إيقاف حسابك وما زال الحذف قيد التنفيذ. نتحقق من التقدم تلقائياً. إذا استمر الانتظار راسلنا على info@egbay.shop.' : 'Your account is disabled and deletion is still in progress. This page checks progress automatically. If it stays pending, contact info@egbay.shop.');

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8 space-y-4 text-center">
        <h1 className="text-xl font-black text-gray-900">{title}</h1>
        <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
        {receipt && <p className="text-xs text-gray-400 select-all break-all">{isRTL ? 'المرجع:' : 'Support reference:'} {receipt}</p>}
        <Link href="/login" className="inline-block bg-brand hover:bg-brand-dark text-white font-bold text-xs px-6 py-3 rounded-xl">
          {isRTL ? 'العودة لتسجيل الدخول' : 'Back to sign in'}
        </Link>
      </div>
    </div>
  );
}

export default function AccountDeletedPage() {
  return (
    <Suspense fallback={null}>
      <DeletionStatus />
    </Suspense>
  );
}
