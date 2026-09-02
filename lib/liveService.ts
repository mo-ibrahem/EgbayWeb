import { supabase } from './supabase';

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

export type LivePassTier = 'flash' | 'pro' | 'mega';

export interface LivePass {
  tier: LivePassTier;
  name: string;
  name_ar: string;
  durationMinutes: number;
  maxViewers: number;
  priceEGP: number;
  features: string[];
  features_ar: string[];
  badge: string;
  color: string;
  recommended?: boolean;
}

export interface LiveSession {
  id: string;
  seller_id: string;
  title: string;
  title_ar?: string;
  description?: string;
  pass_tier: LivePassTier;
  pass_price_egp: number;
  max_viewers: number;
  agora_channel?: string;
  thumbnail_url?: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  scheduled_at?: string;
  started_at?: string;
  ended_at?: string;
  peak_viewers: number;
  current_viewers: number;
  total_sales_egp: number;
  category?: string;
  created_at: string;
  seller?: {
    full_name?: string;
    avatar_url?: string;
  };
  pinned_products?: LivePinnedProduct[];
}

export interface LivePinnedProduct {
  id: string;
  session_id: string;
  product_id: string;
  display_price?: number;
  pinned_at: string;
  unpinned_at?: string;
  units_sold: number;
  product?: {
    id: string;
    title: string;
    price: number;
    images: string[];
  };
}

export interface LiveChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  username: string;
  message: string;
  is_host: boolean;
  msg_type: 'chat' | 'reaction' | 'system' | 'purchase' | 'pin';
  created_at: string;
}

// ──────────────────────────────────────────────────────────
// Pass Tier Configuration
// ──────────────────────────────────────────────────────────

export const LIVE_PASSES: LivePass[] = [
  {
    tier: 'flash',
    name: 'Flash Pass',
    name_ar: 'باس فلاش',
    durationMinutes: 30,
    maxViewers: 30,
    priceEGP: 79,
    badge: '⚡',
    color: '#F59E0B',
    features: ['30 minutes live', 'Up to 30 viewers', 'Live chat', 'Pin up to 3 products'],
    features_ar: ['بث لمدة ٣٠ دقيقة', 'حتى ٣٠ مشاهد', 'دردشة مباشرة', 'تثبيت ٣ منتجات'],
  },
  {
    tier: 'pro',
    name: 'Pro Show Pass',
    name_ar: 'باس برو',
    durationMinutes: 60,
    maxViewers: 100,
    priceEGP: 149,
    badge: '🔥',
    color: '#3665F3',
    recommended: true,
    features: ['60 minutes live', 'Up to 100 viewers', 'Live chat + reactions', 'Pin up to 10 products', 'Push notification to all users'],
    features_ar: ['بث لمدة ٦٠ دقيقة', 'حتى ١٠٠ مشاهد', 'دردشة وتفاعلات', 'تثبيت ١٠ منتجات', 'إشعار فوري لجميع المستخدمين'],
  },
  {
    tier: 'mega',
    name: 'Mega Event Pass',
    name_ar: 'باس ميجا',
    durationMinutes: 90,
    maxViewers: 300,
    priceEGP: 299,
    badge: '👑',
    color: '#7C3AED',
    features: ['90 minutes live', 'Up to 300 viewers', 'Priority CDN delivery', 'Pin unlimited products', 'Featured on homepage', 'Stream recording saved 30 days'],
    features_ar: ['بث لمدة ٩٠ دقيقة', 'حتى ٣٠٠ مشاهد', 'شبكة توصيل مميزة', 'تثبيت منتجات بلا حدود', 'عرض على الصفحة الرئيسية', 'حفظ التسجيل ٣٠ يوماً'],
  },
];

// ──────────────────────────────────────────────────────────
// Agora Token Generation (via Supabase Edge Function)
// ──────────────────────────────────────────────────────────

export async function generateAgoraToken(channelName: string, uid: number, role: 'host' | 'audience'): Promise<string> {
  // Token minting must happen server-side only: it needs the Agora App
  // Certificate, which must never be present in client-side code.
  const { data, error } = await supabase.functions.invoke('generate-agora-token', {
    body: { channelName, uid, role },
  });
  if (error || !data?.token) {
    console.error('[LiveService] Failed to generate Agora token:', error);
    return '';
  }
  return data.token as string;
}

// ──────────────────────────────────────────────────────────
// Session Management
// ──────────────────────────────────────────────────────────

/**
 * Book a live session. Charging the seller's wallet for the pass fee and
 * creating the session row happen atomically server-side (book_live_session
 * RPC, service-role only) -- the seller id is always taken from the
 * caller's own verified session, never from client input, so nobody can
 * book (and charge) on someone else's behalf.
 */
