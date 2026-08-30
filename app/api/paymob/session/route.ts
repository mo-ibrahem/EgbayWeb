export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY || process.env.NEXT_PUBLIC_PAYMOB_API_KEY || process.env.EXPO_PUBLIC_PAYMOB_API_KEY || '';
const PAYMOB_INTEGRATION_ID = Number(process.env.PAYMOB_INTEGRATION_ID || process.env.NEXT_PUBLIC_PAYMOB_INTEGRATION_ID || process.env.EXPO_PUBLIC_PAYMOB_INTEGRATION_ID || '5267608');
const PAYMOB_IFRAME_ID = process.env.PAYMOB_IFRAME_ID || process.env.NEXT_PUBLIC_PAYMOB_IFRAME_ID || process.env.EXPO_PUBLIC_PAYMOB_IFRAME_ID || '957263';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://fpqbocohjzwlfcmfropr.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const authToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: jwtError } = await supabaseAdmin.auth.getUser(authToken);

    if (jwtError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const userId = user.id;
    const body = await req.json();
    const { purpose, referenceId, tier, billingData } = body;

    let amountEgp = 0;
    let merchantOrderId = '';
    let itemName = '';

    if (purpose === 'order') {
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('id, amount, buyer_id, status')
        .eq('id', referenceId)
        .maybeSingle();

      if (!order) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
      if (order.buyer_id !== userId) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      if (order.status !== 'pending_payment') return NextResponse.json({ success: false, error: 'Order is no longer pending payment' }, { status: 409 });

      amountEgp = Number(order.amount);
      merchantOrderId = order.id;
      itemName = `EgyBay Order #${order.id.slice(-6).toUpperCase()}`;

    } else if (purpose === 'boost') {
      const { data: product } = await supabaseAdmin
        .from('products')
        .select('id, title, seller_id')
        .eq('id', referenceId)
        .maybeSingle();

      if (!product) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
      if (product.seller_id !== userId) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

      const boostPrices: Record<string, number> = { urgent: 50, featured: 150, turbo: 300 };
      const selectedTier = tier || 'featured';
      
      amountEgp = boostPrices[selectedTier];
      if (!amountEgp) return NextResponse.json({ success: false, error: 'Invalid boost tier' }, { status: 400 });

      merchantOrderId = `boost_${product.id}_${selectedTier}_${userId}_${Date.now()}`;
      itemName = `Boost: ${product.title} (${selectedTier})`;
    } else {
      return NextResponse.json({ success: false, error: 'Invalid purpose' }, { status: 400 });
    }

    const amountCents = Math.round(amountEgp * 100);

    const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: PAYMOB_API_KEY }),
    });
    if (!authRes.ok) throw new Error(`Paymob auth failed: ${authRes.status}`);
    const { token: paymobAuthToken } = await authRes.json();
    
    const orderRes = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: paymobAuthToken,
        delivery_needed: 'false',
        amount_cents: amountCents,
        currency: 'EGP',
        merchant_order_id: merchantOrderId,
        items: [{ name: itemName, amount_cents: amountCents, description: itemName, quantity: 1 }],
      }),
    });
    if (!orderRes.ok) throw new Error(`Paymob order creation failed: ${orderRes.status}`);
    const orderData = await orderRes.json();
    const paymobOrderId = orderData.id;

    const b = billingData || {};
    const keyRes = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: paymobAuthToken,
        amount_cents: amountCents,
        expiration: 3600,
        order_id: paymobOrderId,
        billing_data: {
          apartment: 'NA', floor: 'NA', building: 'NA',
          shipping_method: 'NA', postal_code: 'NA',
          first_name: b.first_name || 'User',
          last_name: b.last_name || 'Name',
          email: b.email || 'customer@egbay.market',
          phone_number: b.phone_number || '+201000000000',
          street: b.street || 'NA',
          city: b.city || 'Cairo',
          country: 'EG',
          state: b.state || 'Cairo',
        },
        currency: 'EGP',
        integration_id: PAYMOB_INTEGRATION_ID,
        lock_order_when_paid: 'false',
      }),
    });
    if (!keyRes.ok) throw new Error(`Paymob payment key failed: ${keyRes.status}`);
    const keyData = await keyRes.json();
    const paymentToken: string = keyData.token;

    const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${PAYMOB_IFRAME_ID}?payment_token=${paymentToken}`;
    return NextResponse.json({ success: true, paymentToken, paymobOrderId, iframeUrl });
  } catch (err: any) {
    console.error('[API paymob/session]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
