'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Video, Plus, Package, User } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { isRTL } = useLanguage();

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
    isPrimary?: boolean;
    isActive: boolean;
    isLive?: boolean;
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
    {
      href: user ? '/sell' : '/login?redirect=/sell',
      label: isRTL ? 'بيع' : 'Sell',
      icon: Plus,
      isPrimary: true,
      isActive: pathname === '/sell',
    },
    {
      href: user ? '/orders' : '/login?redirect=/orders',
      label: isRTL ? 'الطلبات' : 'Orders',
      icon: Package,
      isActive: pathname.startsWith('/orders'),
    },
    {
      href: user ? '/profile' : '/login?redirect=/profile',
      label: isRTL ? 'حسابي' : 'Account',
      icon: User,
      isActive: pathname.startsWith('/profile') || pathname.startsWith('/wallet'),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/97 backdrop-blur-2xl border-t border-gray-100 px-1 py-2 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item, idx) => {
          const Icon = item.icon;

          if (item.isPrimary) {
            return (
              <Link
                key={idx}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-6 group"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#3665F3] to-[#5B3DDB] text-white flex items-center justify-center shadow-xl shadow-blue-500/35 group-active:scale-90 transition-transform border-[3px] border-white">
                  <Plus className="w-6 h-6 stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-black text-[#3665F3] mt-1">
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={idx}
              href={item.href}
              className="flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all"
            >
              <div
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                  item.isActive
                    ? item.isLive
                      ? 'bg-red-50 text-red-600'
                      : 'bg-blue-50 text-[#3665F3]'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 transition-transform ${item.isActive ? 'scale-110' : ''}`} />
                  {/* Pulsing red dot for Live */}
                  {item.isLive && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-600 rounded-full border border-white animate-pulse" />
                  )}
                </div>
                <span className={`text-[9.5px] font-${item.isActive ? 'black' : 'medium'} whitespace-nowrap ${item.isLive ? 'text-red-600' : ''}`}>
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
