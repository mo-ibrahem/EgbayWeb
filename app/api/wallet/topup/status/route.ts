export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://fpqbocohjzwlfcmfropr.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwcWJvY29oanp3bGZjbWZyb3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5NTkzNDMsImV4cCI6MjA2NDUzNTM0M30.P6atGZ_u0rkbr76qoIBJN5bRGhe2nESQctXoc25d3xU';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const topupId = searchParams.get('id');

    if (!topupId) {
      return NextResponse.json({ success: false, error: 'Missing topup ID' }, { status: 400 });
    }

    // 1. Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }

    const authToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: jwtError } = await supabaseAdmin.auth.getUser(authToken);

    if (jwtError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const userId = user.id;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${authToken}` } }
    });

    // 2. Fetch topup status from DB using user's context
    const { data: topup, error } = await userClient
      .from('wallet_topups')
      .select('user_id, status, amount, currency')
      .eq('id', topupId)
      .maybeSingle();

    if (error || !topup) {
      return NextResponse.json({ success: false, error: 'Topup not found' }, { status: 404 });
    }

    // 3. Enforce ownership
    if (topup.user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      status: topup.status,
      amount: topup.amount,
      currency: topup.currency
    });

  } catch (err: any) {
    console.error('[API wallet/topup/status] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
