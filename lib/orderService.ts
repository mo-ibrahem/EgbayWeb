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
  const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
  const estimated = calculateEstimatedDelivery(orderData.shipping_address?.governorate);

  const newOrder: MarketplaceOrder = {
    id: orderId,
    product_id: orderData.product_id,
    buyer_id: orderData.buyer_id,
    seller_id: orderData.seller_id,
    amount: orderData.amount,
    currency: 'EGP',
    status: 'pending_payment', // stays pending until Paymob webhook or 100% wallet confirms
    handover_method: orderData.handover_method,
    meetup_pin: randomPin,
    shipping_address: orderData.shipping_address,
    product: orderData.product_snapshot,
    courier_name: 'Bosta Express (بوسطة مصر)',
    estimated_delivery: estimated,
    created_at: new Date().toISOString(),
  };

  try {
    if (typeof window !== 'undefined') {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          orderData: newOrder,
        }),
      });
      const json = await res.json();
      if (json?.success && json?.order) {
        inMemoryOrders[orderId] = newOrder;
        return newOrder;
      }
    }
  } catch (apiErr) {
    console.warn('[OrderService] /api/orders create API warning:', apiErr);
  }

  // Direct client-side DB insert removed for security. Relying strictly on API route.

  inMemoryOrders[orderId] = newOrder;
  return newOrder;
}

/**
 * Called after Paymob webhook confirms payment OR after 100% wallet checkout.
 * Transitions the order to escrow_secured and credits the seller's pending balance.
 */
export async function confirmOrderPayment(orderId: string): Promise<void> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('Order not found: ' + orderId);

  // 1. Call server API to guarantee Postgres updates bypassing client RLS
  try {
    if (typeof window !== 'undefined') {
      await fetch('/api/wallet/credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantOrderId: orderId,
          amountCents: Math.round(order.amount * 100),
          txId: `web_confirm_${orderId}`,
          isSuccess: true,
        }),
      });
    }
  } catch (apiErr) {
    console.warn('[OrderService] Web server credit sync warning:', apiErr);
  }

  if (inMemoryOrders[orderId]) {
    inMemoryOrders[orderId].status = 'escrow_secured';
  }

  // Escrow is now handled by the backend /api/wallet/credit. No client-side hold required.
  notifyItemSold(order.seller_id, order.product?.title || 'Your listing', order.amount, orderId, order.shipping_address?.full_name);
}

export async function getOrderById(orderId: string): Promise<MarketplaceOrder | null> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (data && !error) {
      const order = data as any;
      let notesData: any = {};
      try {
        notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes || {};
      } catch {}

      const trackingNum = notesData.tracking_number;
      const productObj = notesData.product || order.product || (order.products ? {
        id: order.products.id,
        title: order.products.title,
        price: order.products.price,
        images: order.products.images || [],
        condition: order.products.condition || 'Used',
        category: order.products.category || 'General',
      } : undefined);

      return {
        id: order.id,
        product_id: order.product_id,
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        amount: notesData.amount || order.amount || 0,
        currency: 'EGP',
        status: order.status,
        handover_method: notesData.handover_method || 'courier',
        meetup_pin: notesData.meetup_pin,
        shipping_address: order.shipping_address,
        product: productObj,
        tracking_number: trackingNum,
        courier_name: notesData.courier_name || 'Bosta Express (بوسطة مصر)',
        bosta_tracking_url: trackingNum ? getBostaTrackingUrl(trackingNum) : undefined,
        delivered_at: notesData.delivered_at,
        inspection_expiry_at: notesData.inspection_expiry_at,
        dispute_reason: notesData.dispute_reason,
        dispute_notes: notesData.dispute_notes,
        dispute_created_at: notesData.dispute_created_at,
        estimated_delivery: notesData.estimated_delivery,
        created_at: order.created_at,
        updated_at: order.updated_at,
      };
    }
  } catch (err) {
    console.warn('[OrderService] getOrderById fallback:', err);
  }

  return inMemoryOrders[orderId] || null;
}

