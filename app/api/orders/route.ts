export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { encryptPin, decryptPin } from '@/lib/encryption';
import { createSupabaseAdmin } from '@/lib/adminAuth';
import bcrypt from 'bcryptjs';

// Financial mutation endpoint -- must run with the real service role or
// not at all. No anon-key fallback: a silent downgrade here would let
// RLS quietly gate operations that are supposed to be server-authoritative.
const supabaseAdmin = createSupabaseAdmin();

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  return user;
}

// GET: Fetch all orders for a user (as buyer OR seller)
export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const userId = user.id;

    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('*, order_events(*)')
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[API /api/orders GET] error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const mapped = (orders || []).map((order: any) => {
      let notesData: any = {};
      try {
        notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes || {};
      } catch {}

      // Fallback for legacy orders without product_snapshot
      const fallbackProduct = notesData.product || undefined;

      // Ensure events are sorted chronologically
      const events = (order.order_events || []).sort((a: any, b: any) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      const isBuyer = userId === order.buyer_id;
      const isRecoverableStatus = ['pending_payment', 'escrow_secured', 'shipped', 'out_for_delivery', 'delivered'].includes(order.status);
      let recoveredPin: string | null = null;
      if (isBuyer && isRecoverableStatus && order.handover_pin_encrypted) {
        recoveredPin = decryptPin(order.handover_pin_encrypted);
      }

      return {
        id: order.id,
        product_id: order.product_id,
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        amount: order.amount || notesData.amount || 0,
        currency: 'EGP',
        status: order.status,
        handover_method: order.handover_method || notesData.handover_method || 'courier',
        handover_pin: recoveredPin,
        shipping_address: order.shipping_address,
        product: order.product_snapshot || fallbackProduct,
        tracking_number: notesData.tracking_number,
        courier_name: notesData.courier_name || undefined,
        created_at: order.created_at,
        updated_at: order.updated_at,
        events: events
      };
    });

    return NextResponse.json({ success: true, orders: mapped }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (err: any) {
    console.error('[API /api/orders GET] fatal error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Create or Confirm an order server-side
export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const userId = user.id;

    const body = await req.json();
    const { action, orderData, orderId } = body;

    // Action 1: Create Order
    if (action === 'create' && orderData) {
      // 1. Generate secure PIN server-side
      const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
      const pinHash = await bcrypt.hash(randomPin, 10);
      
      // 2. Encrypt PIN (will throw 500 error before RPC if key is missing)
      const encryptedPin = encryptPin(randomPin);

      // 3. Execute single, transaction-safe RPC that reserves stock AND creates the order
      const { data: newOrderId, error: rpcError } = await supabaseAdmin
        .rpc('create_marketplace_order', {
          p_product_id: orderData.product_id,
          p_buyer_id: userId,
          p_handover_method: orderData.handover_method || 'courier',
          p_handover_pin_hash: pinHash,
          p_handover_pin_encrypted: encryptedPin,
          p_shipping_address: orderData.shipping_address || null,
          p_live_session_id: orderData.live_session_id || null
        });

      if (rpcError || !newOrderId) {
        console.error('[API /api/orders create] RPC error:', rpcError);
        const errMessage = rpcError?.message || 'Transaction failed';
        if (errMessage.includes('Out of stock') || errMessage.includes('out of stock')) {
          return NextResponse.json({ success: false, error: 'Product is no longer available (Out of stock)' }, { status: 409 });
        }
        return NextResponse.json({ success: false, error: errMessage }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        order: {
          ...orderData,
          id: newOrderId,
          meetup_pin: randomPin, // Return RAW pin strictly to the buyer ONCE
          status: 'pending_payment',
        },
      });
    }

    // Action 1.5: Pay with Wallet (100% wallet checkout)
    if (action === 'pay_with_wallet' && orderId) {
      // Record payment started event
      await supabaseAdmin.from('order_events').insert({
        order_id: orderId,
        event_type: 'payment_started',
        payload: { method: 'wallet' }
      });

      // Delegate entirety of financial logic to the PostgreSQL RPC
      const { data, error } = await supabaseAdmin.rpc('checkout_with_wallet', {
        p_user_id: userId,
        p_order_id: orderId
      });

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: 'Order paid via wallet' });
    }

    // Action 2: Release Escrow to Seller (triggered by PIN verification)
    if (action === 'release_escrow' && orderId) {
      const { pin } = body;

      const { data: order, error: orderErr } = await supabaseAdmin
        .from('orders')
        .select('buyer_id, seller_id, handover_pin_hash, status, handover_method')
        .eq('id', orderId)
        .maybeSingle();

      if (orderErr || !order) {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
      }

      const isBuyerApproval = userId === order.buyer_id;
      const isSellerApproval = userId === order.seller_id;

      if (!isBuyerApproval && !isSellerApproval) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
      }

      if (order.handover_method === 'qr_meetup') {
        if (isBuyerApproval) {
          return NextResponse.json({ success: false, error: 'Buyers cannot manually release meetup escrow. The seller must enter the PIN.' }, { status: 403 });
        }
        if (!pin) {
          return NextResponse.json({ success: false, error: 'PIN required for seller release' }, { status: 403 });
        }
        if (!order.handover_pin_hash) {
           return NextResponse.json({ success: false, error: 'Order not configured for PIN handover' }, { status: 400 });
        }
        const isPinValid = await bcrypt.compare(String(pin).trim(), order.handover_pin_hash);
        if (!isPinValid) {
          return NextResponse.json({ success: false, error: 'Invalid Handover PIN' }, { status: 403 });
        }
      } else if (order.handover_method === 'courier') {
        // Interim model pending real courier (Bosta) integration: the
        // buyer confirms their own delivery, matching what release_escrow
        // already enforces at the database layer. Sellers cannot release
        // their own courier orders.
        if (isSellerApproval) {
          return NextResponse.json({ success: false, error: 'Sellers cannot release courier escrow. The buyer must confirm delivery.' }, { status: 403 });
        }
      }

      // Delegate financial release to RPC
      const { error: rpcErr } = await supabaseAdmin.rpc('release_escrow', {
        p_user_id: userId,
        p_order_id: orderId
      });

      if (rpcErr) {
         return NextResponse.json({ success: false, error: rpcErr.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: '🎉 Escrow released successfully!',
      });
    }

    // Action 3: Mark Dispatched (Courier MVP)
    if (action === 'mark_dispatched' && orderId) {
      const { data: order, error: orderErr } = await supabaseAdmin
        .from('orders')
        .select('seller_id, status, handover_method')
        .eq('id', orderId)
        .maybeSingle();

      if (orderErr || !order) {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
      }

      if (userId !== order.seller_id) {
        return NextResponse.json({ success: false, error: 'Unauthorized. Only the seller can mark as dispatched.' }, { status: 403 });
      }

      if (order.handover_method !== 'courier') {
        return NextResponse.json({ success: false, error: 'Only courier orders can be marked as dispatched.' }, { status: 400 });
      }

      if (order.status !== 'escrow_secured') {
        return NextResponse.json({ success: false, error: 'Order is not in a valid state to be marked dispatched.' }, { status: 400 });
      }

      const { error: updateErr } = await supabaseAdmin
        .from('orders')
        .update({ status: 'shipped', updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (updateErr) {
        return NextResponse.json({ success: false, error: updateErr.message }, { status: 400 });
      }

      await supabaseAdmin.from('order_events').insert({
        order_id: orderId,
        event_type: 'shipped',
        created_at: new Date().toISOString()
      });

      return NextResponse.json({ success: true, message: 'Order marked as dispatched.' });
    }

    // Action 3: Update Tracking
    if (action === 'update_tracking' && orderId) {
      const { tracking_number, courier_name, status } = body;
      
      const { data: order, error: orderErr } = await supabaseAdmin
        .from('orders')
        .select('seller_id, buyer_id, notes, status')
        .eq('id', orderId)
        .maybeSingle();

      if (orderErr || !order) {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
      }

      // Only the seller ships the order / sets tracking info -- matches
      // the mark_dispatched action's authorization. Buyers have no
      // legitimate reason to call this (no UI caller does), and without
      // this check a buyer could advance their own order's status
      // directly against the API.
      if (order.seller_id !== userId) {
         return NextResponse.json({ success: false, error: 'Unauthorized. Only the seller can update tracking.' }, { status: 403 });
      }

      let notesData: any = {};
      try {
        notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes || {};
      } catch {}

      const newStatus = order.status === 'escrow_secured' ? 'shipped' : order.status;
      // The seller arranges their own courier (there is no integrated
      // logistics partner) and self-reports the carrier name and tracking
      // number here. Never auto-build a link to a specific real courier's
      // tracking site from that -- Egbay has no relationship with any
      // named carrier and can't know which one, if any, the seller
      // actually used, so a constructed link would point buyers to a real
      // company's site with a tracking number that company has never
      // issued.
      const courier = courier_name || 'Courier (details pending from seller)';

      let deliveredAt = notesData.delivered_at;
      let inspectionExpiry = notesData.inspection_expiry_at;

      const updatedNotes = {
        ...notesData,
        tracking_number,
        courier_name: courier,
        delivered_at: deliveredAt,
        inspection_expiry_at: inspectionExpiry,
      };

      await supabaseAdmin
        .from('orders')
        .update({
          status: newStatus,
          notes: JSON.stringify(updatedNotes),
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', orderId);

      // Record event
      await supabaseAdmin.from('order_events').insert({
        order_id: orderId,
        event_type: newStatus === 'delivered' ? 'delivered' : 'shipped',
        payload: { tracking_number, courier_name: courier }
      });

      return NextResponse.json({ success: true, message: 'Tracking updated' });
    }

    // Action 4: Dispute
    if (action === 'dispute' && orderId) {
      const { reason, notes, evidence } = body;
      const { data: order, error: orderErr } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (orderErr || !order) {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
      }
      
      if (order.buyer_id !== userId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
      }
      
      let notesData: any = {};
      try {
        notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes || {};
      } catch {}
      
      if (!['escrow_secured', 'shipped', 'out_for_delivery', 'delivered'].includes(order.status)) {
        return NextResponse.json({ success: false, error: 'Order cannot be disputed in its current state' }, { status: 400 });
      }

      const updatedNotes = {
        ...notesData,
        dispute_reason: reason,
        dispute_notes: notes,
        dispute_evidence: evidence,
        dispute_created_at: new Date().toISOString(),
      };

      await supabaseAdmin
        .from('orders')
        .update({
          status: 'disputed',
          notes: JSON.stringify(updatedNotes),
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', orderId);

      await supabaseAdmin.from('order_events').insert({
        order_id: orderId,
        event_type: 'disputed',
        payload: { reason, notes, evidence }
      });

      return NextResponse.json({ success: true, message: 'Dispute filed' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[API /api/orders POST] fatal error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
