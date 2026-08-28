'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, Truck, Lock } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

export default function Footer() {
  const { isRTL, t } = useLanguage();

  return (
    <footer className="bg-white border-t border-gray-200 mt-16 text-gray-600">
      {/* ─── Trust Badges Ribbon ─── */}
      <div className="border-b border-gray-100 bg-gray-50/60 py-6">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left">
          <div className="flex items-center gap-3.5 justify-center sm:justify-start">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-900">
                {isRTL ? 'حماية الضمان المالي 100%' : '100% Escrow Protection'}
              </h4>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {isRTL ? 'أموالك محفوظة بأمان حتى فحص واستلام المنتج' : 'Funds held safely until order inspection'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 justify-center sm:justify-start">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 border border-blue-100">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-900">
                {isRTL ? 'شحن سريع لباب البيت' : 'Doorstep Courier Delivery'}
              </h4>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {isRTL ? 'تغطية لجميع المحافظات مع بوسطة وتسليم يدوي' : 'Nationwide coverage with Bosta & QR Meetups'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 justify-center sm:justify-start">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 border border-indigo-100">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-900">
                {isRTL ? 'بائعون موثقون وسحب فوري' : 'Verified Sellers & Payouts'}
              </h4>
              <p className="text-[11px] text-gray-500 mt-0.5">
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
            <Link href="/" className="inline-block mb-3.5">
              <div className="h-8 relative flex items-center">
                <Image
                  src="/egbay.svg"
                  alt="egbay"
                  width={100}
                  height={32}
                  className="h-8 w-auto object-contain"
                  unoptimized
                />
              </div>
            </Link>
            <p className="text-xs text-gray-500 leading-relaxed max-w-sm mb-4">
              {isRTL
                ? 'السوق المصري الحديث للبيع والشراء المباشر. إلكترونيات، أزياء، سيارات، ومقتنيات مع حماية كاملة للمدفوعات عبر نظام الضمان.'
                : 'Egypt\'s modern peer-to-peer marketplace. Buy, sell, and trade electronics, fashion, vehicles, and collectibles with total escrow peace of mind.'}
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="font-semibold text-gray-700">
                {isRTL ? 'طرق السحب المعتمدة:' : 'Supported Payouts:'}
              </span>
              <span>InstaPay • Vodafone Cash • Bank Transfer</span>
            </div>
          </div>

          {/* Marketplace Navigation */}
          <div>
            <h4 className="font-bold text-xs text-gray-900 uppercase tracking-wider mb-3.5">
              {isRTL ? 'السوق' : 'Marketplace'}
            </h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/" className="hover:text-blue-600 transition-colors">{isRTL ? 'جميع الأقسام' : 'All Categories'}</Link></li>
              <li><Link href="/?category=Electronics" className="hover:text-blue-600 transition-colors">{isRTL ? 'إلكترونيات' : 'Electronics'}</Link></li>
              <li><Link href="/?category=Fashion" className="hover:text-blue-600 transition-colors">{isRTL ? 'أزياء وكوتشيات' : 'Fashion & Sneakers'}</Link></li>
              <li><Link href="/?category=Home" className="hover:text-blue-600 transition-colors">{isRTL ? 'أثاث ومنزل' : 'Home & Living'}</Link></li>
              <li><Link href="/?category=Automotive" className="hover:text-blue-600 transition-colors">{isRTL ? 'سيارات ومركبات' : 'Motors & Vehicles'}</Link></li>
            </ul>
          </div>

          {/* Account & Selling */}
          <div>
            <h4 className="font-bold text-xs text-gray-900 uppercase tracking-wider mb-3.5">
              {isRTL ? 'البيع والشراء' : 'Buy & Sell'}
            </h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/sell" className="hover:text-blue-600 transition-colors font-semibold text-blue-600">{isRTL ? 'إضافة إعلان' : 'List an Item'}</Link></li>
              <li><Link href="/orders" className="hover:text-blue-600 transition-colors">{isRTL ? 'طلباتي والضمان' : 'My Escrow Orders'}</Link></li>
              <li><Link href="/wallet" className="hover:text-blue-600 transition-colors">{isRTL ? 'المحفظة والسحب' : 'Wallet & Payouts'}</Link></li>
              <li><Link href="/seller-verification" className="hover:text-blue-600 transition-colors">{isRTL ? 'توثيق البائع' : 'Seller Verification'}</Link></li>
              <li><Link href="/profile" className="hover:text-blue-600 transition-colors">{isRTL ? 'الملف الشخصي' : 'User Profile'}</Link></li>
            </ul>
          </div>

          {/* Legal & Trust */}
          <div>
            <h4 className="font-bold text-xs text-gray-900 uppercase tracking-wider mb-3.5">
              {isRTL ? 'الأمان والشروط' : 'Trust & Policies'}
            </h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/privacy" className="hover:text-blue-600 transition-colors font-medium">{isRTL ? 'سياسة الخصوصية' : 'Privacy Policy'}</Link></li>
              <li><Link href="/terms" className="hover:text-blue-600 transition-colors font-medium">{isRTL ? 'شروط الخدمة' : 'Terms of Service'}</Link></li>
              <li>
                <a href="mailto:info@egbay.shop" className="hover:text-blue-600 transition-colors">
                  {isRTL ? 'الدعم الفني' : 'Contact Support'}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* ─── Bottom Bar ─── */}
        <div className="border-t border-gray-100 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-400">
          <p>© 2026 egbay.shop — {isRTL ? 'جميع الحقوق محفوظة' : 'All rights reserved.'}</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">{isRTL ? 'الخصوصية' : 'Privacy'}</Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-gray-600 transition-colors">{isRTL ? 'الشروط' : 'Terms'}</Link>
            <span>•</span>
            <a href="mailto:info@egbay.shop" className="hover:text-gray-600 transition-colors">{isRTL ? 'المساعدة' : 'Help'}</a>
          </div>
        </div>

        {/* ─── Disclaimer Note for Search Engines & Security Scanners ─── */}
        <div className="mt-4 text-[10px] text-gray-400 text-center leading-relaxed">
          {isRTL
            ? 'إيجي باي (egbay.shop) هي منصة تجارة إلكترونية مصرية مستقلة تعمل داخل جمهورية مصر العربية ولا تتبع أي جهات تجارية خارجية.'
            : 'EgyBay (egbay.shop) is an independent peer-to-peer marketplace operating in Egypt. EgyBay is not affiliated with, endorsed by, or sponsored by eBay Inc. or any international entities.'}
        </div>
      </div>
    </footer>
  );
}
