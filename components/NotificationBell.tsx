'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Loader2, CheckCheck } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { supabase } from '@/lib/supabase';
import {
  type AppNotification,
  getRecentNotifications,
  getUnreadNotificationCount,
  markNotificationsRead,
  markAllNotificationsRead,
  getNotificationCopy,
} from '@/lib/notifications';

function timeAgo(dateStr: string, isRTL: boolean): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isRTL ? 'الآن' : 'now';
  if (mins < 60) return isRTL ? `منذ ${mins} د` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isRTL ? `منذ ${hrs} س` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return isRTL ? `منذ ${days} يوم` : `${days}d`;
}

/**
 * Bell + dropdown for the navbar. Unread count is fetched on mount
 * (cheap, always needed for the badge); the notification list itself is
 * lazy-loaded on first open rather than fetched unconditionally.
 *
 * Realtime only ever ADDS to state (new INSERTs for this user, RLS-
 * scoped) -- there's no optimistic local insert to reconcile against,
 * so the double-render bug that hit chat's send flow doesn't apply
 * here. Still deduped by id defensively, since this channel and a
 * manual "open the panel" fetch could both add the same row.
 */
export default function NotificationBell() {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    getUnreadNotificationCount().then(setUnreadCount).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const incoming = payload.new as AppNotification;
        setNotifications(prev => (prev.some(n => n.id === incoming.id) ? prev : [incoming, ...prev]));
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = useCallback(() => {
    setOpen(o => !o);
    if (!loadedOnce) {
      setLoading(true);
      getRecentNotifications(20)
        .then(setNotifications)
        .catch(() => {})
        .finally(() => { setLoading(false); setLoadedOnce(true); });
    }
  }, [loadedOnce]);

  const handleClickNotification = async (n: AppNotification) => {
    setOpen(false);
    if (!n.read_at) {
      setNotifications(prev => prev.map(x => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      setUnreadCount(prev => Math.max(0, prev - 1));
      markNotificationsRead([n.id]).catch(() => {});
    }
    if (n.link) router.push(n.link);
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications(prev => prev.map(n => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch (err) {
      console.error('[NotificationBell] Failed to mark all read:', err);
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
        aria-label={isRTL ? 'الإشعارات' : 'Notifications'}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-md shadow-card-lg border border-slate-200 z-50 overflow-hidden`}>
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-900">{isRTL ? 'الإشعارات' : 'Notifications'}</p>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="flex items-center gap-1 text-[11px] font-bold text-brand hover:text-brand-dark transition-colors">
                <CheckCheck className="w-3.5 h-3.5" />
                {isRTL ? 'تعليم الكل كمقروء' : 'Mark all read'}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-10 px-4">
                <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">{isRTL ? 'لا توجد إشعارات بعد' : 'No notifications yet'}</p>
              </div>
            ) : (
              notifications.map(n => {
                const copy = getNotificationCopy(n, isRTL);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClickNotification(n)}
                    className={`w-full text-left rtl:text-right px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors flex gap-2.5 ${!n.read_at ? 'bg-brand-soft/40' : ''}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${!n.read_at ? 'bg-brand' : 'bg-transparent'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-slate-900 line-clamp-1">{copy.title}</span>
                      <span className="block text-[11px] text-slate-500 line-clamp-2 mt-0.5">{copy.message}</span>
                      <span className="block text-[10px] text-slate-400 mt-1">{timeAgo(n.created_at, isRTL)}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <button
            onClick={() => { setOpen(false); router.push('/notifications'); }}
            className="w-full text-center text-xs font-bold text-brand hover:bg-slate-50 py-2.5 border-t border-slate-100 transition-colors"
          >
            {isRTL ? 'عرض كل الإشعارات' : 'View all notifications'}
          </button>
        </div>
      )}
    </div>
  );
}
