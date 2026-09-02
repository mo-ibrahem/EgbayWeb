'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, ShieldAlert, Loader2, CheckCircle2, XCircle, ExternalLink, Wallet, RefreshCw } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import { supabase } from '@/lib/supabase';
import { formatEGP } from '@/lib/products';

interface VerificationRequest {
  id: string;
  user_id: string;
  requested_tier: number;
  full_name: string;
  national_id_number: string;
  status: string;
  created_at: string;
  applicant: { full_name: string; email: string; tier: number } | null;
  national_id_front_signed_url: string | null;
  national_id_back_signed_url: string | null;
}

interface Dispute {
  id: string;
  amount: number;
  status: string;
  handover_method: string;
  product: { title: string } | null;
  created_at: string;
  buyer: { full_name: string; email: string } | null;
  seller: { full_name: string; email: string } | null;
  dispute_reason: string | null;
  dispute_notes: string | null;
}

function AdminContent() {
  const { user } = useAuth();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<'verification' | 'disputes'>('verification');

  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('user_profiles').select('is_admin').eq('id', user.id).maybeSingle();
      setIsAdmin(!!data?.is_admin);
      setCheckingAccess(false);
    })();
  }, [user]);

  const authHeader = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session ? { Authorization: `Bearer ${session.access_token}` } : {};
  }, []);

  const loadVerificationRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/seller-verification?status=pending', { headers: await authHeader() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setRequests(data.requests);
    } catch (err: any) {
      setError(err.message || 'Failed to load verification requests');
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  const loadDisputes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/disputes', { headers: await authHeader() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setDisputes(data.disputes);
    } catch (err: any) {
      setError(err.message || 'Failed to load disputes');
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === 'verification') loadVerificationRequests();
    else loadDisputes();
  }, [isAdmin, tab, loadVerificationRequests, loadDisputes]);

  const reviewRequest = async (requestId: string, decision: 'approved' | 'rejected') => {
    setActioning(requestId);
    setError('');
    try {
      const res = await fetch('/api/admin/seller-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ requestId, decision }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await loadVerificationRequests();
    } catch (err: any) {
      setError(err.message || 'Failed to review request');
    } finally {
      setActioning(null);
    }
  };

  const resolveDispute = async (orderId: string, resolution: 'refund_buyer' | 'release_seller') => {
    const label = resolution === 'refund_buyer' ? 'refund the buyer' : 'release funds to the seller';
    if (!window.confirm(`Resolve this dispute and ${label}? This moves real money and cannot be undone.`)) return;
    setActioning(orderId);
    setError('');
    try {
      const res = await fetch('/api/admin/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ orderId, resolution }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await loadDisputes();
    } catch (err: any) {
      setError(err.message || 'Failed to resolve dispute');
    } finally {
      setActioning(null);
    }
  };

  if (checkingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
        <ShieldAlert className="w-10 h-10 text-rose-500" />
        <h1 className="text-lg font-black text-slate-900">Admin Access Required</h1>
        <p className="text-sm text-slate-500 max-w-sm">
          Your account does not have admin access. This is granted server-side only and cannot be requested from this page.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <ShieldCheck className="w-6 h-6 text-blue-600" />
        <h1 className="text-xl font-black text-slate-900">Egbay Admin</h1>
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-200">
        {(['verification', 'disputes'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t === 'verification' ? 'Seller Verification' : 'Disputes'}
          </button>
        ))}
        <button
          onClick={() => (tab === 'verification' ? loadVerificationRequests() : loadDisputes())}
          className="ml-auto flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 px-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3 rounded-xl">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : tab === 'verification' ? (
        requests.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-16">No pending verification requests.</p>
        ) : (
          <div className="space-y-4">
            {requests.map(r => (
              <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{r.full_name} <span className="text-slate-400 font-normal">({r.applicant?.email})</span></p>
                    <p className="text-xs text-slate-500">
                      Requesting Tier {r.requested_tier} · Currently Tier {r.applicant?.tier ?? '?'} · ID: {r.national_id_number}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400">{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <div className="flex gap-3 mb-4">
                  {r.national_id_front_signed_url && (
                    <a href={r.national_id_front_signed_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
                      ID Front <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {r.national_id_back_signed_url && (
                    <a href={r.national_id_back_signed_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
                      ID Back <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => reviewRequest(r.id, 'approved')}
                    disabled={actioning === r.id}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve Tier {r.requested_tier}
                  </button>
                  <button
                    onClick={() => reviewRequest(r.id, 'rejected')}
                    disabled={actioning === r.id}
                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : disputes.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-16">No open disputes.</p>
      ) : (
        <div className="space-y-4">
          {disputes.map(d => (
            <div key={d.id} className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-slate-900 text-sm">{d.product?.title || 'Order'} · {formatEGP(d.amount)}</p>
                <span className="text-[10px] text-slate-400">Order #{d.id.slice(-8).toUpperCase()}</span>
              </div>
              <p className="text-xs text-slate-500 mb-1">Buyer: {d.buyer?.full_name} ({d.buyer?.email}) · Seller: {d.seller?.full_name} ({d.seller?.email})</p>
              <p className="text-xs text-slate-500 mb-3">Method: {d.handover_method}</p>
              {(d.dispute_reason || d.dispute_notes) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-900">
                  {d.dispute_reason && <p><strong>Reason:</strong> {d.dispute_reason}</p>}
                  {d.dispute_notes && <p className="mt-1"><strong>Notes:</strong> {d.dispute_notes}</p>}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => resolveDispute(d.id, 'refund_buyer')}
                  disabled={actioning === d.id}
                  className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl"
                >
                  <Wallet className="w-3.5 h-3.5" /> Refund Buyer
                </button>
                <button
                  onClick={() => resolveDispute(d.id, 'release_seller')}
                  disabled={actioning === d.id}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Release to Seller
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <ProtectedRoute>
      <AdminContent />
    </ProtectedRoute>
  );
}
