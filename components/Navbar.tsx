'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Search, Plus, User, LogOut, Wallet, Package,
  Menu, X, Heart, MessageCircle, ChevronDown, Globe, Video,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';

export const CATEGORIES_NAV = [
  { id: '',            key: 'all',        defaultLabel: 'All Categories' },
  { id: 'Electronics', key: 'electronics',defaultLabel: 'Electronics' },
  { id: 'Fashion',     key: 'fashion',    defaultLabel: 'Fashion & Apparel' },
  { id: 'Home',        key: 'home',       defaultLabel: 'Home & Living' },
  { id: 'Toys',        key: 'toys',       defaultLabel: 'Toys & Hobbies' },
  { id: 'Sports',      key: 'sports',     defaultLabel: 'Sports & Outdoors' },
  { id: 'Books',       key: 'books',      defaultLabel: 'Books & Media' },
  { id: 'Automotive',  key: 'automotive', defaultLabel: 'Motors & Vehicles' },
] as const;

export default function Navbar() {
  const { user, loading, signOut } = useAuth();
  const { language, toggleLanguage, t, isRTL } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const activeCategory = searchParams.get('category') || '';

  useEffect(() => {
    setSearchQuery(searchParams.get('search') || '');
  }, [searchParams]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(searchQuery.trim() ? `/?search=${encodeURIComponent(searchQuery.trim())}` : '/');
    setMenuOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setProfileOpen(false);
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
      {/* ─── Main header row: logo, search, actions ─── */}
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3 md:gap-6">
        <Link href="/" className="flex items-center flex-shrink-0">
          <Image src="/egbay.svg" alt="egbay" width={104} height={32} className="h-7 w-auto object-contain" unoptimized priority />
        </Link>

        <form onSubmit={handleSearch} className="flex-1 max-w-2xl hidden md:flex items-center">
          <div className="flex w-full items-center bg-slate-50 border border-slate-200 hover:border-slate-300 focus-within:border-brand focus-within:bg-white focus-within:ring-2 focus-within:ring-brand/15 rounded-md overflow-hidden transition-colors">
            <Search className="w-4 h-4 text-slate-400 ml-3.5 rtl:mr-3.5 rtl:ml-0 flex-shrink-0" />
            <input
              type="text"
              placeholder={isRTL ? 'ابحث عن آيفون، كوتشيات، لابتوبات...' : 'Search for iPhone, Jordans, laptops...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 bg-transparent outline-none"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} className="pr-2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button type="submit" className="m-1 px-5 py-2 bg-brand hover:bg-brand-dark text-white font-bold text-sm rounded-md transition-colors flex-shrink-0">
              {isRTL ? 'بحث' : 'Search'}
            </button>
          </div>
        </form>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors"
            title={language === 'en' ? 'التحويل إلى اللغة العربية' : 'Switch to English'}
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{language === 'en' ? 'العربية' : 'English'}</span>
          </button>

          <Link
            href={user ? '/sell' : '/login'}
            className="hidden md:flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white text-xs font-bold px-4 py-2 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            {isRTL ? 'بيع' : 'Sell'}
          </Link>

          {!loading && (
            user ? (
              <div className="flex items-center gap-0.5 sm:gap-1">
                <Link href="/profile?tab=wishlist" className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors hidden sm:flex" title={isRTL ? 'المفضلة' : 'Saved items'}>
                  <Heart className="w-5 h-5" />
                </Link>
                <Link href="/orders" className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors hidden sm:flex" title={isRTL ? 'طلباتي' : 'My Orders'}>
                  <Package className="w-5 h-5" />
                </Link>

                <div className="relative" ref={profileRef}>
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-1 p-0.5 sm:p-1 rounded-md hover:bg-slate-100 transition-colors"
                  >
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-brand flex items-center justify-center text-xs font-black text-white">
                      {user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {profileOpen && (
                    <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} top-full mt-2 w-56 bg-white rounded-md shadow-card-lg border border-slate-200 py-2 z-50 text-slate-800`}>
                      <div className="px-4 py-2.5 border-b border-slate-100">
                        <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">{isRTL ? 'تم تسجيل الدخول' : 'Signed in'}</p>
                        <p className="text-xs font-bold text-slate-900 truncate mt-0.5">{user.email}</p>
                      </div>
                      <Link href="/live/book" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors">
                        <Video className="w-4 h-4" /> {isRTL ? 'بدء بث مباشر' : 'Go Live Studio'}
                      </Link>
                      <Link href="/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                        <User className="w-4 h-4 text-slate-400" /> {isRTL ? 'الملف الشخصي وإعلاناتي' : 'My Profile & Listings'}
                      </Link>
                      <Link href="/wallet" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                        <Wallet className="w-4 h-4 text-slate-400" /> {isRTL ? 'المحفظة والأرباح' : 'My Wallet & Payouts'}
                      </Link>
                      <Link href="/orders" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                        <Package className="w-4 h-4 text-slate-400" /> {isRTL ? 'الطلبات وتتبع الضمان' : 'Orders & Escrow Track'}
                      </Link>
                      <Link href="/profile?tab=wishlist" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                        <Heart className="w-4 h-4 text-slate-400" /> {isRTL ? 'الإعلانات المحفوظة' : 'Saved Items'}
                      </Link>
                      <Link href="/profile?tab=chats" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                        <MessageCircle className="w-4 h-4 text-slate-400" /> {isRTL ? 'الرسائل' : 'Messages'}
                      </Link>
                      <div className="border-t border-slate-100 mt-1 pt-1">
                        <button onClick={handleSignOut} className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-danger hover:bg-danger-soft transition-colors w-full text-left">
                          <LogOut className="w-4 h-4" /> {isRTL ? 'تسجيل الخروج' : 'Sign Out'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Link href="/login" className="text-xs font-bold text-slate-700 hover:text-brand px-2.5 sm:px-3 py-1.5 rounded-md transition-colors">
                  {isRTL ? 'دخول' : 'Sign in'}
                </Link>
                <Link href="/signup" className="hidden sm:inline-block text-xs font-bold text-slate-700 hover:text-brand border border-slate-300 hover:border-slate-400 px-3.5 py-1.5 rounded-md transition-colors">
                  {isRTL ? 'حساب جديد' : 'Register'}
                </Link>
              </div>
            )
          )}

          <button onClick={() => setMenuOpen(!menuOpen)} className="p-1.5 text-slate-600 hover:text-slate-900 rounded-md md:hidden">
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ─── Mobile search (always visible) ─── */}
      <div className="md:hidden px-4 pb-3">
        <form onSubmit={handleSearch} className="flex items-center">
          <div className="flex w-full items-center bg-slate-50 border border-slate-200 focus-within:border-brand focus-within:bg-white focus-within:ring-2 focus-within:ring-brand/15 rounded-md overflow-hidden transition-colors">
            <Search className="w-3.5 h-3.5 text-slate-400 ml-3 rtl:mr-3 rtl:ml-0 flex-shrink-0" />
            <input
              type="text"
              placeholder={isRTL ? 'ابحث عن آيفون، كوتشيات...' : 'Search iPhone, Jordans...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2 py-2.5 text-sm text-slate-900 placeholder-slate-400 bg-transparent outline-none"
            />
            <button type="submit" className="m-1 px-4 py-1.5 bg-brand text-white font-bold text-xs rounded-md flex-shrink-0">
              {isRTL ? 'بحث' : 'Go'}
            </button>
          </div>
        </form>
      </div>

      {/* ─── Category row (desktop) ─── */}
      <div className="border-t border-slate-100 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 overflow-x-auto no-scrollbar h-10">
          <Link
            href="/live"
            className="flex items-center gap-1.5 px-3 h-7 rounded-md bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs transition-colors mr-2 rtl:ml-2 rtl:mr-0 flex-shrink-0"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
            <Video className="w-3.5 h-3.5" />
            {isRTL ? 'بث مباشر' : 'Egbay Live'}
          </Link>
          <span className="w-px h-4 bg-slate-200 mx-1 flex-shrink-0" />
          {CATEGORIES_NAV.map((cat) => {
            const isActive = cat.id === '' ? !activeCategory : activeCategory === cat.id;
            return (
              <Link
                key={cat.id}
                href={cat.id ? `/?category=${encodeURIComponent(cat.id)}` : '/'}
                className={`px-3 h-7 flex items-center text-xs font-semibold whitespace-nowrap rounded-md transition-colors ${
                  isActive ? 'bg-brand-soft text-brand-dark font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {t(`categories.${cat.key}`, cat.defaultLabel)}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ─── Mobile dropdown menu ─── */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 px-4 py-4 space-y-4">
          <div className="flex items-center justify-between py-2 border-y border-slate-100">
            <span className="text-xs font-bold text-slate-700">{isRTL ? 'اللغة' : 'Language'}</span>
            <button onClick={toggleLanguage} className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-brand-soft text-brand-dark font-bold text-xs">
              <Globe className="w-3.5 h-3.5" />
              {language === 'en' ? 'العربية' : 'English'}
            </button>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase font-bold tracking-wide text-slate-400 mb-2">{isRTL ? 'الأقسام' : 'Categories'}</p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES_NAV.map((cat) => (
                <Link
                  key={cat.id}
                  href={cat.id ? `/?category=${encodeURIComponent(cat.id)}` : '/'}
                  onClick={() => setMenuOpen(false)}
                  className={`text-xs py-2 px-3 rounded-md font-medium ${
                    (cat.id === '' ? !activeCategory : activeCategory === cat.id) ? 'bg-brand-soft text-brand-dark font-bold' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {t(`categories.${cat.key}`, cat.defaultLabel)}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
