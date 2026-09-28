'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { profileService } from '@/lib/products';
import { supabase } from '@/lib/supabase';
import { BlockedUsersCard, DeleteAccountCard } from '@/app/profile/SafetyCards';

function SettingsContent() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { isRTL, language, toggleLanguage } = useLanguage();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) return;
    profileService.getProfile(user.id).then(profile => {
      setName(profile?.full_name || '');
      setPhone(profile?.phone || '');
    }).catch(err => setError(err?.message || 'Could not load profile.'));
  }, [user]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true); setError(''); setMessage('');
    try {
      await profileService.updateProfile(user.id, { full_name: name.trim(), phone: phone.trim() });
      setMessage(isRTL ? 'تم حفظ البيانات الشخصية.' : 'Personal information saved.');
    } catch (err) { setError((err as Error)?.message || 'Could not save profile.'); }
    finally { setSaving(false); }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setMessage('');
    if (password.length < 6 || password !== confirmPassword) { setError(isRTL ? 'تحقق من كلمة المرور وتأكيدها (٦ أحرف على الأقل).' : 'Check your password and confirmation (at least 6 characters).'); return; }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) setError(updateError.message);
    else { setPassword(''); setConfirmPassword(''); setMessage(isRTL ? 'تم تغيير كلمة المرور.' : 'Password updated.'); }
    setSaving(false);
  };

  const field = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';
  return <main className="max-w-5xl mx-auto px-4 py-8 pb-28">
    <h1 className="text-2xl font-black text-slate-900 mb-6">{isRTL ? 'الإعدادات' : 'Settings'}</h1>
    {error && <p role="alert" className="mb-5 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</p>}
    {message && <p role="status" className="mb-5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg p-3 text-sm">{message}</p>}
    <div className="grid md:grid-cols-2 gap-5">
      <form onSubmit={saveProfile} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-black">{isRTL ? 'البيانات الشخصية' : 'Personal information'}</h2>
        <div><label htmlFor="settings-name" className="block text-sm font-bold mb-1">{isRTL ? 'الاسم بالكامل' : 'Full name'}</label><input id="settings-name" className={field} value={name} onChange={e => setName(e.target.value)} required /></div>
        <div><label htmlFor="settings-phone" className="block text-sm font-bold mb-1">{isRTL ? 'رقم الهاتف' : 'Phone number'}</label><input id="settings-phone" type="tel" className={field} value={phone} onChange={e => setPhone(e.target.value)} /></div>
        <button disabled={saving} type="submit" className="w-full bg-brand text-white rounded-lg py-2.5 text-sm font-bold disabled:opacity-50">{isRTL ? 'حفظ البيانات' : 'Save information'}</button>
      </form>
      <form onSubmit={changePassword} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-black">{isRTL ? 'كلمة المرور' : 'Password'}</h2>
        <div><label htmlFor="settings-password" className="block text-sm font-bold mb-1">{isRTL ? 'كلمة المرور الجديدة' : 'New password'}</label><input id="settings-password" type="password" className={field} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" /></div>
        <div><label htmlFor="settings-confirm" className="block text-sm font-bold mb-1">{isRTL ? 'تأكيد كلمة المرور' : 'Confirm password'}</label><input id="settings-confirm" type="password" className={field} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" /></div>
        <button disabled={saving || !password} type="submit" className="w-full bg-slate-900 text-white rounded-lg py-2.5 text-sm font-bold disabled:opacity-50">{isRTL ? 'تحديث كلمة المرور' : 'Update password'}</button>
      </form>
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-black">{isRTL ? 'التفضيلات' : 'Preferences'}</h2>
        <button type="button" onClick={toggleLanguage} className="w-full text-start border border-slate-200 rounded-lg px-4 py-3 text-sm">{isRTL ? 'اللغة' : 'Language'} <span className="float-end font-bold">{language === 'en' ? 'English' : 'العربية'}</span></button>
        <Link href="/notifications" className="block border border-slate-200 rounded-lg px-4 py-3 text-sm">{isRTL ? 'الإشعارات' : 'Notifications'}</Link>
        <Link href="/terms" className="block border border-slate-200 rounded-lg px-4 py-3 text-sm">{isRTL ? 'الشروط' : 'Terms'}</Link>
        <Link href="/privacy" className="block border border-slate-200 rounded-lg px-4 py-3 text-sm">{isRTL ? 'الخصوصية' : 'Privacy'}</Link>
        <button type="button" onClick={async () => { await signOut(); router.push('/login'); }} className="w-full text-start border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{isRTL ? 'تسجيل الخروج' : 'Sign out'}</button>
      </div>
      <BlockedUsersCard />
      <DeleteAccountCard />
    </div>
  </main>;
}

export default function SettingsPage() { return <ProtectedRoute><SettingsContent /></ProtectedRoute>; }
