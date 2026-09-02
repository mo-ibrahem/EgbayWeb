export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAdmin, createSupabaseAdmin } from '@/lib/adminAuth';

// GET: list disputed orders with buyer/seller display info and the
// dispute details (reason/notes/evidence, which live in orders.notes --
// see /api/orders' 'dispute' action).
export async function GET(req: Request) {
  try {
    const supabaseAdmin = createSupabaseAdmin();
    const authResult = await requireAdmin(req, supabaseAdmin);
    if ('error' in authResult) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
    }

    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('id, buyer_id, seller_id, amount, status, notes, product_snapshot, handover_method, created_at, updated_at')
      .eq('status', 'disputed')
      .order('updated_at', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const userIds = [...new Set((orders || []).flatMap(o => [o.buyer_id, o.seller_id]))];
    const { data: profiles } = await supabaseAdmin
      .from('user_profiles')
      .select('id, full_name, email')
      .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const enriched = (orders || []).map(o => {
      let notesData: any = {};
      try {
        notesData = typeof o.notes === 'string' ? JSON.parse(o.notes) : o.notes || {};
      } catch {}
      return {
        id: o.id,
        amount: o.amount,
        status: o.status,
        handover_method: o.handover_method,
        product: o.product_snapshot,
        created_at: o.created_at,
        updated_at: o.updated_at,
        buyer: profileMap.get(o.buyer_id) || null,
        seller: profileMap.get(o.seller_id) || null,
        dispute_reason: notesData.dispute_reason || null,
        dispute_notes: notesData.dispute_notes || null,
        dispute_evidence: notesData.dispute_evidence || null,
        dispute_created_at: notesData.dispute_created_at || null,
      };
    });

    return NextResponse.json({ success: true, disputes: enriched });
  } catch (err: any) {
    console.error('[API admin/disputes GET] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// POST: resolve a dispute via the service-role-only admin_resolve_dispute
// RPC. resolution is 'refund_buyer' | 'release_seller'.
export async function POST(req: Request) {
  try {
    const supabaseAdmin = createSupabaseAdmin();
    const authResult = await requireAdmin(req, supabaseAdmin);
    if ('error' in authResult) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json();
    const { orderId, resolution, notes } = body;

    if (!orderId || !['refund_buyer', 'release_seller'].includes(resolution)) {
      return NextResponse.json({ success: false, error: 'orderId and a valid resolution (refund_buyer/release_seller) are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc('admin_resolve_dispute', {
      p_admin_id: authResult.adminId,
      p_order_id: orderId,
      p_resolution: resolution,
      p_notes: notes || null,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, result: data });
  } catch (err: any) {
    console.error('[API admin/disputes POST] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