export async function bookLiveSession(params: {
  title: string;
  titleAr?: string;
  description?: string;
  tier: LivePassTier;
  scheduledAt?: Date;
  category?: string;
  thumbnailUrl?: string;
}): Promise<LiveSession> {
  const { data: { session: authSession } } = await supabase.auth.getSession();
  const token = authSession?.access_token;
  if (!token) throw new Error('Not authenticated');

  const res = await fetch('/api/live/book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: params.title,
      titleAr: params.titleAr,
      description: params.description,
      tier: params.tier,
      category: params.category,
      scheduledAt: params.scheduledAt?.toISOString(),
      thumbnailUrl: params.thumbnailUrl,
    }),
  });

  const json = await res.json().catch(() => ({ success: false, error: 'Invalid server response' }));
  if (!json.success) {
    throw new Error(json.error || 'Failed to book live session');
  }
  return json.session as LiveSession;
}

export async function getLiveSessionById(sessionId: string): Promise<LiveSession | null> {
  const { data, error } = await supabase
    .from('live_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw error;
  return (data as LiveSession) || null;
}

/**
 * Mark session as live and generate Agora host token.
 */
export async function startLiveSession(sessionId: string, sellerUid: number): Promise<{ token: string; channel: string }> {
  const { data: session, error } = await supabase
    .from('live_sessions')
    .update({ status: 'live', started_at: new Date().toISOString() })
    .eq('id', sessionId)
    .select('agora_channel')
    .single();

  if (error || !session) throw error || new Error('Session not found');

  const token = await generateAgoraToken(session.agora_channel, sellerUid, 'host');
  return { token, channel: session.agora_channel };
}

/**
 * End a live session.
 */
export async function endLiveSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('live_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (error) throw error;
}

/**
 * Get Agora audience token for a viewer.
 */
export async function joinLiveSession(channelName: string, viewerUid: number): Promise<string> {
  return generateAgoraToken(channelName, viewerUid, 'audience');
}

// ──────────────────────────────────────────────────────────
// Discovery Feed
// ──────────────────────────────────────────────────────────

export async function getActiveLiveSessions(): Promise<LiveSession[]> {
  const { data, error } = await supabase
    .from('live_sessions')
    .select(`
      *,
      seller:seller_id (full_name, avatar_url),
      pinned_products:live_pinned_products (
        *,
        product:product_id (id, title, price, images)
      )
    `)
    .in('status', ['live', 'scheduled'])
    .order('status', { ascending: false })
    .order('current_viewers', { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data as unknown as LiveSession[]) || [];
}

export async function getSellerSessions(sellerId: string): Promise<LiveSession[]> {
  const { data, error } = await supabase
    .from('live_sessions')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as LiveSession[]) || [];
}

export async function getLiveSessionByChannel(channelName: string): Promise<LiveSession | null> {
  const { data, error } = await supabase
    .from('live_sessions')
    .select(`
      *,
      seller:seller_id (full_name, avatar_url),
      pinned_products:live_pinned_products (
        *,
        product:product_id (id, title, price, images)
      )
    `)
    .eq('agora_channel', channelName)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as LiveSession) || null;
}

// ──────────────────────────────────────────────────────────
// Pinned Products
// ──────────────────────────────────────────────────────────

export async function pinProduct(sessionId: string, productId: string, displayPrice?: number): Promise<void> {
  // Unpin any existing active pin first -- only one product is spotlighted
  // at a time.
  await supabase
    .from('live_pinned_products')
    .update({ unpinned_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .is('unpinned_at', null);

  const { error } = await supabase
    .from('live_pinned_products')
    .insert({ session_id: sessionId, product_id: productId, display_price: displayPrice });

  if (error) throw error;
}

export async function unpinProduct(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('live_pinned_products')
    .update({ unpinned_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .is('unpinned_at', null);

  if (error) throw error;
}

export async function getActivePinnedProduct(sessionId: string): Promise<LivePinnedProduct | null> {
  const { data, error } = await supabase
    .from('live_pinned_products')
    .select(`
      *,
      product:product_id (id, title, price, images)
    `)
    .eq('session_id', sessionId)
    .is('unpinned_at', null)
    .order('pinned_at', { ascending: false })
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as LivePinnedProduct) || null;
}

// ──────────────────────────────────────────────────────────
// Chat Messages & System Events
// ──────────────────────────────────────────────────────────

export async function sendChatMessage(params: {
  sessionId: string;
  userId: string;
  username: string;
  message: string;
  isHost?: boolean;
  msgType?: 'chat' | 'reaction' | 'system' | 'purchase' | 'pin';
}): Promise<void> {
  const { error } = await supabase.from('live_chat_messages').insert({
    session_id: params.sessionId,
    user_id: params.userId,
    username: params.username,
    message: params.message,
    is_host: params.isHost ?? false,
    msg_type: params.msgType ?? 'chat',
  });

  if (error) throw error;
}

export async function getRecentChatMessages(sessionId: string, limit = 50): Promise<LiveChatMessage[]> {
  const { data, error } = await supabase
    .from('live_chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data as LiveChatMessage[]) || [];
}
