export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://fpqbocohjzwlfcmfropr.supabase.co';

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwcWJvY29oanp3bGZjbWZyb3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5NTkzNDMsImV4cCI6MjA2NDUzNTM0M30.P6atGZ_u0rkbr76qoIBJN5bRGhe2nESQctXoc25d3xU';

const hmacSecret = process.env.PAYMOB_HMAC_SECRET || '08BCEABC4398ACAFDB82717BC17DE4C9';

const supabase = createClient(supabaseUrl, supabaseKey);

const HMAC_FIELDS = [
  'amount_cents',
  'created_at',
  'currency',
  'error_occured',
  'has_parent_transaction',
  'id',
  'integration_id',
  'is_3d_secure',
  'is_auth',
  'is_capture',
  'is_refunded',
  'is_standalone_payment',
  'is_voided',
  'order.id',
  'owner',
  'pending',
  'source_data.pan',
  'source_data.sub_type',
  'source_data.type',
  'success',
  'txn_response_code',
];

function computePaymobHmac(payload: Record<string, any>, secret: string): string {
  const concatenated = HMAC_FIELDS.map((field) => {
    const keys = field.split('.');
    let val: any = payload;
    for (const k of keys) val = val?.[k];
    return String(val ?? '');
  }).join('');

  return crypto
    .createHmac('sha512', secret)
    .update(concatenated)
    .digest('hex');
}

export async function GET() {
  return NextResponse.json({ status: 'ok', time: new Date().toISOString() });
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const queryHmac = searchParams.get('hmac');

    if (!queryHmac) {
      return NextResponse.json({ success: false, error: 'Missing HMAC signature' }, { status: 401 });
    }

    const bodyText = await req.text();

    // Proxy the webhook request directly to the authoritative Supabase Edge Function
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/paymob-webhook?hmac=${queryHmac}`;
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: bodyText
    });

    const responseText = await response.text();

    return new NextResponse(responseText, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (err: any) {
    console.error('[API wallet/credit proxy] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error proxying to edge function' }, { status: 500 });
  }
}
