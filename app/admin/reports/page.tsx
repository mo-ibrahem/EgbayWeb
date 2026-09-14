'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ProtectedRoute from '@/components/ProtectedRoute';

type Report = {
 id:string; target_type:'listing'|'message'|'user'; target_id:string; reason:string; created_at:string;
 preview:null|{title?:string;description?:string;images?:string[];content?:string;full_name?:string};
};
function Reports() {
 const [reports,setReports] = useState<Report[]>([]);
 const [loading,setLoading] = useState(true), [busy,setBusy] = useState<string|null>(null);
 const [error,setError] = useState(''), [notes,setNotes] = useState('');
 const headers = async () => {
  const {data:{session}} = await supabase.auth.getSession();
  if (!session) throw Error('Sign in with a moderator account.');
  return {'Content-Type':'application/json',Authorization:'Bearer '+session.access_token};
 };
 const load = useCallback(async () => {
  setLoading(true); setError('');
  try {
   const response = await fetch('/api/admin/reports',{headers:await headers(),cache:'no-store'});
   const body = await response.json();
   if (!response.ok) throw Error(body.error || 'Could not load reports.');
   setReports(body.reports);
  } catch(e) { setReports([]); setError(e instanceof Error ? e.message : 'Could not load reports.'); }
  finally { setLoading(false); }
 },[]);
 useEffect(() => { void load(); },[load]);
 const review = async (report:Report,action:string) => {
  if (action === 'suspend' && !window.confirm('Suspend this user, withdraw their listings and end their live sessions?')) return;
  setBusy(report.id); setError('');
  try {
   const response = await fetch('/api/admin/reports',{method:'POST',headers:await headers(),
    body:JSON.stringify({reportId:report.id,action,notes})});
   const body = await response.json();
   if (!response.ok) throw Error(body.error);
   setNotes(''); await load();
  } catch(e) {setError(e instanceof Error ? e.message : 'Review failed.');}
  finally {setBusy(null);}
 };
 return <main className="max-w-4xl mx-auto p-6 space-y-6">
  <Link href="/admin" className="text-blue-700">← Admin</Link>
  <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Content reports</h1>
   <button onClick={() => void load()} disabled={loading || !!busy} className="rounded border px-4 py-2">Refresh</button></div>
  <p className="text-slate-600">Oldest open reports first, up to 100. Review reported content and record the reason for your decision.</p>
  {error && <p role="alert" className="rounded bg-red-50 p-4 text-red-800">{error}</p>}
  <label className="block font-medium">Review notes
   <textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={1000}
    className="block w-full mt-2 rounded border p-3" placeholder="Reason for the next review action" /></label>
  {loading ? <p>Loading reports…</p> : !reports.length && !error ? <p>No open reports.</p> : reports.map(r=>
   <article key={r.id} className="rounded-xl border bg-white p-5 space-y-3">
    <div className="flex justify-between gap-3"><strong className="capitalize">{r.target_type} report</strong>
     <time className="text-sm text-slate-500">{new Date(r.created_at).toLocaleString()}</time></div>
    <p className="whitespace-pre-wrap break-words"><strong>Reason: </strong>{r.reason}</p>
    <blockquote className="border-l-4 pl-3 whitespace-pre-wrap break-words">
     {r.preview ? (r.preview.title || r.preview.content || r.preview.full_name || 'Unnamed content') : 'Content no longer exists.'}
     {r.preview?.description && <p className="mt-2 text-slate-600">{r.preview.description}</p>}
    </blockquote>
    {r.preview?.images?.filter(src=>src.startsWith('https://fpqbocohjzwlfcmfropr.supabase.co/storage/v1/object/public/product-images/')).map(src=>
     // eslint-disable-next-line @next/next/no-img-element -- Moderators inspect the uploaded original without optimization.
     <img key={src} src={src} alt="Reported listing" className="inline-block w-32 h-32 object-contain border" />)}
    <p className="text-xs text-slate-500 break-all">Reference: {r.id}</p>
    <div className="flex gap-3">
     <button disabled={!!busy} onClick={()=>void review(r,'dismiss')} className="rounded border px-4 py-2">Dismiss</button>
     <button disabled={!!busy || !r.preview} onClick={()=>void review(r,r.target_type==='user'?'suspend':'remove')}
      className="rounded bg-red-700 text-white px-4 py-2">{busy===r.id?'Saving…':r.target_type==='user'?'Suspend user':'Remove content'}</button>
    </div>
   </article>)}
 </main>;
}
export default function ReportsPage(){return <ProtectedRoute><Reports /></ProtectedRoute>;}
