// EgyBay Web — Paymob Payment Service
// 3-step flow: Auth → Create Order → Get Payment Key
// NOTE: For production, move PAYMOB_API_KEY to a Next.js server action or route handler.

const PAYMOB_API_KEY =
  process.env.NEXT_PUBLIC_PAYMOB_API_KEY ||
  'ZXlKaGJHY2lPaUpJVXpVeE1pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SmpiR0Z6Y3lJNklrMWxjbU5vWVc1MElpd2ljSEp2Wm1sc1pWOXdheUk2TVRBM05EWXhNeXdpYm1GdFpTSTZJbWx1YVhScFlXd2lmUS4zY1FHdS1Eck1VTTRjXzZKcVR4WkhQWTh0cUlLdTJGOFpndXNNcHowNkZIUTg3NjlfRG96N0ZGazluWFRuMi1sT3FSZnhBSW55QnNLRmFBV3lnbGdKZw==';
const PAYMOB_INTEGRATION_ID = Number(
  process.env.NEXT_PUBLIC_PAYMOB_INTEGRATION_ID || '5267608',
);
const PAYMOB_IFRAME_ID = process.env.NEXT_PUBLIC_PAYMOB_IFRAME_ID || '957263';

export interface PaymobSession {
  paymentToken: string;
  paymobOrderId: string | number;
  iframeUrl: string;
}

interface StartSessionParams {
  amountEgp: number;
  merchantOrderId: string;
  itemName: string;
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
  const amountCents = Math.round(params.amountEgp * 100);

  // Step 1: Auth
  const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: PAYMOB_API_KEY }),
  });
  if (!authRes.ok) throw new Error(`Paymob auth failed: ${authRes.status}`);
  const { token: authToken } = await authRes.json();
  if (!authToken) throw new Error('Paymob did not return an auth token.');

  // Step 2: Create Order
  const orderRes = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: authToken,
      delivery_needed: 'false',
      amount_cents: amountCents,
      currency: 'EGP',
      merchant_order_id: params.merchantOrderId,
      items: [{ name: params.itemName, amount_cents: amountCents, description: params.itemName, quantity: 1 }],
    }),
  });
  if (!orderRes.ok) throw new Error(`Paymob order creation failed: ${orderRes.status}`);
  const orderData = await orderRes.json();
  const paymobOrderId = orderData.id;
  if (!paymobOrderId) throw new Error('Paymob did not return an order ID.');

  // Step 3: Payment Key
  const { billingData: b } = params;
  const keyRes = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: authToken,
      amount_cents: amountCents,
      expiration: 3600,
      order_id: paymobOrderId,
      billing_data: {
        apartment: 'NA', floor: 'NA', building: 'NA',
        shipping_method: 'NA', postal_code: 'NA',
        first_name: b.first_name,
        last_name: b.last_name,
        email: b.email,
        phone_number: b.phone_number || '+201000000000',
        street: b.street || 'NA',
        city: b.city || 'Cairo',
        country: 'EG',
        state: b.state || 'Cairo',
      },
      currency: 'EGP',
      integration_id: PAYMOB_INTEGRATION_ID,
      lock_order_when_paid: 'false',
    }),
  });
  if (!keyRes.ok) throw new Error(`Paymob payment key failed: ${keyRes.status}`);
  const keyData = await keyRes.json();
  const paymentToken: string = keyData.token;
  if (!paymentToken) throw new Error('Paymob did not return a payment token.');

  const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${PAYMOB_IFRAME_ID}?payment_token=${paymentToken}`;
  return { paymentToken, paymobOrderId, iframeUrl };
}
