'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { supabase } from '@/lib/supabase';
import { getBlockedUserIds, unblockUser } from '@/lib/chatService';

/** People the signed-in user has blocked, with Unblock. */
export function BlockedUsersCard() {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const [rows, setRows] = useState<{ id: string; name: string }[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const ids = await getBlockedUserIds(user.id);
        const { data } = ids.length
          ? await supabase.from('public_profiles').select('id, full_name').in('id', ids)
          : { data: [] as { id: string; full_name: string | null }[] };
        const names = new Map((data ?? []).map(p => [String(p.id), p.full_name]));
        setRows(ids.map(id => ({ id, name: names.get(id) || (isRTL ? 'مستخدم إيجباي' : 'Egbay User') })));
      } catch {
        setError(isRTL ? 'تعذر تحميل قائمة الحظر.' : 'Could not load your blocked users.');
        setRows([]);
      }
    })();
  }, [user, isRTL]);

  const handleUnblock = async (id: string) => {
    setBusyId(id);
    setError('');
    try {
      await unblockUser(id);
      setRows(prev => (prev ?? []).filter(r => r.id !== id));
    } catch {
      setError(isRTL ? 'تعذر إلغاء الحظر. حاول مرة أخرى.' : 'Could not unblock. Please try again.');
    } finally { setBusyId(null); }
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-4">
      <div>
        <h3 className="text-lg font-black text-gray-900">{isRTL ? 'المستخدمون المحظورون' : 'Blocked users'}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{isRTL ? 'لا يمكنك مراسلتهم ولا يمكنهم مراسلتك.' : "You can't message them and they can't message you."}</p>
      </div>
      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-2xl p-3 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> <span>{error}</span>
        </div>
      )}
      {rows === null ? (
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">{isRTL ? 'لم تحظر أحداً.' : "You haven't blocked anyone."}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map(r => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm font-semibold text-gray-900 truncate">{r.name}</span>
              <button
                onClick={() => handleUnblock(r.id)}
                disabled={busyId === r.id}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 disabled:opacity-50 flex-shrink-0"
              >
                {isRTL ? 'إلغاء الحظر' : 'Unblock'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Permanent account deletion. The user must type DELETE; the edge function
 * is the only thing that can say whether it finished, so the result page is
 * driven by its response (and account_deletion_status), never assumed.
 */
export function DeleteAccountCard() {
  const router = useRouter();
  const { isRTL } = useLanguage();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    if (typed !== 'DELETE' || busy) return;
    setBusy(true);
    setError('');
    const { data, error: fnError } = await supabase.functions.invoke('delete-account', { body: {} });
    if (fnError || (data?.status !== 'complete' && data?.status !== 'pending')) {
      setError(isRTL
        ? 'لم نتمكن من تأكيد طلب الحذف. لم يتم تسجيل خروجك. حاول مرة أخرى أو راسلنا على info@egbay.shop.'
        : 'We could not confirm the deletion request, so you have not been signed out. Try again, or contact info@egbay.shop.');
      setBusy(false);
      return;
    }
    // Local sign-out only: the server may already have removed the auth user.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    const q = new URLSearchParams({ status: data.status });
    if (data.receipt) q.set('receipt', String(data.receipt));
    router.replace(`/profile/account-deleted?${q.toString()}`);
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-red-200 shadow-sm space-y-4 md:col-span-2">
      <div>
        <h3 className="text-lg font-black text-red-700">{isRTL ? 'حذف الحساب' : 'Delete account'}</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {isRTL
            ? 'يحذف حسابك وإعلاناتك ورسائلك وصورك نهائياً. لا يمكن التراجع عن ذلك.'
            : 'Permanently removes your account, listings, messages and uploads. This cannot be undone.'}
        </p>
      </div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 font-bold text-xs px-5 py-3 rounded-xl transition-all"
        >
          {isRTL ? 'حذف حسابي...' : 'Delete my account...'}
        </button>
      ) : (
        <div className="space-y-3 max-w-md">
          <label className="block text-xs font-bold text-gray-700">
            {isRTL ? 'للتأكيد، اكتب DELETE' : 'To confirm, type DELETE'}
          </label>
          <input
            type="text"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            dir="ltr"
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
          />
          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 rounded-2xl p-3 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{error}</span>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={typed !== 'DELETE' || busy}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isRTL ? 'حذف حسابي نهائياً' : 'Permanently delete my account'}
            </button>
            <button
              onClick={() => { setOpen(false); setTyped(''); setError(''); }}
              disabled={busy}
              className="text-xs font-bold text-gray-500 hover:text-gray-800 px-3"
            >
              {isRTL ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
