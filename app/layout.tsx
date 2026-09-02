import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { LanguageProvider } from '@/components/LanguageProvider';
import { MarketplaceJsonLd } from '@/components/JsonLd';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MobileBottomNav from '@/components/MobileBottomNav';
import PageTransition from '@/components/PageTransition';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://egbay.shop';

export const viewport: Viewport = {
  themeColor: '#3665F3',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "EgyBay — Egypt's Trusted Escrow Marketplace (سوق إيجي باي مصر)",
    template: "%s | EgyBay — Egypt's Marketplace",
  },
  description:
    'Buy and sell electronics, sneakers, fashion, and vehicles safely across Egypt. 100% Escrow Protection, doorstep courier delivery, and instant InstaPay / Vodafone Cash payouts.',
  keywords: [
    'EgyBay',
    'Egypt marketplace',
    'buy and sell Egypt',
    'escrow payment Egypt',
    'online shopping Cairo',
    'used electronics Egypt',
    'سوق مصر',
    'بيع واشتري في مصر',
    'ضمان مالي مصر',
    'إنستاباي',
    'فودافون كاش',
    'مستعمل مصر',
    'اوليكس مصر بديل',
  ],
  authors: [{ name: 'EgyBay Marketplace Inc.', url: siteUrl }],
  creator: 'EgyBay Team',
  publisher: 'EgyBay Marketplace',
  category: 'ecommerce',
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/?lang=en',
      'ar-EG': '/?lang=ar',
      'x-default': '/',
    },
  },
  openGraph: {
    title: "EgyBay — Egypt's Trusted Escrow Marketplace",
    description:
      'Buy & sell with complete escrow peace of mind across all Egyptian governorates. Nationwide courier delivery, verified sellers, and instant payouts.',
    url: siteUrl,
    siteName: 'EgyBay',
    locale: 'en_US',
    alternateLocale: 'ar_EG',
    type: 'website',
    images: [
      {
        url: '/icon.svg',
        width: 512,
        height: 512,
        alt: 'EgyBay - Escrow Marketplace Egypt',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "EgyBay — Egypt's Trusted Marketplace",
    description: '100% Escrow Protection, doorstep courier delivery, and instant InstaPay & Vodafone Cash payouts in Egypt.',
    images: ['/icon.svg'],
    creator: '@egbay_market',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <MarketplaceJsonLd />
      </head>
      <body className="min-h-screen flex flex-col bg-[#F8FAFC]" suppressHydrationWarning>
        <LanguageProvider>
          <AuthProvider>
            <Suspense fallback={
              <div className="h-[110px] bg-white border-b border-gray-200" />
            }>
              <Navbar />
            </Suspense>
            <main className="flex-1 flex flex-col pb-16 md:pb-0">
              <PageTransition>
                {children}
              </PageTransition>
            </main>
            <Footer />
            <Suspense fallback={null}>
              <MobileBottomNav />
            </Suspense>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
