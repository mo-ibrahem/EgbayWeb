'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Home, Video, Package, MessageCircle, User } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { getUnreadNotificationCount } from '@/lib/notifications';
import { PAYMENTS_ENABLED } from '@/lib/platformCommerce';
import { getWaitingReplyCount } from '@/lib/homeActivity';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { isRTL } = useLanguage();

  // Mobile has no room for a bell + dropdown the way the navbar does, and
  // a sixth bottom-nav item would crowd an already-tight bar -- so
  // notifications surface here as a dot on the existing Account item
  // instead of a dedicated tab. Full list lives at /notifications
  // (reachable from the desktop bell, and from Account -> the same page
  // once there's a link for it) -- polled rather than realtime since
  // this bar mounts on every route and a subscription per page would be
  // wasteful for a badge that only needs to be roughly current.
  const [hasUnread, setHasUnread] = useState(false);
  const [waitingReplies, setWaitingReplies] = useState(0);
  useEffect(() => {
    if (!user) { setHasUnread(false); setWaitingReplies(0); return; }
    let cancelled = false;
    const check = () => {
      getUnreadNotificationCount().then(c => { if (!cancelled) setHasUnread(c > 0); }).catch(() => {});
      getWaitingReplyCount().then(c => { if (!cancelled) setWaitingReplies(c); }).catch(() => {});
    };
    check();
    const interval = setInterval(check, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user, pathname]);

  // Hide on full-screen pages that have their own UI
  if (
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/chat/') ||
    pathname.startsWith('/live/studio') ||
    pathname.startsWith('/live/')
  ) {
    return null;
  }

  type NavItem = {
    href: string;
    label: string;
    icon: React.ElementType;
    isActive: boolean;
    isLive?: boolean;
    showDot?: boolean;
    badge?: number;
  };

  const navItems: NavItem[] = [
    {
      href: '/',
      label: isRTL ? 'الرئيسية' : 'Home',
      icon: Home,
      isActive: pathname === '/',
    },
    {
      href: '/live',
      label: isRTL ? 'بث مباشر' : 'Live',
      icon: Video,
      isActive: pathname === '/live',
      isLive: true,
    },
    // Orders only exist when payments are on; in classifieds mode the slot
    // goes to Messages, the thing buyers and sellers actually use.
    PAYMENTS_ENABLED
      ? {
          href: user ? '/orders' : '/login?redirect=/orders',
          label: isRTL ? 'الطلبات' : 'Orders',
          icon: Package,
          isActive: pathname.startsWith('/orders'),
        }
      : {
          href: user ? '/profile?tab=chats' : '/login?redirect=/profile',
          label: isRTL ? 'الدردشات' : 'Chats',
          icon: MessageCircle,
          isActive: pathname === '/profile' && searchParams.get('tab') === 'chats',
          badge: waitingReplies,
        },
    {
      href: user ? '/profile' : '/login?redirect=/profile',
      label: isRTL ? 'حسابي' : 'Account',
      icon: User,
      isActive: (pathname.startsWith('/profile') && searchParams.get('tab') !== 'chats') || pathname.startsWith('/settings') || pathname.startsWith('/saved') || (PAYMENTS_ENABLED && pathname.startsWith('/wallet')),
      showDot: hasUnread,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/98 backdrop-blur-2xl border-t border-slate-200 px-1 py-1 shadow-[0_-6px_20px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item, idx) => {
          const Icon = item.icon;
          return (
            <Link
              key={idx}
              href={item.href}
              className="flex flex-col items-center justify-center min-h-12 min-w-16 px-2 rounded-xl transition-all"
            >
              <div
                className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
                  item.isActive
                    ? item.isLive
                      ? 'bg-red-50 text-red-600'
                      : 'text-slate-900'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 transition-transform ${item.isActive ? 'scale-110' : ''}`} />
                  {/* Pulsing red dot for Live */}
                  {item.isLive && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-600 rounded-full border border-white animate-pulse" />
                  )}
                  {/* Unread notifications dot on Account */}
                  {item.showDot && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-danger rounded-full border border-white" />
                  )}
                  {!!item.badge && (
                    <span className="absolute -top-2 -right-3 min-w-4 h-4 px-0.5 bg-danger text-white text-[10px] font-black rounded-full flex items-center justify-center border border-white">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[11px] font-bold whitespace-nowrap ${item.isLive ? 'text-red-600' : ''}`}>
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
