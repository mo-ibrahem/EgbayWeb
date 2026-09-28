'use client';

import React from 'react';
import Link from 'next/link';
import { MessageCircle, MapPin, ShieldCheck, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { PAYMENTS_ENABLED } from '@/lib/platformCommerce';

export default function Footer() {
  const { isRTL, t } = useLanguage();

  return (
    <footer className="mt-16 text-slate-400" style={{ background: '#0F172A' }}>

      {/* ─── Top accent ─── */}
      <div className="h-0.5 w-full bg-brand" />

      {/* ─── Trust Badges Ribbon ─── */}
      <div className="border-b border-white/5 py-8" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left">
          <div className="flex items-center gap-4 justify-center sm:justify-start">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 border" style={{ background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.25)' }}>
              <MessageCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">
                {isRTL ? 'تكلم مع البائع قبل ما تشتري' : 'Chat Before You Buy'}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isRTL ? 'اسأل واتفق على التفاصيل مباشرة مع البائع' : 'Ask questions and agree the details with the seller'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 justify-center sm:justify-start">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 border" style={{ background: 'rgba(37,99,235,0.12)', borderColor: 'rgba(37,99,235,0.25)' }}>
              <MapPin className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">
                {isRTL ? 'قابل البائع بنفسك' : 'Meet in Person'}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isRTL ? 'اتفقوا على مكان عام وافحص المنتج قبل ما تدفع' : 'Agree a public place and inspect the item before you pay'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 justify-center sm:justify-start">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 border" style={{ background: 'rgba(124,58,237,0.12)', borderColor: 'rgba(124,58,237,0.25)' }}>
              <ShieldCheck className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">
                {isRTL ? 'توثيق اختياري للبائعين' : 'Optional Seller ID Verification'}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isRTL ? 'يمكن للبائعين توثيق هويتهم ببطاقة الرقم القومي' : 'Sellers can verify their identity with an Egyptian National ID'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Footer Links ─── */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand Column */}
          <div className="col-span-2">
            <Link href="/" className="inline-block mb-4">
              <div className="h-9 relative flex items-center">
                <span role="img" aria-label="Egbay" className="egbay-logo h-9 w-[108px] text-white" />
              </div>
            </Link>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm mb-5">
              {isRTL
                ? 'سوق مصري للبيع والشراء. إلكترونيات، أزياء، سيارات، ومقتنيات جديدة ومستعملة. تكلم مع البائع وقابله.'
                : "Egypt's marketplace for new, used and refurbished items. Chat with sellers, make an offer, and meet in person."}
            </p>

            {/* Sell CTA */}
            <Link
              href="/sell"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-bold text-white bg-brand hover:bg-brand-dark transition-colors"
            >
              {isRTL ? 'بيع منتجك الآن' : 'Start Selling Today'}
              <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
            </Link>
          </div>

          {/* Marketplace Navigation */}
          <div>
            <h4 className="font-bold text-xs text-slate-300 uppercase tracking-wider mb-4">
              {isRTL ? 'السوق' : 'Marketplace'}
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li><Link href="/" className="hover:text-white transition-colors">{isRTL ? 'جميع الأقسام' : 'All Categories'}</Link></li>
              <li><Link href="/?category=Electronics" className="hover:text-white transition-colors">{isRTL ? 'إلكترونيات' : 'Electronics'}</Link></li>
              <li><Link href="/?category=Fashion" className="hover:text-white transition-colors">{isRTL ? 'أزياء وكوتشيات' : 'Fashion & Sneakers'}</Link></li>
              <li><Link href="/?category=Home" className="hover:text-white transition-colors">{isRTL ? 'أثاث ومنزل' : 'Home & Living'}</Link></li>
              <li><Link href="/?category=Automotive" className="hover:text-white transition-colors">{isRTL ? 'سيارات ومركبات' : 'Motors & Vehicles'}</Link></li>
            </ul>
          </div>

          {/* Account & Selling */}
          <div>
            <h4 className="font-bold text-xs text-slate-300 uppercase tracking-wider mb-4">
              {isRTL ? 'البيع والشراء' : 'Buy & Sell'}
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li><Link href="/sell" className="text-brand hover:text-blue-400 transition-colors font-semibold">{isRTL ? 'إضافة إعلان' : 'List an Item'}</Link></li>
              {PAYMENTS_ENABLED && (
                <>
                  <li><Link href="/orders" className="hover:text-white transition-colors">{isRTL ? 'طلباتي' : 'My Orders'}</Link></li>
                  <li><Link href="/wallet" className="hover:text-white transition-colors">{isRTL ? 'المحفظة والسحب' : 'Wallet & Payouts'}</Link></li>
                </>
              )}
              <li><Link href="/seller-verification" className="hover:text-white transition-colors">{isRTL ? 'توثيق البائع' : 'Seller Verification'}</Link></li>
              <li><Link href="/profile" className="hover:text-white transition-colors">{isRTL ? 'الملف الشخصي' : 'User Profile'}</Link></li>
            </ul>
          </div>

          {/* Legal & Trust */}
          <div>
            <h4 className="font-bold text-xs text-slate-300 uppercase tracking-wider mb-4">
              {isRTL ? 'الأمان والشروط' : 'Trust & Policies'}
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li><Link href="/privacy" className="hover:text-white transition-colors">{isRTL ? 'سياسة الخصوصية' : 'Privacy Policy'}</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">{isRTL ? 'شروط الخدمة' : 'Terms of Service'}</Link></li>
              <li>
                <a href="mailto:info@egbay.shop" className="hover:text-white transition-colors">
                  {isRTL ? 'الدعم الفني' : 'Contact Support'}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* ─── Payout Methods ─── */}
        {PAYMENTS_ENABLED && (
        <div className="flex flex-wrap items-center gap-2 mb-8 pb-8 border-b border-white/5">
          <span className="text-[11px] font-semibold text-slate-500">{isRTL ? 'طرق الدفع والسحب:' : 'Payouts & Payments:'}</span>
          {['InstaPay', 'Vodafone Cash', 'Bank Transfer'].map((m) => (
            <span key={m} className="text-[10px] font-bold text-slate-400 border border-white/10 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
              {m}
            </span>
          ))}
        </div>
        )}

        {/* ─── Bottom Bar ─── */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-600">
          <p>© 2026 egbay.shop — {isRTL ? 'جميع الحقوق محفوظة' : 'All rights reserved.'}</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-slate-400 transition-colors">{isRTL ? 'الخصوصية' : 'Privacy'}</Link>
            <span className="text-white/10">•</span>
            <Link href="/terms" className="hover:text-slate-400 transition-colors">{isRTL ? 'الشروط' : 'Terms'}</Link>
            <span className="text-white/10">•</span>
            <a href="mailto:info@egbay.shop" className="hover:text-slate-400 transition-colors">{isRTL ? 'المساعدة' : 'Help'}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