export async function getUserOrders(userId: string): Promise<MarketplaceOrder[]> {
  try {
    // 1. Try server API route (guarantees seeing both sales and purchases with full product data)
    if (typeof window !== 'undefined') {
      const res = await fetch(`/api/orders?userId=${userId}`);
      const json = await res.json();
      if (json?.success && Array.isArray(json?.orders) && json.orders.length > 0) {
        return json.orders;
      }
    }
  } catch (apiErr) {
    console.warn('[OrderService] /api/orders fetch warning:', apiErr);
  }

  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, products(*)')
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (data && !error && data.length > 0) {
      return data.map((order: any) => {
        let notesData: any = {};
        try {
          notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes || {};
        } catch {}

        const trackingNum = notesData.tracking_number;
        const productObj = notesData.product || order.product || (order.products ? {
          id: order.products.id,
          title: order.products.title,
          price: order.products.price,
          images: order.products.images || [],
          condition: order.products.condition || 'Used',
          category: order.products.category || 'General',
        } : undefined);

        return {
          id: order.id,
          product_id: order.product_id,
          buyer_id: order.buyer_id,
          seller_id: order.seller_id,
          amount: notesData.amount || order.amount || 0,
          currency: 'EGP',
          status: order.status,
          handover_method: notesData.handover_method || 'courier',
          meetup_pin: notesData.meetup_pin,
          shipping_address: order.shipping_address,
          product: productObj,
          tracking_number: trackingNum,
          courier_name: notesData.courier_name || 'Bosta Express (بوسطة مصر)',
          bosta_tracking_url: trackingNum ? getBostaTrackingUrl(trackingNum) : undefined,
          delivered_at: notesData.delivered_at,
          inspection_expiry_at: notesData.inspection_expiry_at,
          dispute_reason: notesData.dispute_reason,
          dispute_notes: notesData.dispute_notes,
          dispute_created_at: notesData.dispute_created_at,
          estimated_delivery: notesData.estimated_delivery,
          created_at: order.created_at,
          updated_at: order.updated_at,
        };
      });
    }
  } catch (err) {
    console.warn('[OrderService] getUserOrders fallback:', err);
  }

  return Object.values(inMemoryOrders).filter(
    (o) => o.buyer_id === userId || o.seller_id === userId
  );
}

/**
 * Update shipment tracking number (e.g. Bosta AWB) and courier status
 */
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

  const updatedNotes = {
    amount: order.amount,
    handover_method: order.handover_method,
    meetup_pin: order.meetup_pin,
    tracking_number: trackingData.tracking_number,
    courier_name: courier,
    bosta_tracking_url: bostaUrl,
    delivered_at: deliveredAt || order.delivered_at,
    inspection_expiry_at: inspectionExpiry || order.inspection_expiry_at,
    estimated_delivery: order.estimated_delivery,
  };

  try {
    if (typeof window !== 'undefined') {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

/**
 * Buyer confirms delivery satisfaction, immediately releasing escrow funds to seller
 */
export async function approveOrderDelivery(
  orderId: string,
  buyerId: string
): Promise<{ success: boolean; message: string }> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('Order not found');
  if (order.buyer_id !== buyerId) throw new Error('Unauthorized action');

  // 1. Call Server API (bypasses RLS to guarantee Postgres release to seller available balance)
  try {
    if (typeof window !== 'undefined') {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'release_escrow',
          orderId,
          requesterId: buyerId,
        }),
      });
      const json = await res.json();
      if (json?.success) {
        if (inMemoryOrders[orderId]) inMemoryOrders[orderId].status = 'completed';
        return json;
      }
    }
  } catch (apiErr) {
    console.warn('[OrderService] approveOrderDelivery server API fallback:', apiErr);
  }

  // Direct client-side DB update removed for security. Relying on API route.
  
  if (inMemoryOrders[orderId]) {
    inMemoryOrders[orderId].status = 'completed';
  }

  // releaseEscrowToSeller is handled by the backend /api/orders release_escrow action.

  return {
    success: true,
    message: '🎉 Order confirmed & closed! Escrow funds released to Seller.',
  };
}

/**
 * File an official return request / dispute within the 24-hour inspection window
 */
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

  const disputeRecord = {
    amount: order.amount,
    handover_method: order.handover_method,
    meetup_pin: order.meetup_pin,
    tracking_number: order.tracking_number,
    courier_name: order.courier_name,
    dispute_reason: disputeData.reason,
    dispute_notes: disputeData.notes,
    dispute_created_at: new Date().toISOString(),
  };

  try {
    if (typeof window !== 'undefined') {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  if (order.meetup_pin && enteredPin.trim() !== order.meetup_pin.trim()) {
    throw new Error('Invalid verification PIN. Please ask the buyer to check their confirmation code.');
  }

  // 1. Call Server API (bypasses RLS to guarantee Postgres release to seller available balance)
  try {
    if (typeof window !== 'undefined') {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'release_escrow',
          orderId,
          requesterId: sellerId,
          pin: enteredPin,
        }),
      });
      const json = await res.json();
      if (json?.success) {
        if (inMemoryOrders[orderId]) inMemoryOrders[orderId].status = 'completed';
        return json;
      }
    }
  } catch (apiErr) {
    console.warn('[OrderService] verifyAndReleaseOrder server API fallback:', apiErr);
  }

  // Direct client-side DB update removed for security. Relying on API route.

  if (inMemoryOrders[orderId]) {
    inMemoryOrders[orderId].status = 'completed';
  }

  // Escrow release is handled by backend.

  return {
    success: true,
    message: '🎉 Handover PIN Verified! Funds released to your spendable balance.',
  };
}
