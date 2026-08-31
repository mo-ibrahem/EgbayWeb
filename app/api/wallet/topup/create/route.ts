export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY || process.env.NEXT_PUBLIC_PAYMOB_API_KEY || process.env.EXPO_PUBLIC_PAYMOB_API_KEY || '';
const PAYMOB_INTEGRATION_ID = process.env.PAYMOB_INTEGRATION_ID || process.env.NEXT_PUBLIC_PAYMOB_INTEGRATION_ID || process.env.EXPO_PUBLIC_PAYMOB_INTEGRATION_ID || '';
const PAYMOB_IFRAME_ID = process.env.PAYMOB_IFRAME_ID || process.env.NEXT_PUBLIC_PAYMOB_IFRAME_ID || process.env.EXPO_PUBLIC_PAYMOB_IFRAME_ID || '';

// Use service role for database mutations (wallet_topups)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://fpqbocohjzwlfcmfropr.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwcWJvY29oanp3bGZjbWZyb3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5NTkzNDMsImV4cCI6MjA2NDUzNTM0M30.P6atGZ_u0rkbr76qoIBJN5bRGhe2nESQctXoc25d3xU';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    // 1. Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }

    const authToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: jwtError } = await supabaseAdmin.auth.getUser(authToken);

    if (jwtError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const userId = user.id;

    // Create a client with the user's JWT to safely perform RLS operations
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${authToken}` } }
    });

    // 2. Parse request body
    const bodyText = await req.text();
    let body: any = {};
    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const { amount } = body; // Expected in EGP
    const amountEgp = Number(amount);

    // 3. Validate amount
    if (isNaN(amountEgp) || amountEgp < 10 || amountEgp > 50000) {
      return NextResponse.json({ success: false, error: 'Invalid amount. Must be between 10 and 50,000 EGP.' }, { status: 400 });
    }

    const amountCents = Math.round(amountEgp * 100);

    // 4. Generate unique merchant order ID
    const merchantOrderId = `topup_${crypto.randomUUID()}`;

    // 5. Create persistent top-up intent in DB
    const { data: topupRow, error: topupError } = await userClient
      .from('wallet_topups')
      .insert({
        user_id: userId,
        amount: amountEgp,
        currency: 'EGP',
        status: 'pending',
        merchant_order_id: merchantOrderId,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour expiry
      })
      .select()
      .single();

    if (topupError || !topupRow) {
      console.error('[API wallet/topup/create] DB Insert Error:', topupError);
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }

    // 6. Call Paymob API (Backend only)
    if (!PAYMOB_API_KEY || !PAYMOB_INTEGRATION_ID || !PAYMOB_IFRAME_ID) {
      console.error('[API wallet/topup/create] Missing Paymob environment variables');
      return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 });
    }

    // Step A: Authentication Request
    const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: PAYMOB_API_KEY })
    });
    const authData = await authRes.json();
    if (!authData.token) {
      throw new Error('Failed to obtain Paymob auth token');
    }
    const token = authData.token;

    // Step B: Order Registration Request
    const orderRes = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: token,
        delivery_needed: 'false',
        amount_cents: String(amountCents),
        currency: 'EGP',
        merchant_order_id: merchantOrderId
      })
    });
    const orderData = await orderRes.json();
    if (!orderData.id) {
      throw new Error('Failed to register Paymob order');
    }
    const paymobOrderId = orderData.id;

    // Update DB with Paymob Order ID
    await userClient
      .from('wallet_topups')
      .update({ paymob_order_id: paymobOrderId })
      .eq('id', topupRow.id);

    // Step C: Payment Key Request
    // Get user details for billing data
    const { data: userProfile } = await userClient
      .from('user_profiles')
      .select('full_name, phone_number, email')
      .eq('id', userId)
      .maybeSingle();

    const billingData = {
      apartment: 'NA',
      email: userProfile?.email || 'test@egbay.shop',
      floor: 'NA',
      first_name: userProfile?.full_name?.split(' ')[0] || 'User',
      street: 'NA',
      building: 'NA',
      phone_number: userProfile?.phone_number || '+201000000000',
      shipping_method: 'NA',
      postal_code: 'NA',
      city: 'Cairo',
      country: 'EG',
      last_name: userProfile?.full_name?.split(' ').slice(1).join(' ') || 'Name',
      state: 'NA'
    };

    const paymentKeyRes = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: token,
        amount_cents: String(amountCents),
        expiration: 3600,
        order_id: paymobOrderId,
        billing_data: billingData,
        currency: 'EGP',
        integration_id: PAYMOB_INTEGRATION_ID
      })
    });
    const paymentKeyData = await paymentKeyRes.json();
    if (!paymentKeyData.token) {
      throw new Error('Failed to obtain Paymob payment key');
    }

    const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${PAYMOB_IFRAME_ID}?payment_token=${paymentKeyData.token}`;

    return NextResponse.json({
      success: true,
      topupId: topupRow.id,
      iframeUrl,
      paymentToken: paymentKeyData.token
    });

  } catch (err: any) {
    console.error('[API wallet/topup/create] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
