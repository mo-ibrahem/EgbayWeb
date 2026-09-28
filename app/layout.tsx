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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.egbay.shop';

export const viewport: Viewport = {
  themeColor: '#2563EB',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Egbay — Buy and sell in Egypt (سوق إيجي باي مصر)',
    template: '%s | Egbay',
  },
  description:
    'Buy and sell new, used and refurbished electronics, fashion, vehicles and more across Egypt. Chat with sellers, make an offer, and meet in person.',
  keywords: [
    'Egbay',
    'Egypt marketplace',
    'buy and sell Egypt',
    'online shopping Cairo',
    'used electronics Egypt',
    'سوق مصر',
    'بيع واشتري في مصر',
    'مستعمل مصر',
  ],
  authors: [{ name: 'Egbay', url: siteUrl }],
  creator: 'Egbay',
  publisher: 'Egbay',
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
    title: 'Egbay — Buy and sell in Egypt',
    description:
      'New, used and refurbished items across Egypt. Chat with sellers, make an offer, and meet in person.',
    url: siteUrl,
    siteName: 'Egbay',
    locale: 'en_US',
    alternateLocale: 'ar_EG',
    type: 'website',
    images: [
      {
        url: '/icon-512.png',
        width: 512,
        height: 512,
        alt: 'Egbay',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Egbay — Buy and sell in Egypt',
    description: 'New, used and refurbished items across Egypt. Chat with sellers and meet in person.',
    images: ['/icon-512.png'],
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
    apple: '/apple-icon.png',
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
              <div className="h-[104px] bg-white border-b border-gray-200" />
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
