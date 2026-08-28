import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PageTransition from '@/components/PageTransition';

export const metadata: Metadata = {
  title: {
    default: 'EgyBay — Egypt\'s Trusted Marketplace',
    template: '%s | EgyBay',
  },
  description: 'Buy and sell anything safely in Egypt with escrow protection, Bosta shipping, and real-time chat.',
  keywords: ['Egypt marketplace', 'buy sell Egypt', 'online market Egypt', 'escrow Egypt', 'بيع وشراء مصر'],
  openGraph: {
    title: 'EgyBay — Egypt\'s Trusted Marketplace',
    description: 'Buy and sell anything safely in Egypt with escrow protection.',
    url: 'https://egbay.shop',
    siteName: 'EgyBay',
    locale: 'en_US',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-[#F8FAFC]" suppressHydrationWarning>
        <AuthProvider>
          <Suspense fallback={
            <div className="h-[110px] bg-white border-b border-gray-200" />
          }>
            <Navbar />
          </Suspense>
          <main className="flex-1 flex flex-col">
            <PageTransition>
              {children}
            </PageTransition>
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
