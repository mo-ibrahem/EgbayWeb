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

// POST: Simulate Courier Actions
export async function POST(req: Request) {
  try {
    // Block on production
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ success: false, error: 'Courier Simulator is disabled in production environments.' }, { status: 403 });
    }

    const body = await req.json();
    const { action, orderId, pin } = body;

    if (!action || !orderId) {
      return NextResponse.json({ success: false, error: 'Missing action or orderId' }, { status: 400 });
    }

    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('handover_pin_hash, handover_method, status')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    if (order.handover_method !== 'courier') {
      return NextResponse.json({ success: false, error: 'This endpoint only simulates courier deliveries.' }, { status: 400 });
    }

    // ACTION: Mark Out For Delivery
    if (action === 'mark_out_for_delivery') {
      if (order.status !== 'shipped') {
        return NextResponse.json({ success: false, error: `Cannot mark out for delivery from status: ${order.status}` }, { status: 400 });
      }

      const { error: updateErr } = await supabaseAdmin
        .from('orders')
        .update({ status: 'out_for_delivery', updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (updateErr) {
        return NextResponse.json({ success: false, error: updateErr.message }, { status: 400 });
      }

      await supabaseAdmin.from('order_events').insert({
        order_id: orderId,
        event_type: 'out_for_delivery',
        created_at: new Date().toISOString()
      });

      return NextResponse.json({ success: true, message: 'Order marked as Out For Delivery 🚚' });
    }

    // ACTION: Verify Delivery & Release Escrow
    if (action === 'verify_delivery') {
      if (order.status !== 'out_for_delivery') {
         return NextResponse.json({ success: false, error: `Cannot deliver. Order must be out_for_delivery. Current status: ${order.status}` }, { status: 400 });
      }

      if (!pin) {
        return NextResponse.json({ success: false, error: 'Missing PIN for delivery verification' }, { status: 400 });
      }

      if (!order.handover_pin_hash) {
        return NextResponse.json({ success: false, error: 'Order not configured for PIN handover' }, { status: 400 });
      }

      // Verify PIN
      const isPinValid = await bcrypt.compare(String(pin).trim(), order.handover_pin_hash);
      if (!isPinValid) {
        return NextResponse.json({ success: false, error: 'Invalid Delivery PIN' }, { status: 403 });
      }

      // Insert delivered event BEFORE calling release_escrow.
      // We don't update order.status to 'delivered' because release_escrow RPC checks against 'out_for_delivery' or 'shipped'.
      await supabaseAdmin.from('order_events').insert({
        order_id: orderId,
        event_type: 'delivered',
        created_at: new Date().toISOString()
      });

      // Pass a dummy UUID representing the courier actor to the RPC
      const { error: rpcErr } = await supabaseAdmin.rpc('release_escrow', {
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_order_id: orderId
      });

      if (rpcErr) {
        return NextResponse.json({ success: false, error: rpcErr.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: '📦 Delivery confirmed by courier! Escrow released successfully.',
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });

  } catch (err: any) {
    console.error('[API /api/orders/simulate-courier] fatal error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
