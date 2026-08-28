-- ============================================================
-- EgyBay Live Streaming — Database Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- Live Stream Sessions
CREATE TABLE IF NOT EXISTS live_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id        UUID REFERENCES auth.users(id) NOT NULL,
  title            TEXT NOT NULL,
  title_ar         TEXT,
  description      TEXT,
  pass_tier        TEXT NOT NULL CHECK (pass_tier IN ('flash', 'pro', 'mega')),
  pass_price_egp   INTEGER NOT NULL,
  max_viewers      INTEGER NOT NULL,
  agora_channel    TEXT UNIQUE,
  agora_token      TEXT,
  thumbnail_url    TEXT,
  status           TEXT DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  scheduled_at     TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  peak_viewers     INTEGER DEFAULT 0,
  current_viewers  INTEGER DEFAULT 0,
  total_sales_egp  INTEGER DEFAULT 0,
  wallet_charge_id UUID,
  category         TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Products Pinned During a Live Session
CREATE TABLE IF NOT EXISTS live_pinned_products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES live_sessions(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id),
  display_price INTEGER,
  pinned_at     TIMESTAMPTZ DEFAULT now(),
  unpinned_at   TIMESTAMPTZ,
  units_sold    INTEGER DEFAULT 0
);

-- Live Chat Messages (ephemeral, kept 30 days)
CREATE TABLE IF NOT EXISTS live_chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id),
  username    TEXT,
  message     TEXT NOT NULL,
  is_host     BOOLEAN DEFAULT false,
  msg_type    TEXT DEFAULT 'chat' CHECK (msg_type IN ('chat', 'reaction', 'system')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Row Level Security ──────────────────────────────────────

ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_pinned_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_chat_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can read live/scheduled sessions (discovery feed)
CREATE POLICY "public_read_live_sessions"
  ON live_sessions FOR SELECT
  USING (status IN ('live', 'scheduled'));

-- Only the seller can manage their own session
CREATE POLICY "seller_manage_own_session"
  ON live_sessions FOR ALL
  USING (seller_id = auth.uid());

-- Anyone can read pinned products for active sessions
CREATE POLICY "public_read_pinned_products"
  ON live_pinned_products FOR SELECT
  USING (true);

-- Seller manages pins
CREATE POLICY "seller_manage_pins"
  ON live_pinned_products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM live_sessions s
      WHERE s.id = session_id AND s.seller_id = auth.uid()
    )
  );

-- Anyone authenticated can read and write chat messages
CREATE POLICY "auth_read_chat"
  ON live_chat_messages FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_write_chat"
  ON live_chat_messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- ── Realtime: Enable for all live tables ───────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE live_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE live_pinned_products;
ALTER PUBLICATION supabase_realtime ADD TABLE live_chat_messages;

-- ── Index for performance ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_sessions_seller ON live_sessions(seller_id);
CREATE INDEX IF NOT EXISTS idx_live_chat_session ON live_chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_live_pins_session ON live_pinned_products(session_id);
