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

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, userId } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    // Action 1: Deduct Spendable (Wallet Checkout)
    if (action === 'deduct_spendable') {
      const { orderId, itemTitle } = body;

      // SECURITY FIX: Fetch the hardened amount from the database
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .select('amount, notes')
        .eq('id', orderId)
        .maybeSingle();

      if (orderErr || !orderData) {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
      }

      let notesData: any = {};
      try {
        notesData = typeof orderData.notes === 'string' ? JSON.parse(orderData.notes) : orderData.notes || {};
      } catch {}
      
      const amount = Number(notesData.amount || orderData.amount || 0);

      if (amount <= 0) {
        return NextResponse.json({ success: false, error: 'Invalid order amount' }, { status: 400 });
      }

      const { data: wallet } = await supabase
        .from('user_wallets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      const available = Number(wallet?.available_balance || 0);

      if (!wallet || available < amount) {
        return NextResponse.json({ success: false, error: 'Insufficient wallet balance' }, { status: 400 });
      }

      const newAvailable = available - amount;

      await supabase
        .from('user_wallets')
        .update({
          available_balance: newAvailable,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('user_id', userId);

      await supabase.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        order_id: orderId,
        type: 'fee_deduction',
        amount: -amount,
        fee_amount: 0,
        status: 'completed',
        description: `Purchase: ${itemTitle || 'Marketplace Item'} (Wallet Checkout)`,
        created_at: new Date().toISOString(),
      } as any);

      return NextResponse.json({ success: true, remainingBalance: newAvailable });
    }

    // Action 2: Request Payout
    if (action === 'request_payout') {
      const { amount, payoutMethodId, payoutMethodIdentifier } = body;

      const { data: wallet } = await supabase
        .from('user_wallets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      const available = Number(wallet?.available_balance || 0);

      if (!wallet || available < amount) {
        return NextResponse.json({ success: false, error: 'Insufficient wallet balance' }, { status: 400 });
      }

      const newAvailable = available - amount;
      const txId = `payout_${Date.now()}`;

      await supabase
        .from('user_wallets')
        .update({
          available_balance: newAvailable,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('user_id', userId);

      await supabase.from('wallet_transactions').insert({
        id: txId,
        wallet_id: wallet.id,
        type: 'payout',
        amount: -amount,
        fee_amount: 0,
        status: 'pending',
        description: `Payout to ${payoutMethodIdentifier || 'Saved Method'}`,
        created_at: new Date().toISOString(),
      } as any);

      return NextResponse.json({ success: true, txId });
    }

    // Action 3: Manual Top-Up (Vodafone Cash / Instapay)
    if (action === 'topup_manual') {
      const { amount, paymentMethod } = body;

      const { data: wallet } = await supabase
        .from('user_wallets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      let walletId = wallet?.id;
      const newAvailable = Number(wallet?.available_balance || 0) + amount;

      if (wallet) {
        await supabase
          .from('user_wallets')
          .update({
            available_balance: newAvailable,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('user_id', userId);
      } else {
        const { data: created } = await supabase.from('user_wallets').insert({
          user_id: userId,
          pending_balance: 0,
          available_balance: amount,
          currency: 'EGP',
        } as any).select().maybeSingle();
        walletId = created?.id;
      }

      if (walletId) {
        await supabase.from('wallet_transactions').insert({
          wallet_id: walletId,
          type: 'top_up',
          amount: amount,
          fee_amount: 0,
          status: 'completed',
          description: `Wallet Deposit via ${paymentMethod === 'vodafone_cash' ? 'Vodafone Cash' : paymentMethod === 'instapay' ? 'InstaPay' : 'Card'}`,
          created_at: new Date().toISOString(),
        } as any);
      }

      return NextResponse.json({ success: true, newBalance: newAvailable });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[API /api/wallet/action] fatal error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
