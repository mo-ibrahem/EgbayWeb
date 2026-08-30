export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://fpqbocohjzwlfcmfropr.supabase.co';

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwcWJvY29oanp3bGZjbWZyb3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5NTkzNDMsImV4cCI6MjA2NDUzNTM0M30.P6atGZ_u0rkbr76qoIBJN5bRGhe2nESQctXoc25d3xU';

const hmacSecret = process.env.PAYMOB_HMAC_SECRET || '08BCEABC4398ACAFDB82717BC17DE4C9';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const providedHmac = searchParams.get('hmac');

    const bodyText = await req.text();
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    if (!providedHmac) {
      return NextResponse.json({ success: false, error: 'Missing HMAC signature' }, { status: 401 });
    }

    // Paymob HMAC verification logic
    // The HMAC is calculated over specific fields in the obj object
    const obj = body?.obj;
    if (!obj) {
       return NextResponse.json({ success: false, error: 'Invalid Paymob payload' }, { status: 400 });
    }

    const hmacString = [
      obj.amount_cents,
      obj.created_at,
      obj.currency,
      obj.error_occured,
      obj.has_parent_transaction,
      obj.id,
      obj.integration_id,
      obj.is_3d_secure,
      obj.is_auth,
      obj.is_capture,
      obj.is_refunded,
      obj.is_standalone_payment,
      obj.is_voided,
      obj.order?.id,
      obj.owner,
      obj.pending,
      obj.source_data?.pan,
      obj.source_data?.sub_type,
      obj.source_data?.type,
      obj.success,
    ].join('');

    const calculatedHmac = crypto.createHmac('sha512', hmacSecret).update(hmacString).digest('hex');

    if (calculatedHmac !== providedHmac) {
      console.warn('[API wallet/credit] HMAC verification failed', { providedHmac, calculatedHmac });
      return NextResponse.json({ success: false, error: 'Invalid HMAC signature' }, { status: 401 });
    }

    const merchantOrderId = obj.order?.merchant_order_id;
    const amountCents = obj.amount_cents;
    const isSuccess = obj.success;
    const txId = obj.id;

    if (!isSuccess) {
      return NextResponse.json({ success: false, error: 'Transaction not approved' }, { status: 400 });
    }

    // 1. Order payment: ord_<orderId>
    if (String(merchantOrderId).startsWith('ord_')) {
      const orderId = String(merchantOrderId);
      const { data: ord } = await supabase
        .from('orders')
        .select('id, product_id, seller_id, amount')
        .eq('id', orderId)
        .maybeSingle();

      if (!ord) return NextResponse.json({ success: false, error: 'Order not found' });

      await supabase
        .from('orders')
        .update({ status: 'escrow_secured', updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (ord.product_id) {
        const { data: prod } = await supabase.from('products').select('id, description, status').eq('id', ord.product_id).maybeSingle();
        if (prod) {
          const stockMatch = (prod.description || '').match(/📦\s*Stock:\s*(\d+)/i) || (prod.description || '').match(/الكمية:\s*(\d+)/i);
          const currentStock = stockMatch ? parseInt(stockMatch[1], 10) : 1;
          const remainingStock = currentStock - 1;

          if (remainingStock <= 0) {
            await supabase.from('products').update({ status: 'sold', updated_at: new Date().toISOString() }).eq('id', ord.product_id);
          } else {
            const updatedDescription = (prod.description || '').replace(/📦\s*Stock:\s*\d+/i, `📦 Stock: ${remainingStock}`);
            await supabase.from('products').update({ description: updatedDescription, updated_at: new Date().toISOString() }).eq('id', ord.product_id);
          }
        }
      }

      // Credit Seller Escrow
      if (ord.seller_id) {
        const orderAmount = Number(ord.amount || 0);
        const platformCommission = Math.round(orderAmount * 0.04);
        const paymobFee = Math.round((orderAmount * 0.0275) + 3);
        const netEscrowPayout = Math.max(0, orderAmount - platformCommission - paymobFee);

        const { data: sellerWallet } = await supabase.from('user_wallets').select('id, pending_balance').eq('user_id', ord.seller_id).maybeSingle();
        let walletId = sellerWallet?.id;
        if (sellerWallet) {
          await supabase.from('user_wallets').update({ pending_balance: Number(sellerWallet.pending_balance || 0) + netEscrowPayout, updated_at: new Date().toISOString() }).eq('user_id', ord.seller_id);
        } else {
          const { data: created } = await supabase.from('user_wallets').insert({ user_id: ord.seller_id, pending_balance: netEscrowPayout, available_balance: 0, currency: 'EGP' }).select().maybeSingle();
          walletId = created?.id;
        }

        if (walletId) {
          await supabase.from('wallet_transactions').insert({
            wallet_id: walletId,
            order_id: orderId,
            type: 'escrow_hold',
            amount: netEscrowPayout,
            fee_amount: platformCommission + paymobFee,
            status: 'completed',
            description: `Escrow Hold: Order #${orderId.slice(-6).toUpperCase()}`,
            created_at: new Date().toISOString(),
          });
        }
      }
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

    const { data: existingWallet } = await supabase.from('user_wallets').select('id, available_balance').eq('user_id', targetUserId).maybeSingle();
    let walletId = existingWallet?.id;
    const currentBalance = Number(existingWallet?.available_balance || 0);
    const newBalance = currentBalance + amountEgp;

    if (existingWallet) {
      await supabase.from('user_wallets').update({ available_balance: newBalance, updated_at: new Date().toISOString() }).eq('user_id', targetUserId);
    } else {
      const { data: created } = await supabase.from('user_wallets').insert({ user_id: targetUserId, available_balance: amountEgp, pending_balance: 0, currency: 'EGP' }).select().maybeSingle();
      walletId = created?.id;
    }

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

    return NextResponse.json({ success: true, type: 'topup', userId: targetUserId, amountEgp, newBalance });
  } catch (err: any) {
    console.error('[API wallet/credit] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
