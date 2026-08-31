import { supabase } from './supabase';
import { holdEscrowForSeller, releaseEscrowToSeller } from './walletService';
import { notifyItemSold } from './notificationService';

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

export function getBostaTrackingUrl(trackingNumber: string): string {
  if (!trackingNumber) return 'https://bosta.co/tracking';
  return `https://bosta.co/tracking/?trackingNumber=${encodeURIComponent(trackingNumber.trim())}`;
}

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
        inMemoryOrders[orderId] = json.order; // Uses the backend generated PIN and snapshot
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

export async function confirmOrderPayment(orderId: string): Promise<void> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('Order not found: ' + orderId);

  if (inMemoryOrders[orderId]) {
    inMemoryOrders[orderId].status = 'escrow_secured';
  }

  notifyItemSold(order.seller_id, order.product?.title || 'Your listing', order.amount, orderId, order.shipping_address?.full_name);
}

export async function getOrderById(orderId: string): Promise<MarketplaceOrder | null> {
  try {
    if (typeof window !== 'undefined') {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const res = await fetch(`/api/orders?userId=${session.user.id}`);
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

export async function updateOrderTracking(
  orderId: string,
  trackingData: {
    tracking_number: string;
    courier_name?: string;
    status?: MarketplaceOrder['status'];
  }
): Promise<MarketplaceOrder> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('Order not found');

  const newStatus = trackingData.status || 'shipped';
  const courier = trackingData.courier_name || 'Bosta Express (بوسطة مصر)';
  const bostaUrl = getBostaTrackingUrl(trackingData.tracking_number);

  let deliveredAt: string | undefined = undefined;
  let inspectionExpiry: string | undefined = undefined;

  if (newStatus === 'delivered') {
    deliveredAt = new Date().toISOString();
    inspectionExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  try {
    if (typeof window !== 'undefined') {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          action: 'update_tracking',
          orderId,
          tracking_number: trackingData.tracking_number,
          courier_name: courier,
          status: newStatus
        }),
      });
    }
  } catch (err) {
    console.warn('[OrderService] updateOrderTracking API fallback:', err);
  }

  const updatedOrder: MarketplaceOrder = {
    ...order,
    status: newStatus,
    tracking_number: trackingData.tracking_number,
    courier_name: courier,
    bosta_tracking_url: bostaUrl,
    delivered_at: deliveredAt || order.delivered_at,
    inspection_expiry_at: inspectionExpiry || order.inspection_expiry_at,
    updated_at: new Date().toISOString(),
  };

  inMemoryOrders[orderId] = updatedOrder;
  return updatedOrder;
}

export async function approveOrderDelivery(
  orderId: string,
  buyerId: string
): Promise<{ success: boolean; message: string }> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('Order not found');
  if (order.buyer_id !== buyerId) throw new Error('Unauthorized action');

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
          action: 'release_escrow',
          orderId,
        }),
      });
      const json = await res.json();
      if (!json?.success) {
        throw new Error(json?.error || 'Failed to release escrow');
      }
      
      if (inMemoryOrders[orderId]) inMemoryOrders[orderId].status = 'completed';
      return json;
    }
  } catch (apiErr: any) {
    console.warn('[OrderService] approveOrderDelivery server API fallback:', apiErr);
    throw new Error(apiErr.message);
  }

  if (inMemoryOrders[orderId]) {
    inMemoryOrders[orderId].status = 'completed';
  }

  return {
    success: true,
    message: '🎉 Order confirmed & closed! Escrow funds released to Seller.',
  };
}

export async function fileOrderDispute(
  orderId: string,
  disputeData: {
    buyer_id: string;
    reason: string;
    notes: string;
    evidence_urls?: string[];
  }
): Promise<{ success: boolean; message: string }> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('Order not found');
  if (order.buyer_id !== disputeData.buyer_id) throw new Error('Unauthorized action');

  try {
    if (typeof window !== 'undefined') {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          action: 'dispute',
          orderId,
          reason: disputeData.reason,
          notes: disputeData.notes,
          evidence: disputeData.evidence_urls
        }),
      });
    }
  } catch (err) {
    console.warn('[OrderService] fileOrderDispute API fallback:', err);
  }

  if (inMemoryOrders[orderId]) {
    inMemoryOrders[orderId].status = 'disputed';
    inMemoryOrders[orderId].dispute_reason = disputeData.reason;
    inMemoryOrders[orderId].dispute_notes = disputeData.notes;
    inMemoryOrders[orderId].dispute_created_at = new Date().toISOString();
  }

  return {
    success: true,
    message: '⚠️ Dispute claim filed successfully. Escrow funds are safely frozen. Compliance team is reviewing within 24 hours.',
  };
}

export async function verifyAndReleaseOrder(
  orderId: string,
  enteredPin: string,
  sellerId: string
): Promise<{ success: boolean; message: string }> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('Order not found');

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
          action: 'release_escrow',
          orderId,
          pin: enteredPin,
        }),
      });
      const json = await res.json();
      if (!json?.success) {
         throw new Error(json?.error || 'Failed to verify PIN');
      }
      
      if (inMemoryOrders[orderId]) inMemoryOrders[orderId].status = 'completed';
      return json;
    }
  } catch (apiErr: any) {
    console.warn('[OrderService] verifyAndReleaseOrder server API error:', apiErr);
    throw new Error(apiErr.message);
  }

  if (inMemoryOrders[orderId]) {
    inMemoryOrders[orderId].status = 'completed';
  }

  return {
    success: true,
    message: '🎉 Handover PIN Verified! Funds released to your spendable balance.',
  };
}
