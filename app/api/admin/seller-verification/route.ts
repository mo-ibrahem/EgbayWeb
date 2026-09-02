export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAdmin, createSupabaseAdmin } from '@/lib/adminAuth';

const SIGNED_URL_TTL_SECONDS = 600; // 10 minutes -- just long enough to review

// GET: list verification requests (default: pending only) with signed
// URLs for the private ID photos, generated server-side with the
// service role since the reviewing admin is not the uploader and would
// otherwise be blocked by the per-user-folder storage RLS policy.
export async function GET(req: Request) {
  try {
    const supabaseAdmin = createSupabaseAdmin();
    const authResult = await requireAdmin(req, supabaseAdmin);
    if ('error' in authResult) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'pending';

    const { data: requests, error } = await supabaseAdmin
      .from('seller_verification_requests')
      .select('id, user_id, requested_tier, full_name, national_id_number, national_id_front_url, national_id_back_url, status, reviewer_notes, created_at, reviewed_at')
      .eq('status', status)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const userIds = [...new Set((requests || []).map(r => r.user_id))];
    const { data: profiles } = await supabaseAdmin
      .from('user_profiles')
      .select('id, full_name, email, tier')
      .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const enriched = await Promise.all((requests || []).map(async (r) => {
      const [frontSigned, backSigned] = await Promise.all([
        supabaseAdmin.storage.from('kyc-documents').createSignedUrl(r.national_id_front_url, SIGNED_URL_TTL_SECONDS),
        supabaseAdmin.storage.from('kyc-documents').createSignedUrl(r.national_id_back_url, SIGNED_URL_TTL_SECONDS),
      ]);
      return {
        ...r,
        applicant: profileMap.get(r.user_id) || null,
        national_id_front_signed_url: frontSigned.data?.signedUrl || null,
        national_id_back_signed_url: backSigned.data?.signedUrl || null,
      };
    }));

    return NextResponse.json({ success: true, requests: enriched });
  } catch (err: any) {
    console.error('[API admin/seller-verification GET] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// POST: approve or reject a verification request via the service-role-only
// admin_review_seller_verification RPC.
export async function POST(req: Request) {
  try {
    const supabaseAdmin = createSupabaseAdmin();
    const authResult = await requireAdmin(req, supabaseAdmin);
    if ('error' in authResult) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json();
    const { requestId, decision, notes } = body;

    if (!requestId || !['approved', 'rejected'].includes(decision)) {
      return NextResponse.json({ success: false, error: 'requestId and a valid decision (approved/rejected) are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc('admin_review_seller_verification', {
      p_admin_id: authResult.adminId,
      p_request_id: requestId,
      p_decision: decision,
      p_notes: notes || null,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, result: data });
  } catch (err: any) {
    console.error('[API admin/seller-verification POST] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
