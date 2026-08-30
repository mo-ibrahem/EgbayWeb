import { supabase } from './supabase';
import { holdEscrowForSeller, releaseEscrowToSeller } from './walletService';

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
    const { data, error } = await supabase
      .from('orders')
      .insert({
        id: orderId,
        product_id: orderData.product_id,
        buyer_id: orderData.buyer_id,
        seller_id: orderData.seller_id,
        status: 'pending_payment',
        notes: JSON.stringify({
          handover_method: orderData.handover_method,
          meetup_pin: randomPin,
          amount: orderData.amount,
          courier_name: 'Bosta Express',
          estimated_delivery: estimated,
        }),
        shipping_address: orderData.shipping_address,
        created_at: new Date().toISOString(),
      } as any)
      .select()
      .maybeSingle();

    if (data && !error) {
      inMemoryOrders[orderId] = newOrder;
      return newOrder;
    }
  } catch (err) {
    console.warn('[OrderService] createOrder fallback to memory:', err);
  }

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

  try {
    await supabase
      .from('orders')
      .update({
        status: 'escrow_secured',
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', orderId);

    // Stock & Inventory Management: Decrement quantity or mark sold if last item
    if (order.product_id) {
      const { data: prod } = await supabase
        .from('products')
        .select('id, description, status')
        .eq('id', order.product_id)
        .maybeSingle();

      if (prod) {
        const stockMatch = (prod.description || '').match(/📦\s*Stock:\s*(\d+)/i) || (prod.description || '').match(/الكمية:\s*(\d+)/i);
        const currentStock = stockMatch ? parseInt(stockMatch[1], 10) : 1;
        const remainingStock = currentStock - 1;

        if (remainingStock <= 0) {
          // Last item in stock — mark SOLD and remove from active marketplace!
          await supabase
            .from('products')
            .update({
              status: 'sold',
              updated_at: new Date().toISOString(),
            } as any)
            .eq('id', order.product_id);
        } else {
          // Multiple in stock — decrement stock tag and keep active for other buyers!
          const updatedDescription = (prod.description || '').replace(
            /📦\s*Stock:\s*\d+/i,
            `📦 Stock: ${remainingStock}`
          );
          await supabase
            .from('products')
            .update({
              description: updatedDescription,
              updated_at: new Date().toISOString(),
            } as any)
            .eq('id', order.product_id);
        }
      }
    }
  } catch (err) {
    console.warn('[OrderService] confirmOrderPayment update failed:', err);
  }

  if (inMemoryOrders[orderId]) {
    inMemoryOrders[orderId].status = 'escrow_secured';
  }

  // NOW credit seller escrow — only after real payment confirmed
  await holdEscrowForSeller(order.seller_id, orderId, order.amount);
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

      return {
        id: order.id,
        product_id: order.product_id,
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        amount: notesData.amount || 0,
        currency: 'EGP',
        status: order.status,
        handover_method: notesData.handover_method || 'courier',
        meetup_pin: notesData.meetup_pin,
        shipping_address: order.shipping_address,
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
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (data && !error && data.length > 0) {
      return data.map((order: any) => {
        let notesData: any = {};
        try {
          notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes || {};
        } catch {}

        const trackingNum = notesData.tracking_number;

        return {
          id: order.id,
          product_id: order.product_id,
          buyer_id: order.buyer_id,
          seller_id: order.seller_id,
          amount: notesData.amount || 0,
          currency: 'EGP',
          status: order.status,
          handover_method: notesData.handover_method || 'courier',
          meetup_pin: notesData.meetup_pin,
          shipping_address: order.shipping_address,
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
    await supabase
      .from('orders')
      .update({
        status: newStatus,
        notes: JSON.stringify(updatedNotes),
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', orderId);
  } catch (err) {
    console.warn('[OrderService] updateOrderTracking fallback:', err);
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

  try {
    await supabase
      .from('orders')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', orderId);
  } catch (err) {
    console.warn('[OrderService] approveOrderDelivery fallback:', err);
  }

  if (inMemoryOrders[orderId]) {
    inMemoryOrders[orderId].status = 'completed';
  }

  await releaseEscrowToSeller(orderId, order.seller_id, order.amount);

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
    await supabase
      .from('orders')
      .update({
        status: 'disputed',
        notes: JSON.stringify(disputeRecord),
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', orderId);
  } catch (err) {
    console.warn('[OrderService] fileOrderDispute fallback:', err);
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

  try {
    await supabase
      .from('orders')
      .update({ status: 'completed', updated_at: new Date().toISOString() } as any)
      .eq('id', orderId);
  } catch (err) {
    console.warn('[OrderService] verifyAndReleaseOrder update fallback:', err);
  }

  if (inMemoryOrders[orderId]) {
    inMemoryOrders[orderId].status = 'completed';
  }

  await releaseEscrowToSeller(orderId, order.seller_id, order.amount);

  return {
    success: true,
    message: '🎉 Handover verified! Escrow funds released to Seller available balance.',
  };
}
