export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { requireAdmin, createSupabaseAdmin } from '@/lib/adminAuth';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(req: Request) {
 try {
  const db = createSupabaseAdmin();
  const auth = await requireAdmin(req, db);
  if ('error' in auth) return NextResponse.json({error:auth.error},{status:auth.status});
  const {data, error} = await db.from('content_reports')
   .select('id,target_type,target_id,reason,created_at').eq('status','open')
   .order('created_at',{ascending:true}).limit(100);
  if (error) throw error;
  const reports = await Promise.all((data || []).map(async report => {
   const table = report.target_type === 'listing' ? 'products' : report.target_type === 'message' ? 'messages' : 'user_profiles';
   const columns = table === 'products' ? 'title,description,images' : table === 'messages' ? 'content' : 'full_name';
   const preview = await db.from(table).select(columns).eq('id',report.target_id).maybeSingle();
   if (preview.error) throw preview.error;
   return {...report, preview:preview.data};
  }));
  return NextResponse.json({reports},{headers:{'Cache-Control':'no-store'}});
 } catch {
  return NextResponse.json({error:'Could not load reports.'},{status:500});
 }
}
export async function POST(req: Request) {
 try {
  const db = createSupabaseAdmin();
  const auth = await requireAdmin(req, db);
  if ('error' in auth) return NextResponse.json({error:auth.error},{status:auth.status});
  const body = await req.json();
  if (!uuid.test(body.reportId || '') || !['dismiss','remove','suspend'].includes(body.action) ||
      (body.notes != null && (typeof body.notes !== 'string' || body.notes.length > 1000))) {
   return NextResponse.json({error:'Invalid review.'},{status:400});
  }
  const {error} = await db.rpc('admin_review_content_report',{
   p_admin_id:auth.adminId,p_report_id:body.reportId,p_action:body.action,p_notes:body.notes || null
  });
  if (error) return NextResponse.json({error:'Could not apply review. Refresh the queue and check the selected action.'},{status:400});
  return NextResponse.json({success:true});
 } catch {
  return NextResponse.json({error:'Could not review this report.'},{status:500});
 }
}
