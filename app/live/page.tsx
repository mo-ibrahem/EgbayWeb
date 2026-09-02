'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Video, Users, Zap, Play, Clock, Package, ShieldCheck, ChevronRight } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { getActiveLiveSessions, LIVE_PASSES, type LiveSession } from '@/lib/liveService';
import { supabase } from '@/lib/supabase';
import SmartImage from '@/components/SmartImage';

export default function LiveDiscoveryPage() {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await getActiveLiveSessions();
        setSessions(data);
      } finally {
        setLoading(false);
      }
    })();

    // Realtime: add/remove live sessions from feed
    const sub = supabase
      .channel('live_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions' }, () => {
        getActiveLiveSessions().then(setSessions);
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  const liveNow = sessions.filter(s => s.status === 'live');
  const upcoming = sessions.filter(s => s.status === 'scheduled');

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 pb-24 space-y-10">
      {/* Hero Banner */}
      <div className="relative bg-slate-900 rounded-lg overflow-hidden p-8 border border-slate-800 shadow-xl">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-red-600/10 border border-red-600/30 text-red-400 text-xs font-black px-3 py-1 rounded-full mb-4">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            {isRTL ? 'بيع مباشر وحصري — EgyBay Live' : 'LIVE SHOPPING — EgyBay Live'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">
            {isRTL ? 'سوق مباشر للتجار والمحلات المصرية' : 'Egypt\'s Live Commerce Marketplace'}
          </h1>
          <p className="text-sm text-gray-400 max-w-lg mb-6">
            {isRTL
              ? 'اشترِ مباشرة من التجار الموثوقين عبر بث حي مع حماية الضمان المالي الكاملة وتوصيل لباب البيت.'
              : 'Buy directly from verified Egyptian sellers via live HD video with 100% escrow protection and doorstep delivery.'}
          </p>
          <div className="flex flex-wrap gap-3">
            {user && (
              <Link
                href="/live/book"
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-black px-5 py-3 rounded-md text-sm shadow-lg shadow-red-900/30 transition-all"
              >
                <Video className="w-4 h-4" />
                {isRTL ? 'ابدأ بثك المباشر' : 'Go Live & Sell'}
              </Link>
            )}
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> {isRTL ? 'ضمان مالي ١٠٠٪' : '100% Escrow'}</span>
              <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5 text-blue-400" /> {isRTL ? 'توصيل لباب البيت' : 'Doorstep Delivery'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Now */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse" />
            {isRTL ? `يبث الآن (${liveNow.length})` : `Live Now (${liveNow.length})`}
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-gray-100 rounded-lg aspect-video animate-pulse" />
            ))}
          </div>
        ) : liveNow.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200/80 rounded-lg p-10 text-center">
            <Video className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-semibold">
              {isRTL ? 'لا توجد بثوث حية الآن — تحقق لاحقاً أو ابدأ بثك الخاص!' : 'No streams live right now — check back soon or start your own!'}
            </p>
            {user && (
              <Link href="/live/book" className="mt-4 inline-flex items-center gap-2 bg-red-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-red-700 transition-colors">
                <Video className="w-3.5 h-3.5" />
                {isRTL ? 'ابدأ بثك الآن' : 'Go Live Now'}
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveNow.map(session => (
              <Link key={session.id} href={`/live/${session.agora_channel}`} className="group block">
                <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video border border-gray-800 group-hover:border-red-600/50 transition-colors">
                  {session.thumbnail_url ? (
                    <SmartImage src={session.thumbnail_url} alt={session.title} fill className="object-cover opacity-80 group-hover:opacity-100 transition-opacity" sizes="(max-width: 640px) 100vw, 33vw" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-red-600/20 flex items-center justify-center">
                        <Play className="w-8 h-8 text-red-500" />
                      </div>
                    </div>
                  )}

                  {/* Live Pill */}
                  <div className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 bg-white rounded-full" /> LIVE
                  </div>

                  {/* Viewer Count */}
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Users className="w-2.5 h-2.5 text-blue-400" />
                    {session.current_viewers.toLocaleString()}
                  </div>

                  {/* Gradient Bottom */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                        {session.seller?.full_name?.[0]?.toUpperCase() || 'S'}
                      </div>
                      <span className="text-[11px] text-gray-300 font-semibold">{session.seller?.full_name || 'Seller'}</span>
                    </div>
                    <p className="text-xs font-bold text-white truncate">{isRTL && session.title_ar ? session.title_ar : session.title}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Scheduled */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="text-base font-black text-gray-900 flex items-center gap-2 mb-5">
            <Clock className="w-4 h-4 text-blue-600" />
            {isRTL ? `بثوث قادمة (${upcoming.length})` : `Upcoming Shows (${upcoming.length})`}
          </h2>
          <div className="space-y-3">
            {upcoming.map(session => (
              <div key={session.id} className="bg-white border border-gray-200/80 rounded-md p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm truncate">{isRTL && session.title_ar ? session.title_ar : session.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-500">by {session.seller?.full_name}</span>
                    {session.scheduled_at && (
                      <span className="text-[10px] bg-brand-soft text-brand-dark border border-brand/20 px-2 py-0.5 rounded-full font-bold">
                        {new Date(session.scheduled_at).toLocaleString(isRTL ? 'ar-EG' : 'en-EG', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Users className="w-3.5 h-3.5" />
                  {session.max_viewers}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How it Works */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/80 rounded-lg p-6 sm:p-8">
        <h2 className="text-base font-black text-gray-900 mb-6 text-center">
          {isRTL ? 'كيف يعمل EgyBay Live للبائعين؟' : 'How Does EgyBay Live Work for Sellers?'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              step: '1',
              icon: Zap,
              title: isRTL ? 'احجز الباقة وادفع من المحفظة' : 'Book Pass & Pay from Wallet',
              desc: isRTL ? 'اختر باقة Flash أو Pro أو Mega. المبلغ يُخصم فوراً من محفظتك.' : 'Choose Flash, Pro or Mega pass. Amount instantly deducted from your wallet.',
              color: '#F59E0B',
            },
            {
              step: '2',
              icon: Video,
              title: isRTL ? 'ابدأ البث المباشر وثبّت المنتجات' : 'Go Live & Pin Products',
              desc: isRTL ? 'أطلق البث بضغطة واحدة وثبّت أي منتج من متجرك على شاشة المشاهدين.' : 'Launch stream with one tap and pin any of your listings to viewer screens.',
              color: '#EF4444',
            },
            {
              step: '3',
              icon: ShieldCheck,
              title: isRTL ? 'البيع بضمان — الأرباح للمحفظة' : 'Sell with Escrow — Earn to Wallet',
              desc: isRTL ? 'كل عملية شراء محمية بالضمان المالي. الأرباح تصل لمحفظتك بعد تأكيد التسليم.' : 'Every purchase is escrow-protected. Earnings reach your wallet after delivery is confirmed.',
              color: '#10B981',
            },
          ].map(item => (
            <div key={item.step} className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-md flex items-center justify-center mb-3 shadow-sm" style={{ backgroundColor: `${item.color}20`, border: `1px solid ${item.color}30` }}>
                <item.icon className="w-6 h-6" style={{ color: item.color }} />
              </div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Step {item.step}</div>
              <h3 className="text-xs font-black text-gray-900 mb-1">{item.title}</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Pass Price Quick Ref */}
        <div className="mt-8 pt-6 border-t border-blue-100/80 grid grid-cols-3 gap-3">
          {LIVE_PASSES.map(pass => (
            <div key={pass.tier} className="text-center">
              <div className="text-xl mb-1">{pass.badge}</div>
              <p className="text-xs font-bold text-gray-700">{isRTL ? pass.name_ar : pass.name}</p>
              <p className="text-base font-black text-gray-900">{pass.priceEGP} <span className="text-xs text-gray-400">EGP</span></p>
              <p className="text-[10px] text-gray-500">{pass.durationMinutes}min • {pass.maxViewers} viewers</p>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          {user ? (
            <Link href="/live/book" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-black px-6 py-3 rounded-md text-sm shadow-md transition-all">
              <Video className="w-4 h-4" />
              {isRTL ? 'احجز بثك المباشر الآن' : 'Book Your Live Show Now'}
              <ChevronRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link href="/signup" className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white font-black px-6 py-3 rounded-md text-sm shadow-md transition-all">
              {isRTL ? 'سجل كبائع وابدأ البيع المباشر' : 'Sign Up & Start Live Selling'}
              <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
