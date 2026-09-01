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

// POST: Simulate Courier Handover
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, pin } = body;

    if (!orderId || !pin) {
      return NextResponse.json({ success: false, error: 'Missing orderId or PIN' }, { status: 400 });
    }

    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('handover_pin_hash, handover_method')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    if (order.handover_method !== 'courier') {
      return NextResponse.json({ success: false, error: 'This endpoint only simulates courier deliveries.' }, { status: 400 });
    }

    if (!order.handover_pin_hash) {
      return NextResponse.json({ success: false, error: 'Order not configured for PIN handover' }, { status: 400 });
    }

    // Verify PIN
    const isPinValid = await bcrypt.compare(String(pin).trim(), order.handover_pin_hash);
    if (!isPinValid) {
      return NextResponse.json({ success: false, error: 'Invalid Delivery PIN' }, { status: 403 });
    }

    // Pass a dummy UUID representing the courier actor to the RPC
    // Since it's neither the buyer nor seller, the RPC's new courier branch will allow it.
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
  } catch (err: any) {
    console.error('[API /api/orders/simulate-courier] fatal error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
