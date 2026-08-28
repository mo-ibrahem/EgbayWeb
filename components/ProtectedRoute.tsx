'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Lock, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      const redirectUrl = `/login?redirect=${encodeURIComponent(pathname)}`;
      router.replace(redirectUrl);
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs font-semibold text-slate-400">Verifying session...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="w-14 h-14 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-md shadow-blue-500/10">
          <Lock className="w-6 h-6" />
        </div>
        <div className="max-w-xs space-y-1">
          <h2 className="text-base font-black text-slate-900">Sign In Required</h2>
          <p className="text-xs text-slate-500">Redirecting to login so you can access your account...</p>
        </div>
        <Link
          href={`/login?redirect=${encodeURIComponent(pathname)}`}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors shadow-sm"
        >
          Go to Sign In
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
