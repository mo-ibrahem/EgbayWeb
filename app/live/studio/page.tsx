'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Users, MessageSquare,
  Package, ChevronUp, Send, Pin, X, ShoppingBag, Zap, AlertCircle
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  startLiveSession, endLiveSession, pinProduct, unpinProduct,
  sendChatMessage, getRecentChatMessages,
  type LiveSession, type LiveChatMessage
} from '@/lib/liveService';
import { productService, type Product } from '@/lib/products';
import { supabase } from '@/lib/supabase';

// Dynamic import of Agora SDK to avoid SSR issues
let AgoraRTC: any = null;

function StudioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  const { user } = useAuth();
  const { isRTL } = useLanguage();

  const [session, setSession] = useState<LiveSession | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [listings, setListings] = useState<Product[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [pinnedProduct, setPinnedProduct] = useState<Product | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  // Agora refs
  const clientRef = useRef<any>(null);
  const localVideoTrackRef = useRef<any>(null);
  const localAudioTrackRef = useRef<any>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Load session + listings
  useEffect(() => {
    if (!sessionId || !user) return;
    (async () => {
      const { data } = await supabase
        .from('live_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      if (data) setSession(data as LiveSession);

      const prods = await productService.getProductsBySeller(user.id);
      setListings((prods ?? []).filter((p: Product) => p.status === 'active'));

      const msgs = await getRecentChatMessages(sessionId);
      setMessages(msgs);
    })();
  }, [sessionId, user]);

  // Realtime: viewer count + chat
  useEffect(() => {
    if (!sessionId) return;

    const sessionSub = supabase
      .channel(`studio_session_${sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_sessions', filter: `id=eq.${sessionId}` }, payload => {
        setViewerCount(payload.new.current_viewers ?? 0);
      })
      .subscribe();

    const chatSub = supabase
      .channel(`studio_chat_${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_chat_messages', filter: `session_id=eq.${sessionId}` }, payload => {
        setMessages(prev => [...prev.slice(-99), payload.new as LiveChatMessage]);
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sessionSub);
      supabase.removeChannel(chatSub);
    };
  }, [sessionId]);

  const handleGoLive = useCallback(async () => {
    if (!sessionId || !user || !session) return;
    setStarting(true);
    setError('');

    try {
      // Load Agora SDK dynamically (client-only)
      if (!AgoraRTC) {
        const mod = await import('agora-rtc-sdk-ng');
        AgoraRTC = mod.default;
      }

      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID!;
      const { token, channel } = await startLiveSession(sessionId, Math.floor(Math.random() * 1000000));

      const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
      await client.setClientRole('host');
      clientRef.current = client;

      await client.join(appId, channel, token, null);

      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      localAudioTrackRef.current = audioTrack;
      localVideoTrackRef.current = videoTrack;

      await client.publish([audioTrack, videoTrack]);

      if (videoContainerRef.current) {
        videoTrack.play(videoContainerRef.current);
      }

      setIsLive(true);

      // System message to chat
      await sendChatMessage({
        sessionId,
        userId: user.id,
        username: 'EgyBay System',
        message: '🔴 البث المباشر قد انطلق! الترحيب بالجميع 🎉',
        isHost: true,
        msgType: 'system',
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to start stream');
    } finally {
      setStarting(false);
    }
  }, [sessionId, user, session]);

  const handleEndStream = useCallback(async () => {
    if (!sessionId || !confirm('Are you sure you want to end the live stream?')) return;
    try {
      localVideoTrackRef.current?.stop();
      localVideoTrackRef.current?.close();
      localAudioTrackRef.current?.stop();
      localAudioTrackRef.current?.close();
      await clientRef.current?.leave();
      await endLiveSession(sessionId);
      router.push('/live');
    } catch (err: any) {
      console.error(err);
    }
  }, [sessionId, router]);

  const toggleMic = useCallback(async () => {
    if (localAudioTrackRef.current) {
      const newState = !micOn;
      await localAudioTrackRef.current.setEnabled(newState);
      setMicOn(newState);
    }
  }, [micOn]);

  const toggleCam = useCallback(async () => {
    if (localVideoTrackRef.current) {
      const newState = !camOn;
      await localVideoTrackRef.current.setEnabled(newState);
      setCamOn(newState);
    }
  }, [camOn]);

  const handleSendChat = async () => {
    if (!chatInput.trim() || !user || !sessionId) return;
    const msg = chatInput.trim();
    setChatInput('');
    await sendChatMessage({
      sessionId,
      userId: user.id,
      username: user.user_metadata?.full_name || 'Host',
      message: msg,
      isHost: true,
    });
  };

  const handlePinProduct = async (product: Product) => {
    if (!sessionId) return;
    await pinProduct(sessionId, product.id, product.price);
    setPinnedProduct(product);
    setShowProductPicker(false);
  };

  const handleUnpin = async () => {
    if (!sessionId) return;
    await unpinProduct(sessionId);
    setPinnedProduct(null);
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-950 text-white overflow-hidden">
      {/* ── Main Video Feed ── */}
      <div className="relative flex-1 min-h-[55vh] lg:min-h-0 bg-black">
        <div ref={videoContainerRef} className="w-full h-full" />

        {!isLive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/95">
            <Video className="w-12 h-12 text-gray-600 mb-4" />
            <p className="text-gray-400 text-sm mb-6">
              {isRTL ? 'الكاميرا ستبدأ عند انطلاق البث' : 'Camera preview will appear when you go live'}
            </p>
            {error && (
              <div className="mb-4 bg-red-900/50 border border-red-700 text-red-300 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            <button
              onClick={handleGoLive}
              disabled={starting}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-black px-8 py-4 rounded-2xl shadow-xl shadow-red-900/40 flex items-center gap-2 text-sm transition-all"
            >
              {starting ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {isRTL ? 'جاري الاتصال...' : 'Connecting...'}</>
              ) : (
                <><span className="w-2.5 h-2.5 bg-white rounded-full" /> {isRTL ? 'ابدأ البث المباشر الآن 🔴' : 'Go Live Now 🔴'}</>
              )}
            </button>
          </div>
        )}

        {/* Live Overlay */}
        {isLive && (
          <>
            {/* Top Bar */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-red-600 text-white text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 bg-white rounded-full" /> LIVE
                </div>
                <div className="bg-black/60 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  {viewerCount.toLocaleString()}
                </div>
              </div>
              <div className="bg-black/60 text-white text-xs px-3 py-1 rounded-full font-bold">
                {session?.title?.slice(0, 30)}{(session?.title?.length ?? 0) > 30 ? '...' : ''}
              </div>
            </div>

            {/* Pinned Product Card */}
            {pinnedProduct && (
              <div className="absolute bottom-20 left-4 right-4 bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl p-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gray-800 overflow-hidden flex-shrink-0">
                  {pinnedProduct.images?.[0] && <img src={pinnedProduct.images[0]} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{pinnedProduct.title}</p>
                  <p className="text-sm font-black text-blue-400">{pinnedProduct.price.toLocaleString()} EGP</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-[#3665F3] text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                    <ShoppingBag className="w-3 h-3" /> {isRTL ? 'اشترِ' : 'BUY'}
                  </div>
                  <button onClick={handleUnpin} className="text-gray-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Controls */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-center gap-4">
              <button
                onClick={toggleMic}
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${micOn ? 'bg-white/20 backdrop-blur-md hover:bg-white/30' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>
              <button
                onClick={toggleCam}
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${camOn ? 'bg-white/20 backdrop-blur-md hover:bg-white/30' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setShowProductPicker(true)}
                className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center shadow-lg transition-all"
              >
                <Pin className="w-5 h-5" />
              </button>
              <button
                onClick={handleEndStream}
                className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-xl transition-all"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Right Panel: Chat ── */}
      <div className="w-full lg:w-80 border-l border-gray-800 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-bold">{isRTL ? 'الدردشة الحية' : 'Live Chat'}</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-2 ${msg.msg_type === 'system' ? 'justify-center' : ''}`}>
              {msg.msg_type === 'system' ? (
                <span className="text-[10px] text-gray-500 italic">{msg.message}</span>
              ) : (
                <>
                  <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${msg.is_host ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                    {msg.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <span className={`text-[10px] font-bold ${msg.is_host ? 'text-red-400' : 'text-gray-400'}`}>
                      {msg.is_host ? '🎙️ ' : ''}{msg.username}
                    </span>
                    <p className="text-xs text-gray-200 leading-relaxed">{msg.message}</p>
                  </div>
                </>
              )}
            </div>
          ))}
          <div ref={chatBottomRef} />
        </div>

        {/* Chat Input */}
        <div className="p-3 border-t border-gray-800 flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendChat()}
            placeholder={isRTL ? 'اكتب رسالة...' : 'Say something...'}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-blue-600"
          />
          <button
            onClick={handleSendChat}
            className="w-8 h-8 bg-[#3665F3] hover:bg-[#2B54D4] rounded-xl flex items-center justify-center transition-colors"
          >
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>

      {/* Product Picker Modal */}
      {showProductPicker && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setShowProductPicker(false)}>
          <div className="bg-gray-900 rounded-3xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-black text-white flex items-center gap-2">
                <Pin className="w-4 h-4 text-blue-400" />
                {isRTL ? 'تثبيت منتج على الشاشة' : 'Pin Product to Screen'}
              </h3>
              <button onClick={() => setShowProductPicker(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {listings.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">
                  {isRTL ? 'لا توجد إعلانات نشطة في متجرك.' : 'No active listings in your store.'}
                </p>
              ) : listings.map(p => (
                <button
                  key={p.id}
                  onClick={() => handlePinProduct(p)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 transition-colors text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-gray-800 overflow-hidden flex-shrink-0">
                    {p.images?.[0] && <img src={p.images[0]} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{p.title}</p>
                    <p className="text-sm font-black text-blue-400">{p.price.toLocaleString()} EGP</p>
                  </div>
                  <Pin className="w-4 h-4 text-gray-500" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudioPage() {
  return (
    <ProtectedRoute>
      <React.Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /></div>}>
        <StudioContent />
      </React.Suspense>
    </ProtectedRoute>
  );
}
