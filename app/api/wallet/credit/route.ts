import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fpqbocohjzwlfcmfropr.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { merchantOrderId, amountCents, txId, isSuccess } = body;

    if (!isSuccess) {
      return NextResponse.json({ success: false, error: 'Transaction not approved' }, { status: 400 });
    }

    // 1. Order payment: ord_<orderId>
    if (String(merchantOrderId).startsWith('ord_')) {
      const orderId = String(merchantOrderId);
      await supabase
        .from('orders')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('id', orderId);

      return NextResponse.json({ success: true, type: 'order', orderId });
    }

    // 2. Listing Boost: boost_<productId>_<tier>_<userId>_<timestamp>
    if (String(merchantOrderId).startsWith('boost_')) {
      const parts = String(merchantOrderId).split('_');
      const productId = parts[1];
      const tier = parts[2] || 'featured';
      const daysMap: Record<string, number> = { urgent: 3, featured: 7, turbo: 14 };
      const days = daysMap[tier] || 7;
      const promotedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      await supabase
        .from('products')
        .update({
          is_promoted: true,
          promotion_tier: tier,
          promoted_until: promotedUntil,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId);

      return NextResponse.json({ success: true, type: 'boost', productId, tier });
    }

    // 3. Wallet Top-Up Deposit: topup_<userId>_<timestamp>
    let targetUserId = '';
    if (String(merchantOrderId).startsWith('topup_')) {
      const parts = String(merchantOrderId).split('_');
      if (parts.length >= 2 && parts[1]) {
        targetUserId = parts[1];
      }
    }

    const amountEgp = Math.round(Number(amountCents || 0) / 100);
    if (!targetUserId || amountEgp <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid user or amount' }, { status: 400 });
    }

    // Check if wallet exists, or create it
    const { data: existingWallet } = await supabase
      .from('user_wallets')
      .select('id, available_balance')
      .eq('user_id', targetUserId)
      .maybeSingle();

    let walletId = existingWallet?.id;
    const currentBalance = Number(existingWallet?.available_balance || 0);
    const newBalance = currentBalance + amountEgp;

    if (existingWallet) {
      await supabase
        .from('user_wallets')
        .update({
          available_balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', targetUserId);
    } else {
      const { data: created } = await supabase
        .from('user_wallets')
        .insert({
          user_id: targetUserId,
          available_balance: amountEgp,
          pending_balance: 0,
          currency: 'EGP',
        })
        .select()
        .maybeSingle();
      walletId = created?.id;
    }

    // Audit log in ledger
    if (walletId) {
      await supabase.from('wallet_transactions').insert({
        wallet_id: walletId,
        type: 'top_up',
        amount: amountEgp,
        fee_amount: 0,
        status: 'completed',
        description: `Wallet Deposit via Paymob Card (Ref: ${txId || merchantOrderId})`,
        created_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      type: 'topup',
      userId: targetUserId,
      amountEgp,
      newBalance,
    });
  } catch (err: any) {
    console.error('[API wallet/credit] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
