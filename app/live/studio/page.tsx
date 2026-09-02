'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Users, MessageSquare,
  Package, ChevronUp, Send, Pin, X, ShoppingBag, Zap, AlertCircle,
  Sparkles, DollarSign, Clock, Smile, Flame, Heart, Crown, CheckCircle2,
  Layers, Tag, ArrowRight, Share2, Award, ChevronDown, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import FloatingReactions, { type FloatingReactionParticle } from '@/components/live/FloatingReactions';
import {
  startLiveSession, endLiveSession, pinProduct, unpinProduct,
  sendChatMessage, getRecentChatMessages, getLiveSessionById,
  getActivePinnedProduct,
  type LiveSession, type LiveChatMessage, type LivePinnedProduct
} from '@/lib/liveService';
import { productService, type Product } from '@/lib/products';
import { supabase } from '@/lib/supabase';

const QUICK_EMOJIS = ['❤️', '🔥', '👏', '🚀', '💎', '💯', '😂', '🎉', '👍', '👀', '✨', '⚡'];

const formatEGP = (amount: number) => `EGP ${(Number(amount) || 0).toLocaleString('en-EG')}`;

// Dynamic import of Agora SDK to avoid SSR issues
let AgoraRTC: any = null;

function StudioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session') || '';
  const { user } = useAuth();
  const { isRTL } = useLanguage();

  const [session, setSession] = useState<LiveSession | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);

  // Chat & Reactions
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactions, setReactions] = useState<FloatingReactionParticle[]>([]);

  // Inventory Tray / Run of Show
  const [listings, setListings] = useState<Product[]>([]);
  const [pinnedProduct, setPinnedProduct] = useState<Product | null>(null);
  const [pinnedDisplayPrice, setPinnedDisplayPrice] = useState<number | null>(null);
  const [customLivePrices, setCustomLivePrices] = useState<Record<string, string>>({});
  const [inventoryDrawerOpen, setInventoryDrawerOpen] = useState(false);

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  // Agora refs
  const clientRef = useRef<any>(null);
  const localVideoTrackRef = useRef<any>(null);
  const localAudioTrackRef = useRef<any>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Live Duration Timer
  useEffect(() => {
    let interval: any;
    if (isLive) {
      interval = setInterval(() => {
        setDurationSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isLive]);

  // Load session + listings + pinned item
  useEffect(() => {
    if (!sessionId || !user) return;
    (async () => {
      try {
        const sess = await getLiveSessionById(sessionId);
        if (sess) {
          setSession(sess);
          setTotalSales(sess.total_sales_egp || 0);
        }

        const prods = await productService.getProductsBySeller(user.id);
        const activeListings = (prods ?? []).filter((p: Product) => p.status === 'active');
        setListings(activeListings);

        // Initialize default custom live prices
        const initialPrices: Record<string, string> = {};
        activeListings.forEach(p => {
          initialPrices[p.id] = String(p.price || 0);
        });
        setCustomLivePrices(initialPrices);

        // Load active pin
        const activePin = await getActivePinnedProduct(sessionId);
        if (activePin) {
          const foundProd = activeListings.find(p => p.id === activePin.product_id);
          if (foundProd) {
            setPinnedProduct(foundProd);
            setPinnedDisplayPrice(activePin.display_price || foundProd.price);
          }
        }

        const msgs = await getRecentChatMessages(sessionId);
        setMessages(msgs);
      } catch (err: any) {
        console.error('[Studio] Failed to load session:', err);
        setError(err?.message || 'Failed to load live session');
      }
    })();
  }, [sessionId, user]);

  // Realtime: viewer count + chat + purchases
  useEffect(() => {
    if (!sessionId) return;

    const sessionSub = supabase
      .channel(`studio_session_${sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_sessions', filter: `id=eq.${sessionId}` }, payload => {
        if (payload.new.current_viewers !== undefined) setViewerCount(payload.new.current_viewers);
        if (payload.new.total_sales_egp !== undefined) setTotalSales(payload.new.total_sales_egp);
      })
      .subscribe();

    const chatSub = supabase
      .channel(`studio_chat_${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_chat_messages', filter: `session_id=eq.${sessionId}` }, payload => {
        const newMsg = payload.new as LiveChatMessage;
        setMessages(prev => [...prev.slice(-99), newMsg]);
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

        // If reaction, spawn particle
        if (newMsg.msg_type === 'reaction') {
          triggerFloatingParticle(newMsg.message);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sessionSub);
      supabase.removeChannel(chatSub);
    };
  }, [sessionId]);

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

  const handleGoLive = useCallback(async () => {
    if (!sessionId || !user || !session) return;
    setStarting(true);
    setError('');

    try {
      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || 'f9fd0dadb9674b698d234f4551d6100b';
      let agoraSuccess = false;

      // Try Agora RTC CDN network
      try {
        if (!AgoraRTC) {
          const mod = await import('agora-rtc-sdk-ng');
          AgoraRTC = mod.default;
        }

        const hostUid = Math.floor(Math.random() * 1000000);
        const { token, channel } = await startLiveSession(sessionId, hostUid);
        const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
        await client.setClientRole('host');
        clientRef.current = client;

        if (appId && appId.length === 32) {
          await client.join(appId, channel, token || null, hostUid);
          const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
          localAudioTrackRef.current = audioTrack;
          localVideoTrackRef.current = videoTrack;
          await client.publish([audioTrack, videoTrack]);

          if (videoContainerRef.current) {
            videoContainerRef.current.innerHTML = '';
            videoTrack.play(videoContainerRef.current);
          }
          agoraSuccess = true;
        }
      } catch (agoraErr: any) {
        console.warn('[Studio] Agora cloud gateway fallback to direct browser WebRTC media:', agoraErr);
      }

      // If Agora RTC cloud gateway is not reachable, activate direct browser camera & microphone
      if (!agoraSuccess) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: true,
        });
        const videoElem = document.createElement('video');
        videoElem.srcObject = stream;
        videoElem.autoplay = true;
        videoElem.playsInline = true;
        videoElem.muted = true;
        videoElem.className = 'w-full h-full object-cover';
        if (videoContainerRef.current) {
          videoContainerRef.current.innerHTML = '';
          videoContainerRef.current.appendChild(videoElem);
        }
        (window as any).__localLiveMediaStream = stream;
      }

      setIsLive(true);
      setError('');

      // System message to chat
      await sendChatMessage({
        sessionId,
        userId: user.id,
        username: 'EgyBay Live',
        message: '🔴 البث المباشر قد انطلق! أهلاً وسهلاً بجميع المشاهدين 🎉',
        isHost: true,
        msgType: 'system',
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to access camera or start stream');
    } finally {
      setStarting(false);
    }
  }, [sessionId, user, session]);

  const [showEndModal, setShowEndModal] = useState(false);
  const [ending, setEnding] = useState(false);

  const handleEndStreamClick = () => {
    setShowEndModal(true);
  };

  const handleConfirmEndStream = useCallback(async () => {
    if (!sessionId) return;
    setEnding(true);
    try {
      if ((window as any).__localLiveMediaStream) {
        (window as any).__localLiveMediaStream.getTracks().forEach((t: any) => t.stop());
      }
      localVideoTrackRef.current?.stop();
      localVideoTrackRef.current?.close();
      localAudioTrackRef.current?.stop();
      localAudioTrackRef.current?.close();
      await clientRef.current?.leave().catch(() => {});
      await endLiveSession(sessionId);
      router.push('/live');
    } catch (err: any) {
      console.error(err);
      setEnding(false);
    }
  }, [sessionId, router]);

  const toggleMic = useCallback(async () => {
    const newState = !micOn;
    if (localAudioTrackRef.current) {
      await localAudioTrackRef.current.setEnabled(newState);
    }
    if ((window as any).__localLiveMediaStream) {
      (window as any).__localLiveMediaStream.getAudioTracks().forEach((t: any) => (t.enabled = newState));
    }
    setMicOn(newState);
  }, [micOn]);

  const toggleCam = useCallback(async () => {
    const newState = !camOn;
    if (localVideoTrackRef.current) {
      await localVideoTrackRef.current.setEnabled(newState);
    }
    if ((window as any).__localLiveMediaStream) {
      (window as any).__localLiveMediaStream.getVideoTracks().forEach((t: any) => (t.enabled = newState));
    }
    setCamOn(newState);
  }, [camOn]);

  const handleSendChat = async (textToSend?: string) => {
    const content = textToSend || chatInput;
    if (!content.trim() || !user || !sessionId) return;
    const msg = content.trim();
    if (!textToSend) setChatInput('');
    setShowEmojiPicker(false);

    await sendChatMessage({
      sessionId,
      userId: user.id,
      username: user.user_metadata?.full_name || 'Host',
      message: msg,
      isHost: true,
      msgType: 'chat',
    });
  };

  const handleSendHostReaction = async (emoji: string) => {
    triggerFloatingParticle(emoji);
    if (!user || !sessionId) return;
    await sendChatMessage({
      sessionId,
      userId: user.id,
      username: user.user_metadata?.full_name || 'Host',
      message: emoji,
      isHost: true,
      msgType: 'reaction',
    });
  };

  // 1-Click Spotlight / Pin with custom Live Deal Price
  const handleSpotlightProduct = async (product: Product) => {
    if (!sessionId) return;
    const customPriceStr = customLivePrices[product.id];
    const livePrice = customPriceStr && Number(customPriceStr) > 0 ? Number(customPriceStr) : product.price;

    await pinProduct(sessionId, product.id, livePrice);
    setPinnedProduct(product);
    setPinnedDisplayPrice(livePrice);
    setInventoryDrawerOpen(false);

    // Announce to chat
    await sendChatMessage({
      sessionId,
      userId: user?.id || 'host',
      username: 'EgyBay Live',
      message: `📌 قام البائع بتثبيت "${product.title}" بسعر خاص ${formatEGP(livePrice)}!`,
      isHost: true,
      msgType: 'pin',
    });
  };

  const handleUnpin = async () => {
    if (!sessionId) return;
    await unpinProduct(sessionId);
    setPinnedProduct(null);
    setPinnedDisplayPrice(null);
  };

  // Format Stopwatch mm:ss
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-slate-950 text-white overflow-hidden select-none">
      {/* ── Main Stream Broadcast Stage ── */}
      <div className="relative flex-1 min-h-[50vh] lg:min-h-0 bg-black flex flex-col justify-between overflow-hidden">
        {/* Video Canvas */}
        <div ref={videoContainerRef} className="w-full h-full absolute inset-0" />

        {/* Floating Reactions Canvas */}
        <FloatingReactions reactions={reactions} onRemove={handleRemoveParticle} />

        {/* Pre-Live Cover Screen */}
        {!isLive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 z-30 p-6 text-center">
            <div className="w-20 h-20 bg-red-600/10 border border-red-500/20 rounded-3xl flex items-center justify-center text-red-500 mb-5 shadow-2xl shadow-red-500/10">
              <Video className="w-10 h-10 animate-pulse" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">
              {isRTL ? 'استوديو البث المباشر — EgyBay Live' : 'Live Seller Studio — EgyBay Live'}
            </h2>
            <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
              {isRTL
                ? 'جهز بضاعتك واضغط على "ابدأ البث المباشر". سيتم تفعيل الكاميرا والمايك وبدء استقبال المشترين فوراً!'
                : 'Prepare your inventory tray and click "Go Live Now". Your camera and microphone will stream to all buyers across Egypt!'}
            </p>

            {error && (
              <div className="mb-5 bg-red-950/80 border border-red-800 text-red-300 text-xs px-4 py-3 rounded-2xl flex items-center gap-2 max-w-md">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleGoLive}
              disabled={starting}
              className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-60 text-white font-black px-9 py-4 rounded-2xl shadow-2xl shadow-red-600/40 flex items-center gap-2.5 text-sm transition-all transform hover:scale-105 active:scale-95"
            >
              {starting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{isRTL ? 'جاري الاتصال بالسيرفر...' : 'Connecting to Live CDN...'}</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 bg-white rounded-full animate-ping" />
                  <span>{isRTL ? 'ابدأ البث المباشر الآن 🔴' : 'Go Live Now 🔴'}</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Live Top HUD Bar */}
        {isLive && (
          <div className="relative z-20 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between gap-3">
            {/* Live Badge & Viewers */}
            <div className="flex items-center gap-2.5">
              <div className="bg-red-600 text-white text-[11px] font-black px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg shadow-red-600/30 animate-pulse">
                <span className="w-2 h-2 bg-white rounded-full" />
                <span>LIVE</span>
              </div>
              <div className="bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>{viewerCount.toLocaleString()}</span>
              </div>
              <div className="bg-black/60 backdrop-blur-md border border-white/10 text-slate-300 text-xs font-mono px-2.5 py-1 rounded-full flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>{formatTimer(durationSeconds)}</span>
              </div>
            </div>

            {/* Sales Revenue Ticker */}
            <div className="bg-gradient-to-r from-emerald-950/80 to-slate-900/80 backdrop-blur-md border border-emerald-500/40 text-white px-3.5 py-1 rounded-full flex items-center gap-2 shadow-lg">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-bold text-slate-300">
                {isRTL ? 'إجمالي المبيعات:' : 'Live Sales:'}
              </span>
              <span className="text-xs font-black text-emerald-400 font-mono">
                {formatEGP(totalSales)}
              </span>
            </div>
          </div>
        )}

        {/* Active Pinned Spotlight Product Card (Overlaid above controls) */}
        {isLive && pinnedProduct && (
          <div className="relative z-20 px-4 pb-2">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-slate-900/90 backdrop-blur-md border border-amber-500/40 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-2xl max-w-lg mx-auto"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-14 rounded-xl bg-slate-950 overflow-hidden flex-shrink-0 border border-slate-700 relative">
                  {pinnedProduct.images?.[0] ? (
                    <img src={pinnedProduct.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBag className="w-6 h-6 text-slate-600 m-auto" />
                  )}
                  <span className="absolute top-1 left-1 bg-red-600 text-white text-[8px] font-black px-1 rounded">
                    PINNED
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] bg-amber-400/20 text-amber-300 font-bold px-1.5 py-0.5 rounded">
                      {isRTL ? 'مثبت للمشترين 📌' : 'Spotlight 📌'}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-white truncate">{pinnedProduct.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm font-black text-emerald-400">
                      {formatEGP(pinnedDisplayPrice || pinnedProduct.price)}
                    </span>
                    {pinnedDisplayPrice && pinnedDisplayPrice < pinnedProduct.price && (
                      <span className="text-[10px] text-slate-500 line-through">
                        {formatEGP(pinnedProduct.price)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setInventoryDrawerOpen(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors flex items-center gap-1"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'تغيير' : 'Swap'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleUnpin}
                  className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Live Bottom Controls Bar */}
        {isLive && (
          <div className="relative z-20 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between gap-3">
            {/* Left: Inventory Tray Button */}
            <button
              onClick={() => setInventoryDrawerOpen(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black px-4 py-3 rounded-2xl flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-transform active:scale-95"
            >
              <Package className="w-4 h-4" />
              <span>{isRTL ? 'معروضات البث (Tray)' : 'Inventory Tray'}</span>
              <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {listings.length}
              </span>
            </button>

            {/* Center Controls: Mic, Cam */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleMic}
                title={micOn ? 'Mute Mic' : 'Unmute Mic'}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${
                  micOn ? 'bg-slate-800/90 text-white hover:bg-slate-700 border border-slate-700' : 'bg-red-600 text-white hover:bg-red-500'
                }`}
              >
                {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>
              <button
                onClick={toggleCam}
                title={camOn ? 'Turn Off Camera' : 'Turn On Camera'}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${
                  camOn ? 'bg-slate-800/90 text-white hover:bg-slate-700 border border-slate-700' : 'bg-red-600 text-white hover:bg-red-500'
                }`}
              >
                {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
            </div>

            {/* Right: End Stream */}
            <button
              onClick={handleEndStreamClick}
              className="bg-red-600 hover:bg-red-700 text-white font-black px-4 py-3 rounded-2xl flex items-center gap-1.5 text-xs shadow-lg shadow-red-600/30 transition-all active:scale-95"
            >
              <PhoneOff className="w-4 h-4" />
              <span>{isRTL ? 'إنهاء البث' : 'End Live'}</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Right Panel: Rich Live Chat & Reactions Engine ── */}
      <div className="w-full lg:w-96 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col h-[48vh] lg:h-full flex-shrink-0">
        {/* Chat Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-black text-white">{isRTL ? 'الدردشة الحية والمبيعات' : 'Live Chat & Events'}</h3>
            <span className="text-[10px] text-slate-500 font-mono">({messages.length})</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full font-bold">
            <Crown className="w-3 h-3 text-amber-400" />
            <span>HOST</span>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-6 space-y-2">
              <Sparkles className="w-8 h-8 text-slate-600" />
              <p className="text-xs">{isRTL ? 'الدردشة نشطة! تفاعل مع المشترين واعرض منتجاتك.' : 'Live chat is active! Greet your audience and pin deals.'}</p>
            </div>
          ) : (
            messages.map(msg => {
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
                        {isRTL ? 'عملية شراء مؤكدة!' : 'NEW LIVE ORDER!'}
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
                    <Pin className="w-4 h-4 text-blue-400 flex-shrink-0" />
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
                <div key={msg.id} className="flex items-start gap-2.5 group">
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
            })
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Quick Emoji Reaction Strip */}
        <div className="px-3 py-2 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar flex-shrink-0">
          {QUICK_EMOJIS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleSendHostReaction(emoji)}
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
              placeholder={isRTL ? 'اكتب رسالة للبث المباشر...' : 'Message the room...'}
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

      {/* ── Run of Show: Inventory Tray Drawer Modal ── */}
      <AnimatePresence>
        {inventoryDrawerOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setInventoryDrawerOpen(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 350 }}
              className="bg-slate-900 border border-slate-800 w-full sm:max-w-xl sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] text-white"
              onClick={e => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                      {isRTL ? 'إدارة معروضات البث المباشر (Run of Show)' : 'Run of Show — Inventory Tray'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {isRTL
                        ? 'حدد سعر البث المخفّض واضغط على تثبيت (Spotlight) لعرض القطعة للشراء الفوري'
                        : 'Set a Live Deal Price & tap Spotlight to push the item to all viewers'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setInventoryDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Items List */}
              <div className="p-4 overflow-y-auto space-y-3 flex-1">
                {listings.length === 0 ? (
                  <div className="p-8 text-center space-y-3">
                    <Package className="w-10 h-10 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400">
                      {isRTL ? 'لا توجد منتجات نشطة في حسابك.' : 'No active listings found in your seller account.'}
                    </p>
                  </div>
                ) : (
                  listings.map(item => {
                    const isCurrentPinned = pinnedProduct?.id === item.id;
                    const customPrice = customLivePrices[item.id] || String(item.price);

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isCurrentPinned
                            ? 'bg-amber-950/30 border-amber-500/60 ring-1 ring-amber-500/40'
                            : 'bg-slate-800/60 border-slate-700/80 hover:border-slate-600'
                        }`}
                      >
                        {/* Product Info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-14 h-14 rounded-xl bg-slate-950 overflow-hidden flex-shrink-0 border border-slate-700">
                            {item.images?.[0] ? (
                              <img src={item.images[0]} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <ShoppingBag className="w-6 h-6 text-slate-600 m-auto" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{item.title}</p>
                            <p className="text-[11px] text-slate-400">
                              {isRTL ? 'السعر الأصلي:' : 'Original Price:'}{' '}
                              <span className="font-bold text-slate-300">{formatEGP(item.price)}</span>
                            </p>
                          </div>
                        </div>

                        {/* Live Price Input & Action */}
                        <div className="flex items-center gap-2.5 flex-shrink-0">
                          <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5">
                            <span className="text-[10px] text-slate-500 font-bold mr-1">EGP</span>
                            <input
                              type="number"
                              value={customPrice}
                              onChange={e =>
                                setCustomLivePrices(prev => ({ ...prev, [item.id]: e.target.value }))
                              }
                              placeholder="Live Price"
                              className="w-20 bg-transparent text-xs font-black text-emerald-400 outline-none"
                            />
                          </div>

                          {isCurrentPinned ? (
                            <button
                              type="button"
                              onClick={handleUnpin}
                              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>{isRTL ? 'إلغاء التثبيت' : 'Unpin'}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSpotlightProduct(item)}
                              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md shadow-blue-600/30 flex items-center gap-1.5 active:scale-95"
                            >
                              <Pin className="w-3.5 h-3.5" />
                              <span>{isRTL ? 'تثبيت بالبث 📌' : 'Spotlight 📌'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── End Live Stream Confirmation Modal ── */}
      <AnimatePresence>
        {showEndModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={() => !ending && setShowEndModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-slate-900 border border-red-500/40 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl text-white"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-red-600/20 border border-red-500/30 rounded-3xl flex items-center justify-center text-red-500 mx-auto shadow-lg shadow-red-600/20">
                <PhoneOff className="w-8 h-8 animate-bounce" />
              </div>

              <div>
                <h4 className="text-lg font-black text-white">
                  {isRTL ? 'إنهاء البث المباشر؟' : 'End Live Stream?'}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  {isRTL
                    ? 'سيتم إغلاق البث وحفظ ملخص المبيعات في لوحة التحكم.'
                    : 'Your stream will be concluded and session recap will be saved.'}
                </p>
              </div>

              {/* Stream Recap Box */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 text-[10px] block">{isRTL ? 'مدة البث' : 'Duration'}</span>
                  <span className="text-white font-black font-mono">{formatTimer(durationSeconds)}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">{isRTL ? 'إجمالي المبيعات' : 'Total Sales'}</span>
                  <span className="text-emerald-400 font-black">{formatEGP(totalSales)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={ending}
                  onClick={() => setShowEndModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl text-xs transition-colors"
                >
                  {isRTL ? 'متابعة البث' : 'Keep Streaming'}
                </button>
                <button
                  type="button"
                  disabled={ending}
                  onClick={handleConfirmEndStream}
                  className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black py-3 rounded-xl text-xs transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-1.5"
                >
                  {ending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{isRTL ? 'جاري الإنهاء...' : 'Ending...'}</span>
                    </>
                  ) : (
                    <span>{isRTL ? 'نعم، إنهاء الآن' : 'Yes, End Now'}</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function StudioPage() {
  return (
    <ProtectedRoute>
      <StudioContent />
    </ProtectedRoute>
  );
}
