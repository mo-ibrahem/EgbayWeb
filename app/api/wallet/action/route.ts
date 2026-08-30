export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://fpqbocohjzwlfcmfropr.supabase.co';

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwcWJvY29oanp3bGZjbWZyb3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5NTkzNDMsImV4cCI6MjA2NDUzNTM0M30.P6atGZ_u0rkbr76qoIBJN5bRGhe2nESQctXoc25d3xU';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
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
    const body = await req.json();
    const { action } = body;

    // Action 1: Deduct Spendable (Wallet Checkout) - Replaced by RPC
    if (action === 'deduct_spendable') {
      const { orderId } = body;
      
      const { error: rpcErr } = await supabaseAdmin.rpc('checkout_with_wallet', {
        p_user_id: userId,
        p_order_id: orderId
      });

      if (rpcErr) {
        return NextResponse.json({ success: false, error: rpcErr.message }, { status: 400 });
      }

      // Fetch the updated balance
      const { data: wallet } = await supabaseAdmin.from('user_wallets').select('available_balance').eq('user_id', userId).single();

      return NextResponse.json({ success: true, remainingBalance: wallet?.available_balance });
    }

    // Action 2: Request Payout - Replaced by RPC
    if (action === 'request_payout') {
      const { amount, payoutMethodId } = body;

      const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('request_wallet_payout', {
        p_user_id: userId,
        p_amount: amount,
        p_payout_method_id: payoutMethodId
      });

      if (rpcErr) {
         return NextResponse.json({ success: false, error: rpcErr.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, txId: rpcData.txId, payoutRequestId: rpcData.payoutRequestId });
    }

    // Action 3: Manual Top-Up (Vodafone Cash / Instapay)
    // Deprecated in favor of Paymob topup process, but left here to prevent 404s if client triggers it.
    // However, user said "Keep Paymob wallet top-ups ... as separate flows" and "no direct client financial mutations".
    // Since manual top-ups directly mutate the balance here, we will block them for security.
    if (action === 'topup_manual') {
       return NextResponse.json({ success: false, error: 'Manual top-ups are disabled for security. Use Paymob.' }, { status: 403 });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[API /api/wallet/action] fatal error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
