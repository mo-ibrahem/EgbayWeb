export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

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

      return {
        id: order.id,
        product_id: order.product_id,
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        amount: order.amount || notesData.amount || 0,
        currency: 'EGP',
        status: order.status,
        handover_method: order.handover_method || notesData.handover_method || 'courier',
        shipping_address: order.shipping_address,
        product: order.product_snapshot || fallbackProduct,
        tracking_number: notesData.tracking_number,
        courier_name: notesData.courier_name || 'Bosta Express (بوسطة مصر)',
        created_at: order.created_at,
        updated_at: order.updated_at,
        events: events
      };
    });

    return NextResponse.json({ success: true, orders: mapped });
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
      const generatedOrderId = orderData.id || `ord_${Date.now()}`;
      
      // Generate secure PIN server-side
      const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
      const pinHash = await bcrypt.hash(randomPin, 10);

      // Fetch the actual product price from the database
      const { data: productInfo, error: prodErr } = await supabaseAdmin
        .from('products')
        .select('price, title, images, condition, category, seller_id')
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
        buyer_id: userId,
        seller_id: productInfo.seller_id,
        status: 'pending_payment',
        amount: hardenedPrice,
        product_snapshot: productSnapshot,
        handover_method: orderData.handover_method || 'courier',
        handover_pin_hash: pinHash, // Store ONLY the secure hash
        notes: JSON.stringify({
          amount: hardenedPrice,
          courier_name: 'Bosta Express',
        }), // NO meetup_pin IN NOTES
        shipping_address: orderData.shipping_address,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabaseAdmin
        .from('orders')
        .insert(insertPayload)
        .select()
        .maybeSingle();

      if (error) {
        console.error('[API /api/orders create] error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }

      // Record immutable event
      await supabaseAdmin.from('order_events').insert({
        order_id: generatedOrderId,
        event_type: 'order_placed',
        payload: { amount: hardenedPrice }
      });

      return NextResponse.json({
        success: true,
        order: {
          ...orderData,
          id: generatedOrderId,
          meetup_pin: randomPin, // Return RAW pin strictly to the buyer ONCE
          status: 'pending_payment',
          product: productSnapshot,
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
        .select('buyer_id, seller_id, handover_pin_hash, status')
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

      // If seller is approving, they MUST supply the correct PIN
      if (isSellerApproval) {
        if (!pin) {
          return NextResponse.json({ success: false, error: 'PIN required for seller release' }, { status: 403 });
        }
        
        if (!order.handover_pin_hash) {
           return NextResponse.json({ success: false, error: 'Order not configured for PIN handover' }, { status: 400 });
        }

        // BCRYPT Verification in the backend
        const isPinValid = await bcrypt.compare(String(pin).trim(), order.handover_pin_hash);
        if (!isPinValid) {
          return NextResponse.json({ success: false, error: 'Invalid Handover PIN' }, { status: 403 });
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
      
      if (order.seller_id !== userId && order.buyer_id !== userId) {
         return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
      }

      let notesData: any = {};
      try {
        notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes || {};
      } catch {}

      const newStatus = order.status === 'escrow_secured' ? 'shipped' : order.status;
      const courier = courier_name || 'Bosta Express (بوسطة مصر)';
      
      let deliveredAt = notesData.delivered_at;
      let inspectionExpiry = notesData.inspection_expiry_at;
      
      const bostaUrl = tracking_number ? `https://bosta.co/tracking/?trackingNumber=${encodeURIComponent(tracking_number)}` : undefined;

      const updatedNotes = {
        ...notesData,
        tracking_number,
        courier_name: courier,
        bosta_tracking_url: bostaUrl,
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
        payload: { tracking_number, courier_name: courier, bosta_url: bostaUrl }
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
      
      if (order.status !== 'escrow_secured' && order.status !== 'shipped' && order.status !== 'delivered') {
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
