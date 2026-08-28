import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, Truck, MessageCircle, HelpCircle, Lock, Smartphone, CreditCard } from 'lucide-react';

export default function Footer() {
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
              <h4 className="text-xs font-bold text-gray-900">100% Escrow Protection</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">Funds held safely until order inspection</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 justify-center sm:justify-start">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 border border-blue-100">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-900">Doorstep Courier Delivery</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">Nationwide coverage with Bosta & QR Meetups</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 justify-center sm:justify-start">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 border border-indigo-100">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-900">Verified Sellers & Payouts</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">Egyptian National ID KYC + InstaPay payouts</p>
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
              Egypt&apos;s modern peer-to-peer marketplace. Buy, sell, and trade electronics, fashion, vehicles, and collectibles with total escrow peace of mind.
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="font-semibold text-gray-700">Supported Payouts:</span>
              <span>InstaPay • Vodafone Cash • Bank Transfer</span>
            </div>
          </div>

          {/* Marketplace Navigation */}
          <div>
            <h4 className="font-bold text-xs text-gray-900 uppercase tracking-wider mb-3.5">Marketplace</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/" className="hover:text-blue-600 transition-colors">All Categories</Link></li>
              <li><Link href="/?category=Electronics" className="hover:text-blue-600 transition-colors">Electronics</Link></li>
              <li><Link href="/?category=Fashion" className="hover:text-blue-600 transition-colors">Fashion & Sneakers</Link></li>
              <li><Link href="/?category=Home" className="hover:text-blue-600 transition-colors">Home & Living</Link></li>
              <li><Link href="/?category=Automotive" className="hover:text-blue-600 transition-colors">Motors & Vehicles</Link></li>
            </ul>
          </div>

          {/* Account & Selling */}
          <div>
            <h4 className="font-bold text-xs text-gray-900 uppercase tracking-wider mb-3.5">Buy & Sell</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/sell" className="hover:text-blue-600 transition-colors font-semibold text-blue-600">List an Item</Link></li>
              <li><Link href="/orders" className="hover:text-blue-600 transition-colors">My Escrow Orders</Link></li>
              <li><Link href="/wallet" className="hover:text-blue-600 transition-colors">Wallet & Payouts</Link></li>
              <li><Link href="/seller-verification" className="hover:text-blue-600 transition-colors">Seller Verification</Link></li>
              <li><Link href="/profile" className="hover:text-blue-600 transition-colors">User Profile</Link></li>
            </ul>
          </div>

          {/* Legal & Trust */}
          <div>
            <h4 className="font-bold text-xs text-gray-900 uppercase tracking-wider mb-3.5">Trust & Policies</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/privacy" className="hover:text-blue-600 transition-colors font-medium">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-blue-600 transition-colors font-medium">Terms of Service</Link></li>
              <li>
                <a href="mailto:support@egbay.market" className="hover:text-blue-600 transition-colors">
                  Contact Support
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* ─── Bottom Bar ─── */}
        <div className="border-t border-gray-100 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-400">
          <p>© 2026 egbay.shop — All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy</Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-gray-600 transition-colors">Terms</Link>
            <span>•</span>
            <a href="mailto:support@egbay.market" className="hover:text-gray-600 transition-colors">Help</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
