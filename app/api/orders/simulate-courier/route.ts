export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/adminAuth';
import type { SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

// The admin client is constructed lazily, inside the handler below --
// never at module scope. Next.js's build-time "collect page data" step
// imports every route module (running top-level code) even though it
// never invokes the exported handler, so a throwing module-scope call
// here (createSupabaseAdmin() has no anon-key fallback, by design)
// breaks the production build if the service-role key isn't present in
// the build environment, regardless of the runtime guards below.
async function getAuthenticatedUser(req: Request, supabaseAdmin: SupabaseClient) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  return user;
}

// Best-effort in-memory lockout for PIN brute-forcing. This resets on
// process restart/redeploy, so it is defense-in-depth on top of the
// auth + ownership + explicit opt-in flag guards below, not a substitute
// for them.
const MAX_PIN_ATTEMPTS = 5;
const failedPinAttempts = new Map<string, number>();

// POST: Simulate Courier Actions
export async function POST(req: Request) {
  try {
    // Guard 1: never runs in production.
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ success: false, error: 'Courier Simulator is disabled in production environments.' }, { status: 403 });
    }

    // Guard 2: explicit opt-in even outside production, so a staging
    // deployment pointed at a real database doesn't expose this by default.
    if (process.env.ENABLE_COURIER_SIMULATOR !== 'true') {
      return NextResponse.json({ success: false, error: 'Courier Simulator is not enabled (set ENABLE_COURIER_SIMULATOR=true to use it).' }, { status: 403 });
    }

    // Guard 3: authentication — this endpoint can advance order state and
    // release escrow, so it must not be callable anonymously.
    const supabaseAdmin = createSupabaseAdmin();
    const user = await getAuthenticatedUser(req, supabaseAdmin);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, orderId, pin } = body;

    if (!action || !orderId) {
      return NextResponse.json({ success: false, error: 'Missing action or orderId' }, { status: 400 });
    }

    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('handover_pin_hash, handover_method, status, buyer_id, seller_id')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Guard 4: ownership — only the buyer or seller on this order may
    // simulate courier events for it.
    if (order.buyer_id !== user.id && order.seller_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
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

      const priorAttempts = failedPinAttempts.get(orderId) || 0;
      if (priorAttempts >= MAX_PIN_ATTEMPTS) {
        return NextResponse.json({ success: false, error: 'Too many failed PIN attempts for this order. Reset the PIN before retrying.' }, { status: 429 });
      }

      // Verify PIN
      const isPinValid = await bcrypt.compare(String(pin).trim(), order.handover_pin_hash);
      if (!isPinValid) {
        failedPinAttempts.set(orderId, priorAttempts + 1);
        return NextResponse.json({ success: false, error: 'Invalid Delivery PIN' }, { status: 403 });
      }
      failedPinAttempts.delete(orderId);

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
