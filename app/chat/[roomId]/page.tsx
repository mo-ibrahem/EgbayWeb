'use client';

import React, { Suspense, useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Loader2, Trash2, HandCoins } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/components/LanguageProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import { supabase } from '@/lib/supabase';
import { hideChatRoomForUser, sendOffer, respondToOffer, type ChatMessage as Message } from '@/lib/chatService';
import { formatEGP } from '@/lib/products';
import SmartImage from '@/components/SmartImage';

interface ChatDetails {
  other_user_name: string;
  other_user_avatar?: string;
  product?: {
    id: string;
    title: string;
    price: number;
    image?: string;
    sellerId?: string;
  };
}

function timeStr(dateStr: string, isRTL?: boolean) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString(isRTL ? 'ar-EG' : 'en-EG', { hour: '2-digit', minute: '2-digit' });
}

function ChatContent() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { isRTL } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [messages, setMessages] = useState<Message[]>([]);
  const [chatDetails, setChatDetails] = useState<ChatDetails | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Offer mode: the composer sends a whole-EGP price offer instead of text.
  // Opened straight away when the product page links here with ?offer=1.
  const [offerMode, setOfferMode] = useState(searchParams.get('offer') === '1');
  const [sendError, setSendError] = useState('');
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    (async () => {
      try {
        // Get room participants and which item this conversation is about
        const { data: room } = await supabase.from('chat_rooms').select('participant_ids, product_id').eq('id', roomId).single();
        if (!room) { router.push('/profile?tab=chats'); return; }

        const otherId = room.participant_ids.find((p: string) => p !== user.id);
        let product: ChatDetails['product'];
        if (room.product_id) {
          const { data: prod } = await supabase.from('products').select('id, title, price, images, seller_id').eq('id', room.product_id).maybeSingle();
          if (prod) {
            product = { id: prod.id, title: prod.title, price: Number(prod.price), image: prod.images?.[0], sellerId: prod.seller_id };
          }
        }
        if (otherId) {
          const { data: profile } = await supabase.from('public_profiles').select('full_name, avatar_url').eq('id', otherId).single();
          setChatDetails({
            other_user_name: profile?.full_name || (isRTL ? 'مستخدم إيجي باي' : 'EgyBay User'),
            other_user_avatar: profile?.avatar_url,
            product,
          });
        }

        // Load messages
        const { data: msgs } = await supabase.from('messages').select('*').eq('room_id', roomId).order('created_at', { ascending: true });
        setMessages((msgs || []) as Message[]);
      } catch { router.push('/profile?tab=chats'); }
      finally { setLoading(false); }
    })();
  }, [user, authLoading, roomId, router, isRTL]);

  // Subscribe to real-time messages. Only the OTHER participant's
  // messages are added here -- our own sends are already shown
  // optimistically in handleSend and reconciled with the real row once
  // the insert resolves. Adding our own messages again on realtime
  // caused every sent message to render twice: the temp bubble (id
  // `temp-...`) never matched the real row's id, so the dedup check
  // below always failed and both ended up in state.
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        const incoming = payload.new as Message;
        if (incoming.sender_id === user?.id) return;
        setMessages(prev => {
          if (prev.some(m => m.id === incoming.id)) return prev;
          return [...prev, incoming];
        });
      })
      // The recipient's Accept/Decline arrives as an UPDATE -- this is how
      // the sender sees the response without reloading.
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        const updated = payload.new as Message;
        setMessages(prev => prev.map(m => (m.id === updated.id ? { ...m, ...updated } : m)));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, user?.id]);

  // Scroll on new messages
  useEffect(() => { scrollToBottom(); }, [messages]);

  const sendFailureText = (_err: unknown) =>
    isRTL ? 'تعذر الإرسال. حاول مرة أخرى.' : 'Could not send. Please try again.';

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content || !user || sending) return;

    const amount = offerMode ? parseInt(content.replace(/\D/g, ''), 10) : 0;
    if (offerMode && !(amount > 0)) {
      setSendError(isRTL ? 'أدخل المبلغ بالجنيه المصري' : 'Enter an amount in EGP');
      return;
    }

    setSending(true);
    setSendError('');

    if (offerMode) {
      try {
        const row = await sendOffer(roomId, user.id, amount);
        // Our own INSERT is skipped in the realtime handler, so add it here.
        setMessages(prev => (prev.some(m => m.id === row.id) ? prev : [...prev, row]));
        setNewMessage('');
        setOfferMode(false);
      } catch (err) {
        setSendError(sendFailureText(err));
      } finally { setSending(false); }
      return;
    }

    setNewMessage('');
    // Optimistic update
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tempMsg: Message = {
      id: tempId,
      room_id: roomId,
      sender_id: user.id,
      content,
      created_at: new Date().toISOString(),
      msg_type: 'text',
      offer_amount_egp: null,
      offer_status: null,
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({ room_id: roomId, sender_id: user.id, content })
        .select()
        .single();
      if (error || !data) throw error || new Error('No row returned');
      // Replace the temp bubble with the confirmed row (real id, real timestamp).
      setMessages(prev => prev.map(m => (m.id === tempId ? (data as Message) : m)));
    } catch (err) {
      // Not sent: drop the unconfirmed bubble, give the text back and say so.
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(content);
      setSendError(sendFailureText(err));
    }
    finally { setSending(false); inputRef.current?.focus(); }
  };

  const handleRespond = async (messageId: string, response: 'accepted' | 'declined') => {
    if (respondingId) return;
    setRespondingId(messageId);
    setSendError('');
    try {
      await respondToOffer(messageId, response);
      setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, offer_status: response } : m)));
    } catch {
      setSendError(isRTL ? 'تعذر الرد على هذا العرض. ربما تم الرد عليه بالفعل.' : 'Could not respond to this offer. It may already have been answered.');
    } finally { setRespondingId(null); }
  };

  // Delete-for-me: hides this room from the caller's own inbox only --
  // the other participant's copy and the message history are untouched.
  // See hide_chat_room_for_user; a new message from either side
  // resurfaces it automatically.
  const handleDeleteChat = async () => {
    if (!confirm(isRTL ? 'هل تريد حذف هذه المحادثة من قائمتك؟' : 'Delete this conversation from your inbox?')) return;
    setDeleting(true);
    try {
      await hideChatRoomForUser(roomId);
      router.push('/profile?tab=chats');
    } catch (err) {
      console.error('[Chat] Failed to delete chat:', err);
      setDeleting(false);
    }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-136px)] bg-gray-50">
      {/* Chat header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.push('/profile?tab=chats')} className="text-gray-600 hover:text-gray-900 transition-colors">
          <ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
        </button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {chatDetails?.other_user_name?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-900">{chatDetails?.other_user_name || (isRTL ? 'محادثة' : 'Chat')}</p>
          <p className="text-xs text-emerald-500 font-medium">{isRTL ? 'متصل الآن' : 'Active now'}</p>
        </div>
        <button
          onClick={handleDeleteChat}
          disabled={deleting}
          aria-label={isRTL ? 'حذف المحادثة' : 'Delete chat'}
          className="text-gray-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-full transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Item this conversation is about -- every chat room here is
          scoped to one product, so keep it visible for context instead
          of leaving the buyer/seller to remember which listing they're
          discussing. */}
      {chatDetails?.product && (
        <Link
          href={`/products/${chatDetails.product.id}`}
          className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-gray-100 relative overflow-hidden flex-shrink-0">
            {chatDetails.product.image && (
              <SmartImage src={chatDetails.product.image} alt={chatDetails.product.title} fill className="object-cover" sizes="40px" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-gray-900 truncate">{chatDetails.product.title}</p>
            <p className="text-xs text-gray-500">{formatEGP(chatDetails.product.price)}</p>
          </div>
        </Link>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">
              {isRTL ? 'لا توجد رسائل بعد. ابدأ المحادثة الآن!' : 'No messages yet. Start the conversation!'}
            </p>
          </div>
        )}
        {messages.map((msg, idx) => {
          const isMine = msg.sender_id === user?.id;
          const showTime = idx === 0 || (new Date(msg.created_at).getTime() - new Date(messages[idx - 1].created_at).getTime()) > 300000;

          return (
            <div key={msg.id}>
              {showTime && (
                <div className="text-center text-xs text-gray-400 my-2">
                  {new Date(msg.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-EG', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                {msg.msg_type === 'offer' ? (
                  <div className={`max-w-[80%] min-w-[220px] rounded-2xl px-4 py-3 shadow-sm border-2 ${
                    msg.offer_status === 'accepted' ? 'bg-emerald-50 border-emerald-300'
                      : msg.offer_status === 'declined' ? 'bg-gray-50 border-gray-200'
                      : 'bg-amber-50 border-amber-300'
                  }`}>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
                      <HandCoins className="w-3.5 h-3.5" />
                      {isMine ? (isRTL ? 'عرضك' : 'Your offer') : (isRTL ? 'عرض سعر' : 'Price offer')}
                    </p>
                    <p className="text-2xl font-black text-gray-900 mt-1">{formatEGP(Number(msg.offer_amount_egp))}</p>
                    {msg.offer_status === 'pending' ? (
                      isMine ? (
                        <p className="text-xs font-semibold text-amber-700 mt-2">{isRTL ? 'بانتظار الرد' : 'Waiting for a reply'}</p>
                      ) : (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleRespond(msg.id, 'accepted')}
                            disabled={!!respondingId}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold py-2 rounded-xl transition-colors"
                          >{isRTL ? 'قبول' : 'Accept'}</button>
                          <button
                            onClick={() => handleRespond(msg.id, 'declined')}
                            disabled={!!respondingId}
                            className="flex-1 bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-700 border border-gray-300 text-xs font-bold py-2 rounded-xl transition-colors"
                          >{isRTL ? 'رفض' : 'Decline'}</button>
                        </div>
                      )
                    ) : msg.offer_status === 'accepted' ? (
                      <p className="text-xs font-semibold text-emerald-700 mt-2">
                        {chatDetails?.product?.sellerId === user?.id
                          ? (isRTL ? 'تم قبول العرض — رتّب التسليم مع المشتري.' : 'Offer accepted — arrange the handover with the buyer.')
                          : (isRTL ? 'تم قبول العرض — رتّب التسليم مع البائع.' : 'Offer accepted — arrange the handover with the seller.')}
                      </p>
                    ) : (
                      <p className="text-xs font-semibold text-gray-500 mt-2">{isRTL ? 'تم رفض العرض' : 'Offer declined'}</p>
                    )}
                    <p className="text-xs mt-2 text-gray-400">{timeStr(msg.created_at, isRTL)}</p>
                  </div>
                ) : (
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                  isMine
                    ? 'bg-gradient-to-br from-blue-600 to-violet-600 text-white rounded-br-sm'
                    : 'bg-white text-gray-900 border border-gray-100 rounded-bl-sm'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={`text-xs mt-1 ${isMine ? 'text-white/60' : 'text-gray-400'}`}>{timeStr(msg.created_at, isRTL)}</p>
                </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-100 px-4 py-3">
        {sendError && <p role="alert" className="text-xs text-rose-600 font-medium mb-2">{sendError}</p>}
        {offerMode && (
          <p className="text-xs text-gray-500 mb-2">
            {isRTL ? 'العرض اتفاق مبدئي للتسليم المباشر — لا يتم أي دفع عبر التطبيق.' : 'An offer is a handshake for an in-person handover. No payment happens in the app.'}
          </p>
        )}
        <form onSubmit={handleSend} className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setOfferMode(m => !m); setNewMessage(''); setSendError(''); }}
            aria-pressed={offerMode}
            aria-label={isRTL ? 'تقديم عرض سعر' : 'Make an offer'}
            title={isRTL ? 'تقديم عرض سعر' : 'Make an offer'}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 border transition-colors ${
              offerMode ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:text-amber-700'
            }`}
          >
            <HandCoins className="w-5 h-5" />
          </button>
          <input
            ref={inputRef}
            type="text"
            inputMode={offerMode ? 'numeric' : 'text'}
            autoFocus={offerMode}
            value={newMessage}
            onChange={e => setNewMessage(offerMode ? e.target.value.replace(/\D/g, '') : e.target.value)}
            placeholder={offerMode ? (isRTL ? 'عرضك بالجنيه المصري' : 'Your offer in EGP') : (isRTL ? 'اكتب رسالتك هنا...' : 'Type a message...')}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            aria-label={offerMode ? (isRTL ? 'إرسال العرض' : 'Send offer') : (isRTL ? 'إرسال' : 'Send')}
            className="w-11 h-11 bg-gradient-to-br from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 disabled:opacity-40 text-white rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm shadow-blue-500/30"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={null}>
        <ChatContent />
      </Suspense>
    </ProtectedRoute>
  );
}
