import { supabase } from './supabase';

export interface PaymobSession {
  paymentToken: string;
  paymobOrderId: string | number;
  iframeUrl: string;
}

interface StartSessionParams {
  purpose: 'order' | 'boost';
  referenceId: string;
  tier?: string;
  billingData: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    city?: string;
    state?: string;
    street?: string;
  };
}

export async function startPaymobCheckoutSession(
  params: StartSessionParams,
): Promise<PaymobSession> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Authentication required');
  }

  const res = await fetch('/api/paymob/session', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to start payment session');
  }

  return {
    paymentToken: data.paymentToken,
    paymobOrderId: data.paymobOrderId,
    iframeUrl: data.iframeUrl,
  };
}
