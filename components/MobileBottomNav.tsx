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
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-lg border-t border-gray-200/80 px-2 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item, idx) => {
          const Icon = item.icon;

          if (item.isPrimary) {
            return (
              <Link
                key={idx}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-5 group"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#3665F3] to-[#254fd1] text-white flex items-center justify-center shadow-lg shadow-blue-500/30 group-active:scale-95 transition-transform border-2 border-white">
                  <Plus className="w-6 h-6 stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-black text-[#3665F3] mt-0.5">
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={idx}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                item.isActive
                  ? item.isLive ? 'text-red-600 font-bold' : 'text-[#3665F3] font-bold'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${item.isActive ? 'scale-110' : ''}`} />
                {/* Pulsing red dot for Live tab always */}
                {item.isLive && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-600 rounded-full border border-white animate-pulse" />
                )}
                {/* Active dot for non-live tabs */}
                {item.isActive && !item.isLive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#3665F3] rounded-full" />
                )}
              </div>
              <span className={`text-[10px] mt-1 ${item.isActive ? 'font-black' : 'font-medium'} ${item.isLive ? 'text-red-600' : ''}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
