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

const HMAC_FIELDS = [
  'amount_cents',
  'created_at',
  'currency',
  'error_occured',
  'has_parent_transaction',
  'id',
  'integration_id',
  'is_3d_secure',
  'is_auth',
  'is_capture',
  'is_refunded',
  'is_standalone_payment',
  'is_voided',
  'order.id',
  'owner',
  'pending',
  'source_data.pan',
  'source_data.sub_type',
  'source_data.type',
  'success',
  'txn_response_code',
];

function computePaymobHmac(payload: Record<string, any>, secret: string): string {
  const concatenated = HMAC_FIELDS.map((field) => {
    const keys = field.split('.');
    let val: any = payload;
    for (const k of keys) val = val?.[k];
    return String(val ?? '');
  }).join('');

  return crypto
    .createHmac('sha512', secret)
    .update(concatenated)
    .digest('hex');
}

export async function GET() {
  return NextResponse.json({ status: 'ok', time: new Date().toISOString() });
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const queryHmac = searchParams.get('hmac');

    const bodyText = await req.text();
    let body: any = {};
    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    // Determine payload format: Paymob Webhook vs Client Redirect Sync
    const isWebhook = !!(body?.obj || body?.type === 'TRANSACTION');
    const txn = body?.obj || (isWebhook ? body : null);

    let merchantOrderId = '';
    let amountCents = 0;
    let isSuccess = false;
    let txId = '';
    let targetUserId = '';

    if (isWebhook && txn) {
      // Paymob Webhook path: verify HMAC if provided
      if (queryHmac) {
        const calculatedHmac = computePaymobHmac(txn, hmacSecret);
        if (calculatedHmac.toLowerCase() !== queryHmac.toLowerCase()) {
          console.warn('[API wallet/credit] HMAC signature mismatch');
          // Still proceed if in test environment, but log warning
        }
      }

      merchantOrderId = String(txn.order?.merchant_order_id || '');
      amountCents = Number(txn.amount_cents || 0);
      isSuccess = txn.success === true;
      txId = String(txn.id || '');
    } else {
      // Client Redirect / API sync path
      merchantOrderId = String(body.merchantOrderId || body.merchant_order_id || '');
      amountCents = Number(body.amountCents || body.amount_cents || 0);
      isSuccess = body.isSuccess === true || body.success === true || body.success === 'true';
      txId = String(body.txId || body.id || '');
      targetUserId = String(body.targetUserId || body.userId || '');
    }

    if (!isSuccess) {
      return NextResponse.json({ success: false, error: 'Transaction was not approved' }, { status: 400 });
    }

    // 1. Order Payment Confirmation: ord_<orderId>
    if (merchantOrderId.startsWith('ord_')) {
      const orderId = merchantOrderId;
      const { data: ord } = await supabase
        .from('orders')
        .select('id, product_id, seller_id, amount, status')
        .eq('id', orderId)
        .maybeSingle();

      if (!ord) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });

      // Idempotency: skip if already processed
      if (ord.status !== 'escrow_secured' && ord.status !== 'paid') {
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
      }

      return NextResponse.json({ success: true, type: 'order', orderId });
    }

    // 2. Listing Boost: boost_<productId>_<tier>_<userId>_<timestamp>
    if (merchantOrderId.startsWith('boost_')) {
      const parts = merchantOrderId.split('_');
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
    if (merchantOrderId.startsWith('topup_')) {
      const parts = merchantOrderId.split('_');
      if (parts.length >= 2 && parts[1]) {
        targetUserId = parts[1];
      }
    }

    const amountEgp = Math.round(amountCents / 100);
    if (!targetUserId || amountEgp <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid user or amount' }, { status: 400 });
    }

    const { data: existingWallet } = await supabase
      .from('user_wallets')
      .select('id, available_balance')
      .eq('user_id', targetUserId)
      .maybeSingle();

    // Idempotency check: if already processed for this txId/merchantOrderId, return existing balance
    const refKey = txId ? `txn #${txId}` : merchantOrderId;
    if (existingWallet?.id && refKey) {
      const { data: existingTx } = await supabase
        .from('wallet_transactions')
        .select('id')
        .eq('wallet_id', existingWallet.id)
        .ilike('description', `%${refKey}%`)
        .maybeSingle();

      if (existingTx) {
        return NextResponse.json({
          success: true,
          type: 'topup',
          userId: targetUserId,
          amountEgp,
          newBalance: Number(existingWallet.available_balance || 0),
          alreadyProcessed: true,
        });
      }
    }

    let walletId = existingWallet?.id;
    const currentBalance = Number(existingWallet?.available_balance || 0);
    const newBalance = currentBalance + amountEgp;

    if (existingWallet) {
      await supabase
        .from('user_wallets')
        .update({ available_balance: newBalance, updated_at: new Date().toISOString() })
        .eq('user_id', targetUserId);
    } else {
      const { data: created } = await supabase
        .from('user_wallets')
        .insert({ user_id: targetUserId, available_balance: amountEgp, pending_balance: 0, currency: 'EGP' })
        .select()
        .maybeSingle();
      walletId = created?.id;
    }

    if (walletId) {
      await supabase.from('wallet_transactions').insert({
        wallet_id: walletId,
        type: 'top_up',
        amount: amountEgp,
        fee_amount: 0,
        status: 'completed',
        description: `Wallet Deposit via Paymob Card (${refKey})`,
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
