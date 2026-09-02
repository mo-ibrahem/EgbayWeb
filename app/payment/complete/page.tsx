'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

// Same shape check the paymob-webhook edge function uses to tell a
// wallet top-up (merchant_order_id: "topup_<uuid>") apart from a
// marketplace order (merchant_order_id: the order's own uuid, no
// prefix) -- kept identical so this page and the webhook never
// disagree about what a given transaction was for.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The single landing page Paymob is configured to redirect to after a
 * card payment (Paymob dashboard -> Payment Integrations -> Redirect
 * URL). That field holds exactly one static URL for the whole
 * integration, and this integration is shared by both wallet top-ups
 * and marketplace order checkout -- Paymob has no way to point back at
 * a specific order's own checkout page. Hardcoding the dashboard field
 * to /wallet (its previous value) meant every successful order payment
 * also dumped the buyer on the wallet page instead of their order.
 *
 * The fix isn't a smarter static URL -- there isn't one, since the
 * field can't be templated per-transaction. It's this page: Paymob
 * appends the transaction's own merchant_order_id to the redirect
 * regardless of what it was for, so reading that and routing based on
 * its shape is the only way one static URL can serve both flows
 * correctly. Route the Paymob dashboard's Redirect URL here.
 */
function PaymentCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isRTL } = useLanguage();

  useEffect(() => {
    const merchantOrderId = searchParams.get('merchant_order_id') || searchParams.get('order') || searchParams.get('id') || '';

    if (merchantOrderId.startsWith('topup_')) {
      // Wallet page already knows how to finish this off -- it reads
      // success/merchant_order_id itself and polls /api/wallet/topup/status.
      // Forward every param unchanged rather than re-deriving what it needs.
      router.replace(`/wallet?${searchParams.toString()}`);
      return;
    }

    if (UUID_RE.test(merchantOrderId)) {
      router.replace(`/orders/success?orderId=${merchantOrderId}`);
      return;
    }

    // Unrecognized or missing id -- safer to land somewhere a signed-in
    // user can find what happened than on a page that assumes one.
    router.replace('/orders');
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50">
      <Loader2 className="w-7 h-7 text-brand animate-spin" />
      <p className="text-sm text-slate-500">
        {isRTL ? 'جاري تأكيد عملية الدفع...' : 'Confirming your payment...'}
      </p>
    </div>
  );
}

export default function PaymentCompletePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-7 h-7 text-brand animate-spin" />
      </div>
    }>
      <PaymentCompleteContent />
    </Suspense>
  );
}
