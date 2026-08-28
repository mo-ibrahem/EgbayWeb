'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import { supabase } from '@/lib/supabase';

interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface ChatDetails {
  other_user_name: string;
  other_user_avatar?: string;
}

function timeStr(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' });
}

function ChatContent() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [chatDetails, setChatDetails] = useState<ChatDetails | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
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
        // Get room participants
        const { data: room } = await supabase.from('chat_rooms').select('participant_ids').eq('id', roomId).single();
        if (!room) { router.push('/profile?tab=chats'); return; }

        const otherId = room.participant_ids.find((p: string) => p !== user.id);
        if (otherId) {
          const { data: profile } = await supabase.from('user_profiles').select('full_name, avatar_url').eq('id', otherId).single();
          setChatDetails({
            other_user_name: profile?.full_name || 'Unknown User',
            other_user_avatar: profile?.avatar_url,
          });
        }

        // Load messages
        const { data: msgs } = await supabase.from('messages').select('*').eq('room_id', roomId).order('created_at', { ascending: true });
        setMessages((msgs || []) as Message[]);
      } catch { router.push('/profile?tab=chats'); }
      finally { setLoading(false); }
    })();
  }, [user, authLoading, roomId, router]);

  // Subscribe to real-time messages
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new as Message];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  // Scroll on new messages
  useEffect(() => { scrollToBottom(); }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content || !user || sending) return;

    setSending(true);
    setNewMessage('');

    // Optimistic update
    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      room_id: roomId,
      sender_id: user.id,
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      await supabase.from('messages').insert({ room_id: roomId, sender_id: user.id, content });
    } catch { /* ignore — real-time will sync */ }
    finally { setSending(false); inputRef.current?.focus(); }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-136px)] bg-gray-50">
      {/* Chat header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-4 shadow-sm">
        <button onClick={() => router.push('/profile?tab=chats')} className="text-gray-600 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {chatDetails?.other_user_name?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-gray-900">{chatDetails?.other_user_name || 'Chat'}</p>
          <p className="text-xs text-emerald-500 font-medium">Active now</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        )}
        {messages.map((msg, idx) => {
          const isMine = msg.sender_id === user?.id;
          const showTime = idx === 0 || (new Date(msg.created_at).getTime() - new Date(messages[idx - 1].created_at).getTime()) > 300000;

          return (
            <div key={msg.id}>
              {showTime && (
                <div className="text-center text-xs text-gray-400 my-2">
                  {new Date(msg.created_at).toLocaleDateString('en-EG', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                  isMine
                    ? 'bg-gradient-to-br from-blue-600 to-violet-600 text-white rounded-br-sm'
                    : 'bg-white text-gray-900 border border-gray-100 rounded-bl-sm'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={`text-xs mt-1 ${isMine ? 'text-white/60' : 'text-gray-400'}`}>{timeStr(msg.created_at)}</p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-100 px-4 py-3">
        <form onSubmit={handleSend} className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="w-11 h-11 bg-gradient-to-br from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 disabled:opacity-40 text-white rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm shadow-blue-500/30"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <ChatContent />
    </ProtectedRoute>
  );
}
