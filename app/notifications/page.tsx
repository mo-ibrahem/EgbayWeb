'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  type AppNotification,
  getRecentNotifications,
  markNotificationsRead,
  markAllNotificationsRead,
  getNotificationCopy,
} from '@/lib/notifications';
import EmptyState from '@/components/ui/EmptyState';

function timeAgo(dateStr: string, isRTL: boolean): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isRTL ? 'الآن' : 'Just now';
  if (mins < 60) return isRTL ? `منذ ${mins} دقيقة` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isRTL ? `منذ ${hrs} ساعة` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return isRTL ? `منذ ${days} يوم` : `${days}d ago`;
}

function NotificationsContent() {
  const { user, loading: authLoading } = useAuth();
  const { isRTL } = useLanguage();
  const router = useRouter();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      // Full history at this scale is a flat, reasonably-sized fetch --
      // no pagination UI, matching how the rest of this app doesn't
      // over-build for volume it doesn't have yet.
      setNotifications(await getRecentNotifications(100));
    } catch (e) {
      console.error('[Notifications] Failed to load:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login?redirect=/notifications'); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, router]);

  const unreadCount = notifications.filter(n => !n.read_at).length;

  const handleClick = async (n: AppNotification) => {
    if (!n.read_at) {
      setNotifications(prev => prev.map(x => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      markNotificationsRead([n.id]).catch(() => {});
    }
    if (n.link) router.push(n.link);
  };

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
    try {
      await markAllNotificationsRead();
    } catch (e) {
      console.error('[Notifications] Failed to mark all read:', e);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    // max-w-3xl, not max-w-7xl: same reasoning as the orders list --
    // a single column of rows doesn't need product-grid width.
    <div className="w-full max-w-3xl mx-auto px-4 py-6 sm:py-8">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-black text-slate-900">{isRTL ? 'الإشعارات' : 'Notifications'}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {unreadCount > 0
              ? (isRTL ? `${unreadCount} غير مقروء` : `${unreadCount} unread`)
              : (isRTL ? 'كل شيء مقروء' : 'All caught up')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-brand bg-brand-soft hover:opacity-80 rounded-md transition-colors">
              <CheckCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isRTL ? 'تعليم الكل كمقروء' : 'Mark all read'}</span>
            </button>
          )}
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isRTL ? 'تحديث' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-6 h-6" />}
          title={isRTL ? 'لا توجد إشعارات بعد' : 'No notifications yet'}
          description={isRTL ? 'ستظهر هنا التحديثات على طلباتك ومحادثاتك.' : "Updates on your orders and chats will show up here."}
          className="bg-white border border-slate-200 rounded-lg"
        />
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {notifications.map(n => {
            const copy = getNotificationCopy(n, isRTL);
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left rtl:text-right px-4 sm:px-5 py-4 hover:bg-slate-50 transition-colors flex gap-3 ${!n.read_at ? 'bg-brand-soft/40' : ''}`}
              >
                <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.read_at ? 'bg-brand' : 'bg-transparent'}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900">{copy.title}</span>
                    <span className="text-[11px] text-slate-400 flex-shrink-0">{timeAgo(n.created_at, isRTL)}</span>
                  </span>
                  <span className="block text-xs text-slate-500 mt-1 leading-relaxed">{copy.message}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <ProtectedRoute>
      <NotificationsContent />
    </ProtectedRoute>
  );
}
