export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

// This route is a dumb proxy in front of the authoritative Supabase Edge
// Function (paymob-webhook), which performs its own independent HMAC
// verification against its own PAYMOB_HMAC_SECRET env var. It does not
// verify anything itself and must never hold a copy of that secret.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://fpqbocohjzwlfcmfropr.supabase.co';

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
