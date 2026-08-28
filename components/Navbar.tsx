'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Search, Plus, User, LogOut, Wallet, Package,
  Menu, X, Heart, MessageCircle, ChevronDown, ShieldCheck,
  Tag, LayoutGrid, Smartphone, Shirt, Home, Baby,
  Dumbbell, BookOpen, Car, Sparkles, HelpCircle, Bell
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

export const CATEGORIES_NAV = [
  { id: '',            label: 'All Categories' },
  { id: 'Electronics', label: 'Electronics' },
  { id: 'Fashion',     label: 'Fashion & Apparel' },
  { id: 'Home',        label: 'Home & Living' },
  { id: 'Toys',        label: 'Toys & Hobbies' },
  { id: 'Sports',      label: 'Sports & Outdoors' },
  { id: 'Books',       label: 'Books & Media' },
  { id: 'Automotive',  label: 'Motors & Vehicles' },
] as const;

export default function Navbar() {
  const { user, loading, signOut } = useAuth();
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
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      {/* ─── Ultra-clean Top Utility Bar ─── */}
      <div className="bg-gray-50/80 border-b border-gray-100 text-gray-500 text-[11px] font-medium">
        <div className="max-w-7xl mx-auto px-4 h-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              100% Escrow Protected Marketplace
            </span>
            <span className="hidden sm:inline text-gray-300">|</span>
            <span className="hidden sm:inline text-gray-500">
              Courier Delivery across Egypt & In-Person PIN Handover
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-gray-900 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-gray-900 transition-colors">
              Terms
            </Link>
            <a href="mailto:support@egbay.market" className="hover:text-gray-900 transition-colors hidden sm:inline">
              Support
            </a>
          </div>
        </div>
      </div>

      {/* ─── Main Header Bar ─── */}
      <div className="max-w-7xl mx-auto px-4 h-18 py-3 flex items-center justify-between gap-4 md:gap-8">
        {/* Official egbay Vector Logo */}
        <Link href="/" className="flex items-center flex-shrink-0 group">
          <div className="h-9 relative flex items-center">
            <Image
              src="/egbay.svg"
              alt="egbay"
              width={112}
              height={36}
              className="h-8 w-auto object-contain group-hover:opacity-90 transition-opacity"
              unoptimized
              priority
            />
          </div>
        </Link>

        {/* Modern Search Bar */}
        <form onSubmit={handleSearch} className="flex-1 max-w-2xl hidden md:flex items-center">
          <div className="flex w-full items-center bg-gray-50 border border-gray-300 hover:border-gray-400 focus-within:border-blue-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 rounded-full overflow-hidden transition-all shadow-inner">
            <div className="pl-4 text-gray-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search for anything (iPhone, Jordan sneakers, laptops, furniture...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2.5 text-xs text-gray-900 placeholder-gray-400 bg-transparent outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="pr-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#3665F3] hover:bg-[#2B54D4] text-white font-bold text-xs transition-colors rounded-r-full flex-shrink-0"
            >
              Search
            </button>
          </div>
        </form>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Post Listing CTA (Clean, authentic Pill button) */}
          <Link
            href={user ? '/sell' : '/login'}
            className="flex items-center gap-1.5 bg-[#3665F3] hover:bg-[#2B54D4] text-white text-xs font-bold px-4 py-2 rounded-full transition-all shadow-sm hover:shadow"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Sell</span>
          </Link>

          {!loading && (
            <>
              {user ? (
                <div className="flex items-center gap-1 sm:gap-2">
                  <Link
                    href="/profile?tab=wishlist"
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors hidden sm:flex"
                    title="Saved items"
                  >
                    <Heart className="w-5 h-5" />
                  </Link>

                  <Link
                    href="/orders"
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors hidden sm:flex"
                    title="My Orders"
                  >
                    <Package className="w-5 h-5" />
                  </Link>

                  <div className="relative" ref={profileRef}>
                    <button
                      onClick={() => setProfileOpen(!profileOpen)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-gray-900 p-1 rounded-full hover:bg-gray-100 transition-all border border-transparent hover:border-gray-200"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-black text-white shadow-sm">
                        {user.email?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {profileOpen && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 text-gray-800 animate-in fade-in zoom-in-95 duration-100">
                        <div className="px-4 py-2.5 border-b border-gray-100">
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Signed in</p>
                          <p className="text-xs font-bold text-gray-900 truncate mt-0.5">{user.email}</p>
                        </div>
                        <Link href="/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                          <User className="w-4 h-4 text-gray-400" /> My Profile & Listings
                        </Link>
                        <Link href="/wallet" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                          <Wallet className="w-4 h-4 text-blue-600" /> My Wallet & Payouts
                        </Link>
                        <Link href="/orders" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                          <Package className="w-4 h-4 text-indigo-600" /> Orders & Escrow Track
                        </Link>
                        <Link href="/profile?tab=wishlist" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                          <Heart className="w-4 h-4 text-rose-500" /> Saved Items
                        </Link>
                        <Link href="/profile?tab=chats" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                          <MessageCircle className="w-4 h-4 text-emerald-600" /> Messages
                        </Link>
                        <div className="border-t border-gray-100 mt-1 pt-1">
                          <button onClick={handleSignOut} className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors w-full text-left">
                            <LogOut className="w-4 h-4" /> Sign Out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href="/login" className="text-xs font-bold text-gray-700 hover:text-blue-600 px-3 py-2 rounded-full transition-colors">
                    Sign in
                  </Link>
                  <span className="text-gray-300">or</span>
                  <Link href="/signup" className="text-xs font-bold text-blue-600 hover:underline px-1 py-2">
                    Register
                  </Link>
                </div>
              )}
            </>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-gray-700 p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="md:hidden px-4 pb-3">
        <form onSubmit={handleSearch} className="flex rounded-full overflow-hidden border border-gray-300 bg-gray-50">
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 text-xs bg-transparent text-gray-900 placeholder-gray-400 outline-none"
          />
          <button type="submit" className="px-4 bg-[#3665F3] text-white">
            <Search className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* ─── Clean Sub-Header Categories Rail (eBay 2026 Style) ─── */}
      <div className="border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-2.5 text-xs">
            {CATEGORIES_NAV.map((cat) => {
              const isSelected = activeCategory === cat.id || (!activeCategory && cat.id === '');

              return (
                <Link
                  key={cat.id || 'all'}
                  href={cat.id ? `/?category=${encodeURIComponent(cat.id)}` : '/'}
                  className={`flex-shrink-0 font-semibold transition-colors pb-0.5 border-b-2 whitespace-nowrap ${
                    isSelected
                      ? 'text-[#3665F3] border-[#3665F3]'
                      : 'text-gray-600 hover:text-gray-900 border-transparent hover:border-gray-300'
                  }`}
                >
                  {cat.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 shadow-2xl p-4 space-y-2 text-gray-800">
          <Link
            href={user ? '/sell' : '/login'}
            onClick={() => setMenuOpen(false)}
            className="flex items-center justify-center gap-2 bg-[#3665F3] text-white rounded-xl px-4 py-3 font-bold text-xs shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" /> List an Item for Sale
          </Link>

          {user ? (
            <>
              <Link href="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-50 text-xs font-semibold">
                <User className="w-4 h-4 text-gray-400" /> My Profile & Listings
              </Link>
              <Link href="/wallet" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-50 text-xs font-semibold">
                <Wallet className="w-4 h-4 text-blue-600" /> Wallet & Payouts
              </Link>
              <Link href="/orders" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-50 text-xs font-semibold">
                <Package className="w-4 h-4 text-indigo-600" /> My Escrow Orders
              </Link>
              <button onClick={() => { handleSignOut(); setMenuOpen(false); }} className="flex items-center gap-3 text-rose-600 px-4 py-2.5 rounded-xl hover:bg-rose-50 text-xs font-bold w-full text-left">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-50 text-xs font-semibold">
                Sign In
              </Link>
              <Link href="/signup" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-50 text-xs font-semibold">
                Register New Account
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
