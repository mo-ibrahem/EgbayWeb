'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Search, Plus, User, LogOut, Wallet, Package,
  Menu, X, Heart, MessageCircle, ChevronDown, ShieldCheck,
  Globe, Video, Dot
} from 'lucide-react';

// Tiny colored dot for category pills
const CAT_COLORS: Record<string, string> = {
  '':           '#6366F1',
  'Electronics':'#0EA5E9',
  'Fashion':    '#EC4899',
  'Home':       '#10B981',
  'Toys':       '#F59E0B',
  'Sports':     '#EF4444',
  'Books':      '#8B5CF6',
  'Automotive': '#64748B',
};
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
    if (searchQuery.trim()) {
      router.push(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setProfileOpen(false);
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-gray-200/80 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
      {/* ─── Gradient accent stripe ─── */}
      <div className="navbar-accent-stripe" />
      {/* ─── Ultra-clean Top Utility Bar (Desktop only, saves mobile space) ─── */}
      <div className="bg-gray-50/80 border-b border-gray-100 text-gray-500 text-[11px] font-medium hidden md:block">
        <div className="max-w-7xl mx-auto px-4 h-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              {isRTL ? 'سوق مصري محمي بنظام الضمان المالي 100%' : '100% Escrow Protected Egyptian Marketplace'}
            </span>
            <span className="hidden sm:inline text-gray-300">|</span>
            <span className="hidden sm:inline text-gray-500">
              {isRTL ? 'توصيل لباب البيت أو تسليم يدوي بكود PIN' : 'Courier Delivery across Egypt & In-Person PIN Handover'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Language Switcher Pill */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-[11px] transition-colors"
              title={language === 'en' ? 'التحويل إلى اللغة العربية' : 'Switch to English'}
            >
              <Globe className="w-3 h-3 text-[#3665F3]" />
              <span>{language === 'en' ? 'العربية' : 'English'}</span>
            </button>

            <Link href="/privacy" className="hover:text-gray-900 transition-colors hidden md:inline">
              {isRTL ? 'سياسة الخصوصية' : 'Privacy Policy'}
            </Link>
            <Link href="/terms" className="hover:text-gray-900 transition-colors hidden md:inline">
              {isRTL ? 'الشروط والأحكام' : 'Terms'}
            </Link>
            <a href="mailto:info@egbay.shop" className="hover:text-gray-900 transition-colors hidden sm:inline">
              {isRTL ? 'المساعدة' : 'Support'}
            </a>
          </div>
        </div>
      </div>

      {/* ─── Main Header Bar ─── */}
      <div className="max-w-7xl mx-auto px-4 h-16 sm:h-18 py-2 sm:py-3 flex items-center justify-between gap-3 md:gap-8">
        {/* Official egbay Vector Logo */}
        <Link href="/" className="flex items-center flex-shrink-0 group">
          <div className="h-8 sm:h-9 relative flex items-center">
            <Image
              src="/egbay.svg"
              alt="egbay"
              width={104}
              height={32}
              className="h-7 sm:h-8 w-auto object-contain group-hover:opacity-90 transition-opacity"
              unoptimized
              priority
            />
          </div>
        </Link>

        {/* Modern Search Bar (Desktop) */}
        <form onSubmit={handleSearch} className="flex-1 max-w-2xl hidden md:flex items-center">
          <div className="flex w-full items-center bg-slate-50 border-2 border-slate-200 hover:border-slate-300 focus-within:border-[#3665F3] focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100/70 rounded-full overflow-hidden transition-all duration-200 shadow-sm">
            <div className="pl-4 pr-2 text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder={isRTL ? 'ابحث عن أي شيء (آيفون، كوتشيات، لابتوبات، موبايلات...)' : 'Search for anything (iPhone, Jordans, laptops, furniture...)'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2 py-2.5 text-sm text-slate-900 placeholder-slate-400 bg-transparent outline-none font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="pr-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="submit"
              className="m-1 px-6 py-2 bg-[#3665F3] hover:bg-[#2B54D4] active:bg-[#1E44C4] text-white font-bold text-sm transition-all rounded-full flex-shrink-0 shadow-sm hover:shadow-md"
            >
              {isRTL ? 'بحث' : 'Search'}
            </button>
          </div>
        </form>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Language Toggle in Top Navbar for Mobile */}
          <button
            onClick={toggleLanguage}
            className="md:hidden flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-bold text-[11px]"
            title={language === 'en' ? 'التحويل إلى اللغة العربية' : 'Switch to English'}
          >
            <Globe className="w-3 h-3 text-[#3665F3]" />
            <span>{language === 'en' ? 'عربي' : 'EN'}</span>
          </button>

          {/* Post Listing CTA (Desktop Only — on mobile it's in bottom bar) */}
          <Link
            href={user ? '/sell' : '/login'}
            className="hidden md:flex items-center gap-1.5 bg-[#3665F3] hover:bg-[#2B54D4] text-white text-xs font-bold px-4 py-2 rounded-full transition-all shadow-sm hover:shadow"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{isRTL ? 'بيع إعلان' : 'Sell'}</span>
          </Link>

          {!loading && (
            <>
              {user ? (
                <div className="flex items-center gap-1 sm:gap-2">
                  <Link
                    href="/profile?tab=wishlist"
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors hidden sm:flex"
                    title={isRTL ? 'المفضلة' : 'Saved items'}
                  >
                    <Heart className="w-5 h-5" />
                  </Link>

                  <Link
                    href="/orders"
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors hidden sm:flex"
                    title={isRTL ? 'طلباتي والضمان' : 'My Orders'}
                  >
                    <Package className="w-5 h-5" />
                  </Link>

                  <div className="relative" ref={profileRef}>
                    <button
                      onClick={() => setProfileOpen(!profileOpen)}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-gray-900 p-0.5 sm:p-1 rounded-full hover:bg-gray-100 transition-all border border-transparent hover:border-gray-200"
                    >
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-black text-white shadow-sm">
                        {user.email?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {profileOpen && (
                      <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 text-gray-800 animate-in fade-in zoom-in-95 duration-100`}>
                        <div className="px-4 py-2.5 border-b border-gray-100">
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                            {isRTL ? 'تم تسجيل الدخول' : 'Signed in'}
                          </p>
                          <p className="text-xs font-bold text-gray-900 truncate mt-0.5">{user.email}</p>
                        </div>
                        <Link href="/live/book" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors">
                          <Video className="w-4 h-4 text-red-600" /> {isRTL ? 'بدء بث مباشر' : 'Go Live Studio'}
                        </Link>
                        <Link href="/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                          <User className="w-4 h-4 text-gray-400" /> {isRTL ? 'الملف الشخصي وإعلاناتي' : 'My Profile & Listings'}
                        </Link>
                        <Link href="/wallet" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                          <Wallet className="w-4 h-4 text-blue-600" /> {isRTL ? 'المحفظة والأرباح' : 'My Wallet & Payouts'}
                        </Link>
                        <Link href="/orders" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                          <Package className="w-4 h-4 text-indigo-600" /> {isRTL ? 'الطلبات وتتبع الضمان' : 'Orders & Escrow Track'}
                        </Link>
                        <Link href="/profile?tab=wishlist" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                          <Heart className="w-4 h-4 text-rose-500" /> {isRTL ? 'الإعلانات المحفوظة' : 'Saved Items'}
                        </Link>
                        <Link href="/profile?tab=chats" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                          <MessageCircle className="w-4 h-4 text-emerald-600" /> {isRTL ? 'الرسائل والمحادثات' : 'Messages'}
                        </Link>
                        <div className="border-t border-gray-100 mt-1 pt-1">
                          <button onClick={handleSignOut} className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors w-full text-left">
                            <LogOut className="w-4 h-4" /> {isRTL ? 'تسجيل الخروج' : 'Sign Out'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Link href="/login" className="text-xs font-bold text-gray-700 hover:text-blue-600 px-2.5 sm:px-3 py-1.5 rounded-full transition-colors">
                    {isRTL ? 'دخول' : 'Sign in'}
                  </Link>
                  <Link href="/signup" className="hidden sm:inline-block text-xs font-bold text-gray-700 hover:text-blue-600 border border-gray-300 hover:border-gray-400 px-3.5 py-1.5 rounded-full transition-all">
                    {isRTL ? 'حساب جديد' : 'Register'}
                  </Link>
                </div>
              )}
            </>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 text-gray-600 hover:text-gray-900 rounded-lg md:hidden"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ─── Mobile Dedicated Search Bar (Always visible on mobile) ─── */}
      <div className="md:hidden px-4 pb-3 pt-0.5">
        <form onSubmit={handleSearch} className="flex items-center">
          <div className="flex w-full items-center bg-slate-50 border-2 border-slate-200 focus-within:border-[#3665F3] focus-within:bg-white focus-within:ring-3 focus-within:ring-blue-100 rounded-full overflow-hidden transition-all duration-200 shadow-sm">
            <div className="pl-3.5 pr-1.5 text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              placeholder={isRTL ? 'ابحث عن آيفون، كوتشيات، لابتوبات...' : 'Search iPhone, Jordans, laptops...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-1 py-2.5 text-sm text-slate-900 placeholder-slate-400 bg-transparent outline-none font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="pr-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              type="submit"
              className="m-1 px-4 py-1.5 bg-[#3665F3] hover:bg-[#2B54D4] text-white font-bold text-xs transition-all rounded-full flex-shrink-0 shadow-sm"
            >
              {isRTL ? 'بحث' : 'Search'}
            </button>
          </div>
        </form>
      </div>

      {/* ─── Category Navigation Bar ─── */}
      <div className="border-t border-gray-100/80 bg-white/90 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-0.5 overflow-x-auto no-scrollbar py-0.5">
          {/* Live Channel Pill */}
          <Link
            href="/live"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs transition-all border border-red-200/80 mr-2 rtl:ml-2 rtl:mr-0 shadow-sm flex-shrink-0"
          >
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            <Video className="w-3.5 h-3.5" />
            <span>{isRTL ? 'بث مباشر' : 'EgyBay Live'}</span>
          </Link>

          <span className="w-px h-4 bg-gray-200 mx-1.5 flex-shrink-0" />
          {CATEGORIES_NAV.map((cat) => {
            const isActive = cat.id === '' ? !activeCategory : activeCategory === cat.id;
            const label = t(`categories.${cat.key}`, cat.defaultLabel);
            const dotColor = CAT_COLORS[cat.id] ?? '#6366F1';
            return (
              <Link
                key={cat.id}
                href={cat.id ? `/?category=${encodeURIComponent(cat.id)}` : '/'}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-all border-b-2 -mb-px rounded-t-sm ${
                  isActive
                    ? 'border-[#3665F3] text-[#3665F3] font-bold bg-blue-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all"
                  style={{ backgroundColor: isActive ? '#3665F3' : dotColor, opacity: isActive ? 1 : 0.65 }}
                />
                {label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ─── Mobile Dropdown Menu ─── */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <form onSubmit={handleSearch} className="flex items-center">
            <div className="flex w-full items-center bg-gray-50 border border-gray-300 rounded-full overflow-hidden">
              <Search className="w-4 h-4 ml-3 text-gray-400" />
              <input
                type="text"
                placeholder={isRTL ? 'ابحث عن أي منتج...' : 'Search items...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-transparent outline-none"
              />
              <button type="submit" className="px-4 py-2 bg-[#3665F3] text-white font-bold text-xs">
                {isRTL ? 'بحث' : 'Go'}
              </button>
            </div>
          </form>

          {/* Language Toggle in Mobile Menu */}
          <div className="flex items-center justify-between py-2 border-y border-gray-100">
            <span className="text-xs font-bold text-gray-700">{isRTL ? 'اللغة' : 'Language'}</span>
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{language === 'en' ? 'العربية 🇪🇬' : 'English 🌐'}</span>
            </button>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-2">
              {isRTL ? 'الأقسام' : 'Categories'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES_NAV.map((cat) => (
                <Link
                  key={cat.id}
                  href={cat.id ? `/?category=${encodeURIComponent(cat.id)}` : '/'}
                  onClick={() => setMenuOpen(false)}
                  className={`text-xs py-2 px-3 rounded-xl font-medium ${
                    (cat.id === '' ? !activeCategory : activeCategory === cat.id)
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-gray-700 hover:bg-gray-50'
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
