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
    const { merchantOrderId, amountCents, txId, isSuccess } = body;

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

      await supabase
        .from('orders')
        .update({ status: 'escrow_secured', updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (ord?.product_id) {
        const { data: prod } = await supabase
          .from('products')
          .select('id, description, status')
          .eq('id', ord.product_id)
          .maybeSingle();

        if (prod) {
          const stockMatch = (prod.description || '').match(/📦\s*Stock:\s*(\d+)/i) || (prod.description || '').match(/الكمية:\s*(\d+)/i);
          const currentStock = stockMatch ? parseInt(stockMatch[1], 10) : 1;
          const remainingStock = currentStock - 1;

          if (remainingStock <= 0) {
            await supabase
              .from('products')
              .update({ status: 'sold', updated_at: new Date().toISOString() })
              .eq('id', ord.product_id);
          } else {
            const updatedDescription = (prod.description || '').replace(
              /📦\s*Stock:\s*\d+/i,
              `📦 Stock: ${remainingStock}`
            );
            await supabase
              .from('products')
              .update({ description: updatedDescription, updated_at: new Date().toISOString() })
              .eq('id', ord.product_id);
          }
        }
      }

      // Credit Seller Escrow Pending Balance in Postgres
      if (ord?.seller_id) {
        const orderAmount = Number(ord.amount || 0);
        const platformCommission = Math.round(orderAmount * 0.04);
        const paymobFee = Math.round((orderAmount * 0.0275) + 3);
        const netEscrowPayout = Math.max(0, orderAmount - platformCommission - paymobFee);

        const { data: sellerWallet } = await supabase
          .from('user_wallets')
          .select('id, pending_balance, available_balance')
          .eq('user_id', ord.seller_id)
          .maybeSingle();

        let walletId = sellerWallet?.id;
        const currentPending = Number(sellerWallet?.pending_balance || 0);
        const newPending = currentPending + netEscrowPayout;

        if (sellerWallet) {
          await supabase
            .from('user_wallets')
            .update({
              pending_balance: newPending,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', ord.seller_id);
        } else {
          const { data: created } = await supabase
            .from('user_wallets')
            .insert({
              user_id: ord.seller_id,
              pending_balance: netEscrowPayout,
              available_balance: 0,
              currency: 'EGP',
            })
            .select()
            .maybeSingle();
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
    let targetUserId = body.targetUserId || body.userId || '';
    if (!targetUserId && String(merchantOrderId).startsWith('topup_')) {
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
