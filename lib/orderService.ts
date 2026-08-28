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

  const newOrder: MarketplaceOrder = {
    id: orderId,
    product_id: orderData.product_id,
    buyer_id: orderData.buyer_id,
    seller_id: orderData.seller_id,
    amount: orderData.amount,
    currency: 'EGP',
    status: 'escrow_secured',
    handover_method: orderData.handover_method,
    meetup_pin: randomPin,
    shipping_address: orderData.shipping_address,
    product: orderData.product_snapshot,
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
        status: 'escrow_secured',
        notes: JSON.stringify({
          handover_method: orderData.handover_method,
          meetup_pin: randomPin,
          amount: orderData.amount,
        }),
        shipping_address: orderData.shipping_address,
        created_at: new Date().toISOString(),
      } as any)
      .select()
      .maybeSingle();

    if (data && !error) {
      await holdEscrowForSeller(orderData.seller_id, orderId, orderData.amount);
      inMemoryOrders[orderId] = newOrder;
      return newOrder;
    }
  } catch (err) {
    console.warn('[OrderService] createOrder fallback to memory:', err);
  }

  await holdEscrowForSeller(orderData.seller_id, orderId, orderData.amount);
  inMemoryOrders[orderId] = newOrder;
  return newOrder;
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
      let notesData = {};
      try {
        notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes || {};
      } catch {}

      return {
        id: order.id,
        product_id: order.product_id,
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        amount: (notesData as any).amount || 0,
        currency: 'EGP',
        status: order.status,
        handover_method: (notesData as any).handover_method || 'courier',
        meetup_pin: (notesData as any).meetup_pin,
        shipping_address: order.shipping_address,
        tracking_number: (notesData as any).tracking_number,
        courier_name: (notesData as any).courier_name || 'Bosta Express',
        created_at: order.created_at,
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
        let notesData = {};
        try {
          notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes || {};
        } catch {}

        return {
          id: order.id,
          product_id: order.product_id,
          buyer_id: order.buyer_id,
          seller_id: order.seller_id,
          amount: (notesData as any).amount || 0,
          currency: 'EGP',
          status: order.status,
          handover_method: (notesData as any).handover_method || 'courier',
          meetup_pin: (notesData as any).meetup_pin,
          shipping_address: order.shipping_address,
          tracking_number: (notesData as any).tracking_number,
          courier_name: (notesData as any).courier_name || 'Bosta Express',
          created_at: order.created_at,
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

export async function verifyAndReleaseOrder(
  orderId: string,
  enteredPin: string,
  buyerId: string
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
