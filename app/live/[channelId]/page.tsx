'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users, MessageSquare, Send, ShoppingBag, Heart, X,
  Share2, ChevronDown, Zap, CheckCircle2, ArrowLeft
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import {
  getLiveSessionByChannel, joinLiveSession,
  sendChatMessage, getRecentChatMessages,
  type LiveSession, type LiveChatMessage, type LivePinnedProduct
} from '@/lib/liveService';
import { supabase } from '@/lib/supabase';
import { formatEGP } from '@/lib/products';

let AgoraRTC: any = null;

export default function ViewerPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const router = useRouter();

  const [session, setSession] = useState<LiveSession | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [pinnedProduct, setPinnedProduct] = useState<LivePinnedProduct | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reactions, setReactions] = useState<{ id: number; emoji: string; x: number }[]>([]);

  const videoContainerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Load session and join Agora channel
  useEffect(() => {
    if (!channelId) return;
    (async () => {
      try {
        const s = await getLiveSessionByChannel(channelId as string);
        if (!s || s.status !== 'live') {
          router.push('/live');
          return;
        }
        setSession(s);
        setViewerCount(s.current_viewers);
        const msgs = await getRecentChatMessages(s.id);
        setMessages(msgs);

        // Detect current pinned product
        const active = s.pinned_products?.find(p => !p.unpinned_at);
        if (active) setPinnedProduct(active);

        // Join Agora as audience
        if (!AgoraRTC) {
          const mod = await import('agora-rtc-sdk-ng');
          AgoraRTC = mod.default;
        }
        const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID!;
        const uid = Math.floor(Math.random() * 1000000);
        const token = await joinLiveSession(channelId as string, uid);
        const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
        await client.setClientRole('audience');
        clientRef.current = client;
        await client.join(appId, channelId, token, uid);
        client.on('user-published', async (remoteUser: any, mediaType: 'video' | 'audio') => {
          await client.subscribe(remoteUser, mediaType);
          if (mediaType === 'video' && videoContainerRef.current) {
            remoteUser.videoTrack?.play(videoContainerRef.current);
          }
          if (mediaType === 'audio') {
            remoteUser.audioTrack?.play();
          }
        });
      } finally {
        setLoading(false);
      }
    })();

    return () => { clientRef.current?.leave(); };
  }, [channelId, router]);

  // Realtime subscriptions
  useEffect(() => {
    if (!session) return;

    const sessionSub = supabase
      .channel(`viewer_session_${session.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_sessions', filter: `id=eq.${session.id}` }, payload => {
        if (payload.new.status === 'ended') { router.push('/live'); return; }
        setViewerCount(payload.new.current_viewers ?? 0);
      })
      .subscribe();

    const chatSub = supabase
      .channel(`viewer_chat_${session.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_chat_messages', filter: `session_id=eq.${session.id}` }, payload => {
        setMessages(prev => [...prev.slice(-99), payload.new as LiveChatMessage]);
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      })
      .subscribe();

    const pinsSub = supabase
      .channel(`viewer_pins_${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_pinned_products', filter: `session_id=eq.${session.id}` }, payload => {
        if (payload.eventType === 'INSERT') setPinnedProduct(payload.new as LivePinnedProduct);
        if (payload.eventType === 'UPDATE' && payload.new.unpinned_at) setPinnedProduct(null);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sessionSub);
      supabase.removeChannel(chatSub);
      supabase.removeChannel(pinsSub);
    };
  }, [session, router]);

  const handleSendChat = async () => {
    if (!chatInput.trim() || !user || !session) return;
    const msg = chatInput.trim();
    setChatInput('');
    await sendChatMessage({
      sessionId: session.id,
      userId: user.id,
      username: user.user_metadata?.full_name || 'Viewer',
      message: msg,
    });
  };

  const sendReaction = (emoji: string) => {
    const id = Date.now();
    const x = Math.random() * 80 + 10;
    setReactions(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2500);

    if (user && session) {
      sendChatMessage({ sessionId: session.id, userId: user.id, username: user.user_metadata?.full_name || 'Viewer', message: emoji, msgType: 'reaction' });
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-400 text-xs">{isRTL ? 'جاري الاتصال بالبث...' : 'Connecting to stream...'}</p>
    </div>
  );

  if (!session) return null;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-950 text-white overflow-hidden">
      {/* ── Video Area ── */}
      <div className="relative flex-1 min-h-[55vh] md:min-h-0 bg-black">
        <div ref={videoContainerRef} className="w-full h-full" />

        {/* Floating Reactions */}
        {reactions.map(r => (
          <div
            key={r.id}
            className="absolute bottom-24 text-2xl pointer-events-none animate-bounce"
            style={{ left: `${r.x}%`, animation: 'float-up 2.5s ease-out forwards' }}
          >
            {r.emoji}
          </div>
        ))}

        {/* Top Overlay */}
        <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center justify-between">
            <button onClick={() => router.push('/live')} className="w-8 h-8 bg-black/40 rounded-full flex items-center justify-center">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 bg-white rounded-full" /> LIVE
              </div>
              <div className="bg-black/50 backdrop-blur-md text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <Users className="w-3 h-3 text-blue-400" /> {viewerCount.toLocaleString()}
              </div>
            </div>
            <button className="w-8 h-8 bg-black/40 rounded-full flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {session.seller?.full_name?.[0]?.toUpperCase() || 'S'}
            </div>
            <div>
              <p className="text-xs font-bold leading-tight">{session.seller?.full_name || 'Seller'}</p>
              <p className="text-[10px] text-gray-400 truncate max-w-[200px]">{session.title}</p>
            </div>
          </div>
        </div>

        {/* Pinned Product Buy Card */}
        {pinnedProduct && (
          <div className="absolute bottom-16 left-3 right-3 md:right-auto md:w-72 bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl p-3 flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300">
            <div className="w-12 h-12 rounded-xl bg-gray-800 overflow-hidden flex-shrink-0">
              {pinnedProduct.product?.images?.[0] && (
                <img src={pinnedProduct.product.images[0]} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-300 truncate">{pinnedProduct.product?.title}</p>
              <p className="text-base font-black text-blue-400">{formatEGP(pinnedProduct.display_price || pinnedProduct.product?.price || 0)}</p>
            </div>
            <button
              onClick={() => setCheckoutOpen(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-black px-3 py-2 rounded-xl flex items-center gap-1 shadow-lg shadow-blue-900/40 flex-shrink-0"
            >
              <ShoppingBag className="w-3 h-3" /> {isRTL ? 'اشترِ' : 'BUY'}
            </button>
          </div>
        )}

        {/* Reaction Buttons */}
        <div className="absolute bottom-3 left-3 flex gap-2">
          {['❤️', '🔥', '🎉', '😮', '👏'].map(emoji => (
            <button key={emoji} onClick={() => sendReaction(emoji)} className="text-lg bg-black/40 backdrop-blur-md rounded-full w-9 h-9 flex items-center justify-center hover:scale-110 transition-transform">
              {emoji}
            </button>
          ))}
        </div>

        {/* Mobile Chat Toggle */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="absolute bottom-3 right-3 bg-[#3665F3] rounded-full w-9 h-9 flex items-center justify-center md:hidden"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      </div>

      {/* ── Chat Panel ── */}
      <div className={`${chatOpen ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 border-t md:border-t-0 md:border-l border-gray-800 max-h-[45vh] md:max-h-none`}>
        <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold">{isRTL ? 'الدردشة' : 'Live Chat'}</span>
            <span className="text-[10px] text-gray-500">({messages.length})</span>
          </div>
          <button onClick={() => setChatOpen(false)} className="text-gray-600 hover:text-white md:hidden">
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {messages.map(msg => (
            <div key={msg.id} className={`${msg.msg_type === 'system' ? 'text-center' : 'flex gap-2 items-start'}`}>
              {msg.msg_type === 'system' ? (
                <span className="text-[10px] text-gray-500 italic">{msg.message}</span>
              ) : msg.msg_type === 'reaction' ? (
                <span className="text-sm">{msg.message} <span className="text-[10px] text-gray-500">{msg.username}</span></span>
              ) : (
                <>
                  <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold mt-0.5 ${msg.is_host ? 'bg-red-600' : 'bg-gray-700'}`}>
                    {msg.username?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <span className={`text-[10px] font-bold ${msg.is_host ? 'text-red-400' : 'text-gray-500'}`}>
                      {msg.is_host ? '🎙️ ' : ''}{msg.username}
                    </span>
                    <p className="text-xs text-gray-200">{msg.message}</p>
                  </div>
                </>
              )}
            </div>
          ))}
          <div ref={chatBottomRef} />
        </div>

        <div className="p-3 border-t border-gray-800 flex gap-2">
          {user ? (
            <>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                placeholder={isRTL ? 'اكتب رسالة...' : 'Say something...'}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-blue-600"
              />
              <button onClick={handleSendChat} className="w-8 h-8 bg-[#3665F3] rounded-xl flex items-center justify-center">
                <Send className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <Link href="/login" className="flex-1 text-center text-xs text-blue-400 hover:underline py-2">
              {isRTL ? 'سجل الدخول للمشاركة في الدردشة' : 'Login to join the chat'}
            </Link>
          )}
        </div>
      </div>

      {/* Checkout Sheet over Video */}
      {checkoutOpen && pinnedProduct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setCheckoutOpen(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#3665F3]" />
                {isRTL ? 'شراء مع الضمان المالي' : 'Buy with Escrow Protection'}
              </h3>
              <button onClick={() => setCheckoutOpen(false)} className="text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
              <div className="w-14 h-14 rounded-xl bg-gray-200 overflow-hidden">
                {pinnedProduct.product?.images?.[0] && <img src={pinnedProduct.product.images[0]} alt="" className="w-full h-full object-cover" />}
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">{pinnedProduct.product?.title}</p>
                <p className="text-xl font-black text-[#3665F3]">{formatEGP(pinnedProduct.display_price || pinnedProduct.product?.price || 0)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs text-gray-500 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{isRTL ? 'أموالك محفوظة في الضمان حتى تستلم السلعة وتتحقق منها خلال ٢٤ ساعة.' : 'Your funds are held in escrow until you receive and inspect the item within 24 hours.'}</span>
            </div>
            <Link
              href={`/checkout/${pinnedProduct.product_id}`}
              className="block w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black py-4 rounded-2xl text-center text-sm shadow-lg shadow-blue-500/25"
              onClick={() => setCheckoutOpen(false)}
            >
              {isRTL ? 'انتقل لإتمام الشراء الآن →' : 'Proceed to Escrow Checkout →'}
            </Link>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes float-up {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-120px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
