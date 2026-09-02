export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/adminAuth';

// Financial mutation endpoint -- must run with the real service role or
// not at all. No anon-key fallback: a silent downgrade here would let
// RLS quietly gate operations that are supposed to be server-authoritative.
const supabaseAdmin = createSupabaseAdmin();

// Books a live session: charges the seller's wallet for the pass tier and
// creates the live_sessions row atomically via book_live_session (see
// migration 20260901234137). p_seller_id is always the verified caller's
// own id -- never taken from the request body -- so a client can never
// book (and charge) on someone else's behalf.
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: jwtError } = await supabaseAdmin.auth.getUser(token);
    if (jwtError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { title, titleAr, description, tier, category, scheduledAt, thumbnailUrl } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 });
    }
    if (!['flash', 'pro', 'mega'].includes(tier)) {
      return NextResponse.json({ success: false, error: 'Invalid live pass tier' }, { status: 400 });
    }

    const { data: session, error } = await supabaseAdmin.rpc('book_live_session', {
      p_seller_id: user.id,
      p_title: title.trim(),
      p_title_ar: titleAr || null,
      p_description: description || null,
      p_tier: tier,
      p_category: category || null,
      p_scheduled_at: scheduledAt || null,
      p_thumbnail_url: thumbnailUrl || null,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, session });
  } catch (err: any) {
    console.error('[API /api/live/book] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
