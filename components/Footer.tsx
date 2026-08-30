'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, Truck, Lock, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

export default function Footer() {
  const { isRTL, t } = useLanguage();

  return (
    <footer className="mt-16 text-slate-400" style={{ background: '#0F172A' }}>

      {/* ─── Top Accent Gradient ─── */}
      <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #3665F3 0%, #7C3AED 50%, #EC4899 100%)' }} />

      {/* ─── Trust Badges Ribbon ─── */}
      <div className="border-b border-white/5 py-8" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left">
          <div className="flex items-center gap-4 justify-center sm:justify-start">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 border" style={{ background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.25)' }}>
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">
                {isRTL ? 'حماية الضمان المالي 100%' : '100% Escrow Protection'}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isRTL ? 'أموالك محفوظة بأمان حتى فحص واستلام المنتج' : 'Funds held safely until order inspection'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 justify-center sm:justify-start">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 border" style={{ background: 'rgba(54,101,243,0.12)', borderColor: 'rgba(54,101,243,0.25)' }}>
              <Truck className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">
                {isRTL ? 'شحن سريع لباب البيت' : 'Doorstep Courier Delivery'}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isRTL ? 'تغطية لجميع المحافظات مع بوسطة وتسليم يدوي' : 'Nationwide coverage with Bosta & QR Meetups'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 justify-center sm:justify-start">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 border" style={{ background: 'rgba(124,58,237,0.12)', borderColor: 'rgba(124,58,237,0.25)' }}>
              <Lock className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">
                {isRTL ? 'بائعون موثقون وسحب فوري' : 'Verified Sellers & Payouts'}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isRTL ? 'توثيق بطاقة الرقم القومي + تحويلات إنستاباي وفودافون كاش' : 'Egyptian National ID KYC + InstaPay payouts'}
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
              <div className="h-8 relative flex items-center">
                <Image
                  src="/egbay.svg"
                  alt="egbay"
                  width={100}
                  height={32}
                  className="h-8 w-auto object-contain brightness-200"
                  unoptimized
                />
              </div>
            </Link>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm mb-5">
              {isRTL
                ? 'السوق المصري الحديث للبيع والشراء المباشر. إلكترونيات، أزياء، سيارات، ومقتنيات مع حماية كاملة للمدفوعات عبر نظام الضمان.'
                : "Egypt's modern peer-to-peer marketplace. Buy, sell, and trade electronics, fashion, vehicles, and collectibles with total escrow peace of mind."}
            </p>

            {/* Sell CTA */}
            <Link
              href="/sell"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #3665F3 0%, #7C3AED 100%)' }}
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
              <li><Link href="/sell" className="text-[#3665F3] hover:text-blue-400 transition-colors font-semibold">{isRTL ? 'إضافة إعلان' : 'List an Item'}</Link></li>
              <li><Link href="/orders" className="hover:text-white transition-colors">{isRTL ? 'طلباتي والضمان' : 'My Escrow Orders'}</Link></li>
              <li><Link href="/wallet" className="hover:text-white transition-colors">{isRTL ? 'المحفظة والسحب' : 'Wallet & Payouts'}</Link></li>
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
        <div className="flex flex-wrap items-center gap-2 mb-8 pb-8 border-b border-white/5">
          <span className="text-[11px] font-semibold text-slate-500">{isRTL ? 'طرق الدفع والسحب:' : 'Payouts & Payments:'}</span>
          {['InstaPay', 'Vodafone Cash', 'Bank Transfer'].map((m) => (
            <span key={m} className="text-[10px] font-bold text-slate-400 border border-white/10 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
              {m}
            </span>
          ))}
        </div>

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

        {/* ─── Disclaimer ─── */}
        <div className="mt-5 text-[10px] text-slate-700 text-center leading-relaxed">
          {isRTL
            ? 'إيجي باي (egbay.shop) هي منصة تجارة إلكترونية مصرية مستقلة تعمل داخل جمهورية مصر العربية ولا تتبع أي جهات تجارية خارجية.'
            : 'EgyBay (egbay.shop) is an independent peer-to-peer marketplace operating in Egypt. EgyBay is not affiliated with, endorsed by, or sponsored by eBay Inc. or any international entities.'}
        </div>
      </div>
    </footer>
  );
}
