import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from './adminAuth';

/** Authoritative database switch: never trust a browser or mobile build flag. */
export async function requireCommerce() {
  const { data, error } = await createSupabaseAdmin().rpc('commerce_is_enabled');
  if (error || data !== true) return NextResponse.json(
    { success: false, error: 'Payments and live selling are unavailable in classifieds mode.' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
  return null;
}

