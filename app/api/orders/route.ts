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

      // SECURITY FIX: Fetch the actual product price from the database
      const { data: productInfo, error: prodErr } = await supabase
        .from('products')
        .select('price, title, images, condition, category')
        .eq('id', orderData.product_id)
        .maybeSingle();

      if (prodErr || !productInfo) {
        return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
      }

      const hardenedPrice = Number(productInfo.price) || 0;

      const productSnapshot = {
        id: orderData.product_id,
        title: productInfo.title,
        price: hardenedPrice,
        images: productInfo.images || [],
        condition: productInfo.condition || 'Used',
        category: productInfo.category || 'General',
      };

      const insertPayload = {
        id: generatedOrderId,
        product_id: orderData.product_id,
        buyer_id: orderData.buyer_id,
        seller_id: orderData.seller_id,
        status: 'pending_payment',
        amount: hardenedPrice,
        notes: JSON.stringify({
          handover_method: orderData.handover_method || 'courier',
          meetup_pin: randomPin,
          amount: hardenedPrice,
          courier_name: 'Bosta Express',
          product: productSnapshot,
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
          product: productSnapshot,
        },
      });
    }

    // Action 1.5: Pay with Wallet (100% wallet checkout)
    if (action === 'pay_with_wallet' && orderId) {
      // Find the order
      const { data: ord } = await supabase
        .from('orders')
        .select('id, product_id, seller_id, amount, buyer_id, status')
        .eq('id', orderId)
        .maybeSingle();

      if (!ord || ord.status !== 'pending_payment') {
        return NextResponse.json({ success: false, error: 'Invalid order' }, { status: 400 });
      }

      const orderAmount = Number(ord.amount || 0);

      // Verify the buyer has enough funds
      const { data: buyerWallet } = await supabase
        .from('user_wallets')
        .select('id, available_balance')
        .eq('user_id', ord.buyer_id)
        .maybeSingle();
      
      const buyerAvailable = Number(buyerWallet?.available_balance || 0);
      if (!buyerWallet || buyerAvailable < orderAmount) {
         return NextResponse.json({ success: false, error: 'Insufficient wallet balance' }, { status: 400 });
      }

      // Deduct from buyer
      await supabase
        .from('user_wallets')
        .update({ available_balance: buyerAvailable - orderAmount, updated_at: new Date().toISOString() } as any)
        .eq('user_id', ord.buyer_id);

      await supabase.from('wallet_transactions').insert({
        wallet_id: buyerWallet.id,
        order_id: orderId,
        type: 'fee_deduction',
        amount: -orderAmount,
        fee_amount: 0,
        status: 'completed',
        description: `Wallet Payment: Order #${orderId.slice(-6).toUpperCase()}`,
        created_at: new Date().toISOString(),
      } as any);

      // Secure the escrow
      await supabase
        .from('orders')
        .update({ status: 'escrow_secured', updated_at: new Date().toISOString() } as any)
        .eq('id', orderId);

      // Manage Inventory
      if (ord.product_id) {
        const { data: prod } = await supabase.from('products').select('id, description').eq('id', ord.product_id).maybeSingle();
        if (prod) {
          const stockMatch = (prod.description || '').match(/📦\s*Stock:\s*(\d+)/i) || (prod.description || '').match(/الكمية:\s*(\d+)/i);
          const currentStock = stockMatch ? parseInt(stockMatch[1], 10) : 1;
          const remainingStock = currentStock - 1;

          if (remainingStock <= 0) {
            await supabase.from('products').update({ status: 'sold', updated_at: new Date().toISOString() } as any).eq('id', ord.product_id);
          } else {
            const updatedDescription = (prod.description || '').replace(/📦\s*Stock:\s*\d+/i, `📦 Stock: ${remainingStock}`);
            await supabase.from('products').update({ description: updatedDescription, updated_at: new Date().toISOString() } as any).eq('id', ord.product_id);
          }
        }
      }

      // Credit Seller Escrow
      const platformCommission = Math.round(orderAmount * 0.04);
      const netEscrowPayout = Math.max(0, orderAmount - platformCommission); // No Paymob fee for 100% wallet checkout
      
      const { data: sellerWallet } = await supabase.from('user_wallets').select('id, pending_balance').eq('user_id', ord.seller_id).maybeSingle();
      let sellerWalletId = sellerWallet?.id;
      if (sellerWallet) {
        await supabase.from('user_wallets').update({ pending_balance: Number(sellerWallet.pending_balance || 0) + netEscrowPayout, updated_at: new Date().toISOString() } as any).eq('user_id', ord.seller_id);
      } else {
        const { data: created } = await supabase.from('user_wallets').insert({ user_id: ord.seller_id, pending_balance: netEscrowPayout, available_balance: 0, currency: 'EGP' } as any).select().maybeSingle();
        sellerWalletId = created?.id;
      }

      if (sellerWalletId) {
        await supabase.from('wallet_transactions').insert({
          wallet_id: sellerWalletId,
          order_id: orderId,
          type: 'escrow_hold',
          amount: netEscrowPayout,
          fee_amount: platformCommission,
          status: 'completed',
          description: `Escrow Hold: Order #${orderId.slice(-6).toUpperCase()}`,
          created_at: new Date().toISOString(),
        } as any);
      }

      return NextResponse.json({ success: true, message: 'Order paid via wallet' });
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

    // Action 3: Update Tracking
    if (action === 'update_tracking' && orderId) {
      const { tracking_number, courier_name, status } = body;
      
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

      const newStatus = status || 'shipped';
      const courier = courier_name || 'Bosta Express (بوسطة مصر)';
      
      let deliveredAt = notesData.delivered_at;
      let inspectionExpiry = notesData.inspection_expiry_at;
      if (newStatus === 'delivered') {
        deliveredAt = new Date().toISOString();
        inspectionExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      }
      
      const bostaUrl = tracking_number ? `https://bosta.co/tracking/?trackingNumber=${encodeURIComponent(tracking_number)}` : undefined;

      const updatedNotes = {
        ...notesData,
        tracking_number,
        courier_name: courier,
        bosta_tracking_url: bostaUrl,
        delivered_at: deliveredAt,
        inspection_expiry_at: inspectionExpiry,
      };

      await supabase
        .from('orders')
        .update({
          status: newStatus,
          notes: JSON.stringify(updatedNotes),
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', orderId);

      return NextResponse.json({ success: true, message: 'Tracking updated' });
    }

    // Action 4: Dispute
    if (action === 'dispute' && orderId) {
      const { reason, notes, evidence } = body;
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
      
      const updatedNotes = {
        ...notesData,
        dispute_reason: reason,
        dispute_notes: notes,
        dispute_evidence: evidence,
        dispute_created_at: new Date().toISOString(),
      };

      await supabase
        .from('orders')
        .update({
          status: 'disputed',
          notes: JSON.stringify(updatedNotes),
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', orderId);

      return NextResponse.json({ success: true, message: 'Dispute filed' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[API /api/orders POST] fatal error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
