'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users, MessageSquare, Send, ShoppingBag, Heart, X,
  Share2, ChevronDown, Zap, CheckCircle2, ArrowLeft,
  Sparkles, Smile, Crown, AlertCircle, ShieldCheck, Flame
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import FloatingReactions, { type FloatingReactionParticle } from '@/components/live/FloatingReactions';
import LiveQuickCheckout from '@/components/live/LiveQuickCheckout';
import {
  getLiveSessionByChannel, joinLiveSession,
  sendChatMessage, getRecentChatMessages, getActivePinnedProduct,
  recordLiveSale,
  type LiveSession, type LiveChatMessage, type LivePinnedProduct
} from '@/lib/liveService';
import { supabase } from '@/lib/supabase';

const QUICK_EMOJIS = ['❤️', '🔥', '👏', '🚀', '💎', '💯', '😂', '🎉', '👍', '👀', '✨', '⚡'];

const formatEGP = (amount: number) => `EGP ${(Number(amount) || 0).toLocaleString('en-EG')}`;

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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reactions, setReactions] = useState<FloatingReactionParticle[]>([]);

  const videoContainerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Trigger floating particle
  const triggerFloatingParticle = (emoji: string) => {
    const id = `particle_${Date.now()}_${Math.random()}`;
    const xOffset = Math.random() * 40 + 50; // drift up the right side
    const size = Math.floor(Math.random() * 14) + 24;
    const rotation = (Math.random() - 0.5) * 45;
    setReactions(prev => [...prev.slice(-30), { id, emoji, xOffset, size, rotation }]);
  };

  const handleRemoveParticle = (id: string) => {
    setReactions(prev => prev.filter(r => r.id !== id));
  };

  // Load session and join Agora channel
  useEffect(() => {
    if (!channelId) return;
    let isMounted = true;

    (async () => {
      try {
        const s = await getLiveSessionByChannel(channelId as string);
        if (!s) {
          router.push('/live');
          return;
        }
        if (isMounted) {
          setSession(s);
          setViewerCount(s.current_viewers || 1);
        }

        const msgs = await getRecentChatMessages(s.id);
        if (isMounted) setMessages(msgs);

        // Detect current pinned product
        const activePin = await getActivePinnedProduct(s.id);
        if (activePin && isMounted) {
          setPinnedProduct(activePin);
        }

        // Join Agora as audience
        try {
          if (!AgoraRTC) {
            const mod = await import('agora-rtc-sdk-ng');
            AgoraRTC = mod.default;
          }
          const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || 'f9fd0dadb9674b698d234f4551d6100b';
          const uid = Math.floor(Math.random() * 1000000);
          const token = await joinLiveSession(channelId as string, uid);
          const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
          await client.setClientRole('audience');
          clientRef.current = client;

          await client.join(appId, channelId as string, token || null, uid);

          client.on('user-published', async (remoteUser: any, mediaType: 'video' | 'audio') => {
            await client.subscribe(remoteUser, mediaType);
            if (mediaType === 'video' && videoContainerRef.current) {
              remoteUser.videoTrack?.play(videoContainerRef.current);
            }
            if (mediaType === 'audio') {
              remoteUser.audioTrack?.play();
            }
          });
        } catch (agoraErr) {
          console.warn('[Viewer] Agora audience connection fallback:', agoraErr);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      clientRef.current?.leave().catch(() => {});
    };
  }, [channelId, router]);

  const [streamEndedModal, setStreamEndedModal] = useState(false);

  // Realtime subscriptions: chat + pins + stream state
  useEffect(() => {
    if (!session) return;

    const chatSub = supabase
      .channel(`viewer_chat_${session.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_chat_messages', filter: `session_id=eq.${session.id}` }, payload => {
        const newMsg = payload.new as LiveChatMessage;
        setMessages(prev => [...prev.slice(-99), newMsg]);
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

        if (newMsg.msg_type === 'reaction') {
          triggerFloatingParticle(newMsg.message);
        }
      })
      .subscribe();

    const pinsSub = supabase
      .channel(`viewer_pins_${session.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_pinned_products', filter: `session_id=eq.${session.id}` }, payload => {
        setPinnedProduct(payload.new as LivePinnedProduct);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_pinned_products', filter: `session_id=eq.${session.id}` }, payload => {
        if (payload.new.unpinned_at) {
          setPinnedProduct(null);
        }
      })
      .subscribe();

    const sessionSub = supabase
      .channel(`viewer_sess_${session.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_sessions', filter: `id=eq.${session.id}` }, payload => {
        if (payload.new.status === 'ended') {
          setStreamEndedModal(true);
        }
        if (payload.new.current_viewers !== undefined) {
          setViewerCount(payload.new.current_viewers);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chatSub);
      supabase.removeChannel(pinsSub);
      supabase.removeChannel(sessionSub);
    };
  }, [session, router, isRTL]);

  const handleSendChat = async (textToSend?: string) => {
    const content = textToSend || chatInput;
    if (!content.trim() || !user || !session) return;
    const msg = content.trim();
    if (!textToSend) setChatInput('');
    setShowEmojiPicker(false);

    await sendChatMessage({
      sessionId: session.id,
      userId: user.id,
      username: user.user_metadata?.full_name || 'Buyer',
      message: msg,
      msgType: 'chat',
    });
  };

  const handleSendReaction = async (emoji: string) => {
    triggerFloatingParticle(emoji);
    if (user && session) {
      sendChatMessage({
        sessionId: session.id,
        userId: user.id,
        username: user.user_metadata?.full_name || 'Buyer',
        message: emoji,
        msgType: 'reaction',
      });
    }
  };

  const handlePurchaseSuccess = (order: any) => {
    if (session) {
      recordLiveSale(session.id, order.amount);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 text-white">
        <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-xs font-semibold">
          {isRTL ? 'جاري الاتصال بالبث المباشر...' : 'Connecting to Live Commerce Stream...'}
        </p>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-slate-950 text-white overflow-hidden select-none">
      {/* ── Main Video Stream Area ── */}
      <div className="relative flex-1 min-h-[52vh] lg:min-h-0 bg-black flex flex-col justify-between overflow-hidden">
        {/* Video Canvas Container */}
        <div ref={videoContainerRef} className="w-full h-full absolute inset-0 object-cover" />

        {/* Floating Reactions Particle Canvas */}
        <FloatingReactions reactions={reactions} onRemove={handleRemoveParticle} />

        {/* Top Overlay HUD Bar */}
        <div className="relative z-20 p-4 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between gap-3">
          {/* Back & Seller Info */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/live')}
              className="w-9 h-9 bg-black/60 backdrop-blur-md hover:bg-black/80 rounded-2xl flex items-center justify-center text-white transition-colors border border-white/10"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md border border-white/10 p-1.5 pr-3 rounded-full">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-black shadow-md flex-shrink-0">
                {session.seller?.full_name?.[0]?.toUpperCase() || 'S'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight flex items-center gap-1">
                  <span>{session.seller?.full_name || 'Seller'}</span>
                  <CheckCircle2 className="w-3 h-3 text-blue-400 fill-blue-400/20" />
                </p>
                <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{session.title}</p>
              </div>
            </div>
          </div>

          {/* Live Badge & Viewers Count */}
          <div className="flex items-center gap-2">
            <div className="bg-red-600 text-white text-[11px] font-black px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg shadow-red-600/30 animate-pulse">
              <span className="w-2 h-2 bg-white rounded-full" />
              <span>LIVE</span>
            </div>
            <div className="bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>{viewerCount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Spotlight Pinned Product Card (Bottom Left) */}
        {pinnedProduct && (
          <div className="relative z-20 p-4 pb-2">
            <motion.div
              initial={{ y: 25, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-slate-900/90 backdrop-blur-md border border-emerald-500/50 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-2xl max-w-md"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-14 rounded-xl bg-slate-950 overflow-hidden flex-shrink-0 border border-slate-700 relative">
                  {pinnedProduct.product?.images?.[0] ? (
                    <img src={pinnedProduct.product.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBag className="w-6 h-6 text-slate-600 m-auto" />
                  )}
                  <span className="absolute top-1 left-1 bg-red-600 text-white text-[8px] font-black px-1 rounded">
                    DEAL
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="inline-block bg-emerald-500/20 text-emerald-300 text-[9px] font-black px-2 py-0.5 rounded-full mb-0.5">
                    {isRTL ? 'معروض للشراء الآن ⚡' : 'FEATURED ITEM ⚡'}
                  </span>
                  <p className="text-xs font-bold text-white truncate">{pinnedProduct.product?.title || 'Product'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-base font-black text-emerald-400">
                      {formatEGP(pinnedProduct.display_price || pinnedProduct.product?.price || 0)}
                    </span>
                    {pinnedProduct.product?.price && pinnedProduct.product.price > (pinnedProduct.display_price || 0) && (
                      <span className="text-[11px] text-slate-500 line-through">
                        {formatEGP(pinnedProduct.product.price)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCheckoutOpen(true)}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-900/40 flex items-center gap-1.5 flex-shrink-0 active:scale-95 animate-pulse"
              >
                <Zap className="w-3.5 h-3.5 fill-white" />
                <span>{isRTL ? 'شراء فوري' : 'Buy Now'}</span>
              </button>
            </motion.div>
          </div>
        )}

        {/* Reaction Buttons & Mobile Chat Toggle Bar */}
        <div className="relative z-20 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-center justify-between gap-2">
          {/* Reaction Bursts */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {QUICK_EMOJIS.slice(0, 7).map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleSendReaction(emoji)}
                className="text-lg bg-black/50 backdrop-blur-md hover:bg-black/80 border border-white/10 rounded-2xl w-10 h-10 flex items-center justify-center hover:scale-125 active:scale-90 transition-transform shadow-lg"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Mobile Chat Toggle Button */}
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="lg:hidden bg-[#3665F3] hover:bg-[#2B54D4] text-white p-2.5 rounded-2xl shadow-lg flex items-center gap-1.5 text-xs font-bold"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{chatOpen ? (isRTL ? 'إخفاء' : 'Hide') : (isRTL ? 'الدردشة' : 'Chat')}</span>
          </button>
        </div>
      </div>

      {/* ── Right Panel: Live Chat Room & Events ── */}
      <div
        className={`${
          chatOpen ? 'flex' : 'hidden'
        } lg:flex flex-col w-full lg:w-96 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 h-[48vh] lg:h-full flex-shrink-0`}
      >
        {/* Chat Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-black text-white">{isRTL ? 'الدردشة الحية' : 'Live Chat'}</h3>
            <span className="text-[10px] text-slate-500 font-mono">({messages.length})</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-1 text-[11px] text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              {isRTL ? 'ضمان مالي ١٠٠٪' : '100% Escrow'}
            </span>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {messages.map(msg => {
            // Purchase Event Card
            if (msg.msg_type === 'purchase') {
              return (
                <motion.div
                  key={msg.id}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-gradient-to-r from-amber-950/80 via-emerald-950/80 to-slate-900/80 border border-amber-500/40 rounded-2xl p-3 shadow-lg flex items-center gap-2.5"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold flex-shrink-0">
                    🎉
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-amber-300 uppercase tracking-wide">
                      {isRTL ? 'طلب جديد بالبث!' : 'NEW PURCHASE!'}
                    </p>
                    <p className="text-xs font-black text-white truncate">{msg.username}</p>
                    <p className="text-[11px] text-emerald-400 font-semibold">{msg.message}</p>
                  </div>
                </motion.div>
              );
            }

            // Pin Spotlight Announcement Card
            if (msg.msg_type === 'pin') {
              return (
                <motion.div
                  key={msg.id}
                  initial={{ y: 5, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="bg-blue-950/50 border border-blue-500/30 rounded-2xl p-2.5 flex items-center gap-2 text-xs text-blue-200"
                >
                  <Zap className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span className="font-semibold text-[11px] leading-tight">{msg.message}</span>
                </motion.div>
              );
            }

            // System Announcement
            if (msg.msg_type === 'system') {
              return (
                <div key={msg.id} className="text-center my-1">
                  <span className="inline-block bg-slate-800/80 text-slate-400 text-[10px] px-3 py-1 rounded-full border border-slate-700">
                    {msg.message}
                  </span>
                </div>
              );
            }

            // Standard Chat Message
            return (
              <div key={msg.id} className="flex items-start gap-2.5">
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    msg.is_host
                      ? 'bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-md'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {msg.is_host ? <Crown className="w-3.5 h-3.5 text-white" /> : (msg.username?.[0]?.toUpperCase() || '?')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[11px] font-bold ${msg.is_host ? 'text-amber-400 font-black' : 'text-slate-400'}`}>
                      {msg.username}
                    </span>
                    {msg.is_host && (
                      <span className="bg-amber-500/20 text-amber-300 text-[8px] font-black px-1.5 py-0.2 rounded">
                        HOST
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed break-words mt-0.5">
                    {msg.message}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={chatBottomRef} />
        </div>

        {/* Quick Emoji Reaction Strip */}
        <div className="px-3 py-2 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar flex-shrink-0">
          {QUICK_EMOJIS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleSendReaction(emoji)}
              className="text-base p-1.5 hover:bg-slate-800 rounded-xl transition-transform hover:scale-125 active:scale-95 flex-shrink-0"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Chat Input & Emoji Picker Bar */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex flex-col gap-2 relative flex-shrink-0">
          {/* Emoji Popover */}
          <AnimatePresence>
            {showEmojiPicker && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-16 left-3 right-3 bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-2xl z-30"
              >
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800 text-xs font-bold text-slate-400">
                  <span>{isRTL ? 'اختر إيموجي' : 'Pick an Emoji'}</span>
                  <button onClick={() => setShowEmojiPicker(false)} className="text-slate-500 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-6 gap-2 text-xl max-h-36 overflow-y-auto">
                  {['❤️', '🔥', '👏', '🚀', '💎', '💯', '😂', '🎉', '👍', '👀', '✨', '⚡', '🤩', '🙌', '🛍️', '👑', '🤝', '🥳', '😎', '👌', '⭐', '🎈', '💸', '⏳'].map(em => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => {
                        setChatInput(prev => prev + em);
                        setShowEmojiPicker(false);
                      }}
                      className="p-1 hover:bg-slate-800 rounded-xl text-center transition-transform hover:scale-110"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-2.5 rounded-xl border transition-colors ${
                showEmojiPicker ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <Smile className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendChat()}
              placeholder={isRTL ? 'اكتب تعليقاً للبائع...' : 'Chat with the host...'}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => handleSendChat()}
              disabled={!chatInput.trim()}
              className="bg-[#3665F3] hover:bg-[#2B54D4] disabled:opacity-40 text-white p-2.5 rounded-xl transition-all shadow-md flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── In-Stream Fast 1-Click Checkout Drawer ── */}
      {pinnedProduct && (
        <LiveQuickCheckout
          isOpen={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          session={session}
          pinnedItem={pinnedProduct}
          onPurchaseSuccess={handlePurchaseSuccess}
        />
      )}

      {/* ── Stream Ended In-App Modal ── */}
      <AnimatePresence>
        {streamEndedModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl text-white"
            >
              <div className="w-16 h-16 bg-blue-600/20 border border-blue-500/30 rounded-3xl flex items-center justify-center text-blue-400 mx-auto shadow-lg shadow-blue-600/20">
                <Sparkles className="w-8 h-8 text-blue-400" />
              </div>

              <div>
                <h4 className="text-lg font-black text-white">
                  {isRTL ? 'انتهى البث المباشر 🎬' : 'Stream Has Ended 🎬'}
                </h4>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  {isRTL
                    ? 'شكراً لحضورك وتفاعلك! يمكنك متابعة عروض البث المباشر الأخرى أو تصفح المتجر.'
                    : 'Thanks for watching and participating! Explore more live shopping deals or browse the marketplace.'}
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => router.push('/live')}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-3 rounded-xl text-xs transition-all shadow-lg shadow-blue-600/30"
                >
                  {isRTL ? 'تصفح بثوث مباشرة أخرى 🔴' : 'Explore Live Streams 🔴'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-colors"
                >
                  {isRTL ? 'العودة للرئيسية' : 'Back to Home'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
