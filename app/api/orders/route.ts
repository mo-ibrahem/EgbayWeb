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

// GET: Fetch all orders for a user (as buyer OR seller) with full product details
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('orders')
      .select('*, products(*)')
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[API /api/orders GET] error:', error);
      // Fallback query without join
      const { data: simpleOrders } = await supabase
        .from('orders')
        .select('*')
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      const mapped = (simpleOrders || []).map((order: any) => {
        let notesData: any = {};
        try {
          notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes || {};
        } catch {}

        return {
          id: order.id,
          product_id: order.product_id,
          buyer_id: order.buyer_id,
          seller_id: order.seller_id,
          amount: notesData.amount || order.amount || 0,
          currency: 'EGP',
          status: order.status,
          handover_method: notesData.handover_method || 'courier',
          meetup_pin: notesData.meetup_pin,
          shipping_address: order.shipping_address,
          product: notesData.product || undefined,
          tracking_number: notesData.tracking_number,
          courier_name: notesData.courier_name || 'Bosta Express (بوسطة مصر)',
          created_at: order.created_at,
          updated_at: order.updated_at,
        };
      });

      return NextResponse.json({ success: true, orders: mapped });
    }

    const mapped = (data || []).map((order: any) => {
      let notesData: any = {};
      try {
        notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes || {};
      } catch {}

      const productObj = notesData.product || (order.products ? {
        id: order.products.id,
        title: order.products.title,
        price: order.products.price,
        images: order.products.images || [],
        condition: order.products.condition || 'Used',
        category: order.products.category || 'General',
      } : undefined);

      return {
        id: order.id,
        product_id: order.product_id,
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        amount: notesData.amount || order.amount || 0,
        currency: 'EGP',
        status: order.status,
        handover_method: notesData.handover_method || 'courier',
        meetup_pin: notesData.meetup_pin,
        shipping_address: order.shipping_address,
        product: productObj,
        tracking_number: notesData.tracking_number,
        courier_name: notesData.courier_name || 'Bosta Express (بوسطة مصر)',
        created_at: order.created_at,
        updated_at: order.updated_at,
      };
    });

    return NextResponse.json({ success: true, orders: mapped });
  } catch (err: any) {
    console.error('[API /api/orders GET] fatal error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Create or Confirm an order server-side with full admin rights
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, orderData, orderId } = body;

    // Action 1: Create Order
    if (action === 'create' && orderData) {
      const generatedOrderId = orderData.id || `ord_${Date.now()}`;
      const randomPin = Math.floor(100000 + Math.random() * 900000).toString();

      const insertPayload = {
        id: generatedOrderId,
        product_id: orderData.product_id,
        buyer_id: orderData.buyer_id,
        seller_id: orderData.seller_id,
        status: 'pending_payment',
        notes: JSON.stringify({
          handover_method: orderData.handover_method || 'courier',
          meetup_pin: randomPin,
          amount: orderData.amount,
          courier_name: 'Bosta Express',
          product: orderData.product_snapshot,
        }),
        shipping_address: orderData.shipping_address,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('orders')
        .insert(insertPayload)
        .select()
        .maybeSingle();

      if (error) {
        console.error('[API /api/orders create] error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        order: {
          ...orderData,
          id: generatedOrderId,
          meetup_pin: randomPin,
          status: 'pending_payment',
          product: orderData.product_snapshot,
        },
      });
    }

    // Action 2: Release Escrow to Seller (triggered by Buyer approval or Seller PIN verification)
    if (action === 'release_escrow' && orderId) {
      const { requesterId, pin } = body;

      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (orderErr || !order) {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
      }

      let notesData: any = {};
      try {
        notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes || {};
      } catch {}

      const totalAmount = Number(notesData.amount || order.amount || 0);
      const isBuyerApproval = requesterId && requesterId === order.buyer_id;
      const isPinMatch = pin && String(pin).trim() === String(notesData.meetup_pin || '').trim();

      if (!isBuyerApproval && !isPinMatch) {
        return NextResponse.json({ success: false, error: 'Unauthorized or invalid PIN' }, { status: 403 });
      }

      // Update Order Status to Completed
      await supabase
        .from('orders')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', orderId);

      // Calculate net payout (deduct 3.5% commission + 2.75% + 3 EGP processing fee)
      const commission = Math.round(totalAmount * 0.035);
      const paymobFee = Math.round(totalAmount * 0.0275 + 3);
      const netPayout = Math.max(0, totalAmount - commission - paymobFee);

      if (order.seller_id && netPayout > 0) {
        // Fetch or create seller wallet
        const { data: wallet } = await supabase
          .from('user_wallets')
          .select('*')
          .eq('user_id', order.seller_id)
          .maybeSingle();

        const currentPending = Number(wallet?.pending_balance || 0);
        const currentAvailable = Number(wallet?.available_balance || 0);
        const newPending = Math.max(0, currentPending - netPayout);
        const newAvailable = currentAvailable + netPayout;

        if (wallet) {
          await supabase
            .from('user_wallets')
            .update({
              pending_balance: newPending,
              available_balance: newAvailable,
              updated_at: new Date().toISOString(),
            } as any)
            .eq('id', wallet.id);
        } else {
          await supabase.from('user_wallets').insert({
            id: `wallet_${order.seller_id}`,
            user_id: order.seller_id,
            pending_balance: 0,
            available_balance: newAvailable,
            currency: 'EGP',
            updated_at: new Date().toISOString(),
          } as any);
        }

        // Record Ledger Transaction
        await supabase.from('wallet_transactions').insert({
          wallet_id: wallet?.id || `wallet_${order.seller_id}`,
          order_id: orderId,
          type: 'escrow_release',
          amount: netPayout,
          fee_amount: commission + paymobFee,
          status: 'completed',
          description: `Escrow Released: Order #${orderId.slice(-6).toUpperCase()}`,
          created_at: new Date().toISOString(),
        } as any);
      }

      return NextResponse.json({
        success: true,
        message: '🎉 Escrow released! Net funds moved to Seller available balance.',
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[API /api/orders POST] fatal error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
