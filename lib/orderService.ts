import { supabase } from './supabase';

export interface MarketplaceOrder {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  currency: string;
  status:
    | 'pending_payment'
    | 'escrow_secured'
    | 'shipped'
    | 'out_for_delivery'
    | 'delivered'
    | 'completed'
    | 'disputed'
    | 'cancelled';
  handover_method: 'courier' | 'qr_meetup';
  handover_pin?: string;
  meetup_pin?: string;
  shipping_address?: {
    full_name: string;
    phone: string;
    governorate: string;
    city: string;
    street: string;
    building?: string;
  };
  tracking_number?: string;
  courier_name?: string;
  bosta_tracking_url?: string;
  delivered_at?: string;
  inspection_expiry_at?: string;
  dispute_reason?: string;
  dispute_notes?: string;
  dispute_created_at?: string;
  estimated_delivery?: string;
  product?: {
    id: string;
    title: string;
    price: number;
    images: string[];
    condition: string;
    category: string;
  };
  events?: any[];
  created_at: string;
  updated_at?: string;
}

const inMemoryOrders: Record<string, MarketplaceOrder> = {};

// Must match the courier surcharge hardcoded in the create_marketplace_order
// database function. The order's stored amount/snapshot price already has
// this baked in (there is no separate "base item price" column), so the UI
// derives the delivery fee from this constant rather than from stored data.
export const COURIER_DELIVERY_FEE_EGP = 65;

export function calculateEstimatedDelivery(governorate?: string): string {
  const gov = (governorate || '').toLowerCase();
  if (gov.includes('cairo') || gov.includes('giza') || gov.includes('القاهرة') || gov.includes('الجيزة')) {
    return '24–48 Hours (توصيل خلال ٢٤ إلى ٤٨ ساعة)';
  }
  if (gov.includes('alexandria') || gov.includes('الإسكندرية') || gov.includes('mansoura') || gov.includes('tanta') || gov.includes('الدلتا')) {
    return '48 Hours (توصيل خلال يومين عمل)';
  }
  return '2–3 Business Days (توصيل خلال ٢ إلى ٣ أيام عمل)';
}

export async function createMarketplaceOrder(orderData: {
  product_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  handover_method: 'courier' | 'qr_meetup';
  shipping_address?: MarketplaceOrder['shipping_address'];
  product_snapshot?: MarketplaceOrder['product'];
}): Promise<MarketplaceOrder> {
  const orderId = `ord_${Date.now()}`;
  const estimated = calculateEstimatedDelivery(orderData.shipping_address?.governorate);

  const newOrder: MarketplaceOrder = {
    id: orderId,
    product_id: orderData.product_id,
    buyer_id: orderData.buyer_id,
    seller_id: orderData.seller_id,
    amount: orderData.amount,
    currency: 'EGP',
    status: 'pending_payment',
    handover_method: orderData.handover_method,
    shipping_address: orderData.shipping_address,
    product: orderData.product_snapshot,
    courier_name: 'Bosta Express (بوسطة مصر)',
    estimated_delivery: estimated,
    created_at: new Date().toISOString(),
  };

  try {
    if (typeof window !== 'undefined') {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          action: 'create',
          orderData: newOrder,
        }),
      });
      const json = await res.json();
      if (json?.success && json?.order) {
        json.order.meetup_pin = json.order.handover_pin;
        inMemoryOrders[json.order.id] = json.order; // Uses the backend generated PIN and snapshot
        return json.order;
      } else {
        throw new Error(json?.error || 'Failed to create order on server');
      }
    }
  } catch (apiErr: any) {
    console.error('[OrderService] /api/orders create API error:', apiErr);
    throw new Error(apiErr.message || 'Network error while creating order');
  }

  // Fallback for SSR
  return newOrder;
}

export async function getOrderById(orderId: string): Promise<MarketplaceOrder | null> {
  try {
    if (typeof window !== 'undefined') {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (session) {
        const res = await fetch(`/api/orders?userId=${session.user.id}`, {
          headers: token ? { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' } : {}
        });
        const json = await res.json();
        if (json?.success && Array.isArray(json?.orders)) {
          const found = json.orders.find((o: any) => o.id === orderId);
          if (found) return found;
        }
      }
    }
  } catch (err) {
    console.warn('[OrderService] getOrderById fallback:', err);
  }
  return inMemoryOrders[orderId] || null;
}

export async function getUserOrders(userId: string): Promise<MarketplaceOrder[]> {
  try {
    if (typeof window !== 'undefined') {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await fetch(`/api/orders?userId=${userId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (json?.success && Array.isArray(json?.orders)) {
        return json.orders;
      }
    }
  } catch (apiErr) {
    console.warn('[OrderService] /api/orders fetch warning:', apiErr);
  }

  return Object.values(inMemoryOrders).filter(
    (o) => o.buyer_id === userId || o.seller_id === userId
  );
}
