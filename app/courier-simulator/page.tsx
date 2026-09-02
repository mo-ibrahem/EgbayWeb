'use client';

import React, { useState } from 'react';
import { Package, Lock, Loader2, CheckCircle2, AlertCircle, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function CourierSimulatorPage() {
  const [orderId, setOrderId] = useState('');
  const [pin, setPin] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleAction = async (action: 'mark_out_for_delivery' | 'verify_delivery') => {
    setLoading(true);
    setSuccess('');
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch('/api/orders/simulate-courier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action, orderId, pin: action === 'verify_delivery' ? pin : undefined })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to perform simulator action');
      }

      setSuccess(data.message || 'Action completed successfully.');
      if (action === 'verify_delivery') {
        setOrderId('');
        setPin('');
      }
    } catch (err: any) {
      setError(err.message || 'Server error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl mb-4 relative overflow-hidden">
        
        {/* Environment warning ribbon */}
        <div className="absolute top-0 left-0 w-full bg-amber-400 text-amber-900 text-[10px] font-bold text-center py-1 uppercase tracking-widest">
          Development Simulator Only
        </div>

        <div className="flex justify-center mb-6 mt-4">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center border-4 border-blue-50">
            <Package className="w-8 h-8" />
          </div>
        </div>
        
        <h1 className="text-2xl font-black text-center text-slate-900 mb-2">Courier Simulator</h1>
        <p className="text-slate-500 text-center mb-8 text-sm">
          Simulate courier lifecycle actions to test escrow behavior.
        </p>

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-start gap-3 mb-6">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="font-bold text-sm leading-relaxed">{success}</p>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-start gap-3 mb-6">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="font-bold text-sm leading-relaxed">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Order ID (UUID)
            </label>
            <input
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="e.g. 3ea1d76b-..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 font-mono text-sm font-bold"
            />
          </div>

          {process.env.NODE_ENV !== 'production' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
              <button
                onClick={async () => {
                  if (!orderId) {
                    setError('Please enter an Order ID first.');
                    return;
                  }
                  try {
                    setLoading(true);
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;
                    const res = await fetch(`/api/orders/${orderId}/reset-pin`, { 
                      method: 'POST',
                      headers: token ? { Authorization: `Bearer ${token}` } : {}
                    });
                    const data = await res.json();
                    if (!data.success) throw new Error(data.error || 'Failed to reset PIN');
                    setSuccess(`TEST ONLY: New PIN is ${data.newPin}`);
                    setPin(data.newPin);
                  } catch (err: any) {
                    setError(err.message || 'Error resetting PIN');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading || !orderId}
                className="w-full bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold py-2 rounded-lg text-xs tracking-wider transition-colors disabled:opacity-50"
              >
                TEST ONLY — RESETS TEST PIN
              </button>
            </div>
          )}

          <div className="border-t-2 border-dashed border-slate-200 pt-6">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">1</span>
              Transit State
            </h3>
            <button
              onClick={() => handleAction('mark_out_for_delivery')}
              disabled={loading || !orderId}
              className="w-full bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-200 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
              Mark Out for Delivery
            </button>
            <p className="text-[10px] text-slate-400 mt-2 text-center">Requires order to be in &apos;shipped&apos; state.</p>
          </div>

          <div className="border-t-2 border-dashed border-slate-200 pt-6">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">2</span>
              Delivery & Release
            </h3>
            
            <div className="mb-4">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Buyer&apos;s 6-Digit PIN
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 font-mono tracking-[0.2em] text-lg font-bold"
                />
              </div>
            </div>

            <button
              onClick={() => handleAction('verify_delivery')}
              disabled={loading || !orderId || pin.length !== 6}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              Verify & Complete Delivery
            </button>
            <p className="text-[10px] text-slate-400 mt-2 text-center">Requires order to be &apos;out_for_delivery&apos; and correct PIN.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
