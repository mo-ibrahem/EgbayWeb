export interface AppNotification {
  id: string;
  userId: string;
  type: 'item_sold' | 'order_confirmed' | 'escrow_held' | 'escrow_released' | 'out_for_delivery';
  title: string;
  title_ar: string;
  message: string;
  message_ar: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: string;
}

const NOTIFICATIONS_STORAGE_KEY = 'egbay_user_notifications';

export function getNotifications(userId: string): AppNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${NOTIFICATIONS_STORAGE_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveNotification(notif: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): AppNotification {
  const newNotif: AppNotification = {
    ...notif,
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    read: false,
    createdAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      const current = getNotifications(notif.userId);
      const updated = [newNotif, ...current].slice(0, 50);
      localStorage.setItem(`${NOTIFICATIONS_STORAGE_KEY}_${notif.userId}`, JSON.stringify(updated));
    } catch (e) {
      console.warn('[NotificationService] Failed to save to localStorage:', e);
    }
  }

  return newNotif;
}

export function notifyItemSold(sellerId: string, itemTitle: string, amountEgp: number, orderId: string, buyerName?: string): AppNotification {
  return saveNotification({
    userId: sellerId,
    type: 'item_sold',
    title: '🎉 Item Sold! (New Order)',
    title_ar: '🎉 تم بيع سلعتك! (طلب جديد)',
    message: `${buyerName || 'A buyer'} ordered "${itemTitle}" for EGP ${amountEgp.toLocaleString()}. Net payout is secured in your Escrow Pending Balance.`,
    message_ar: `قام مشتري بطلب "${itemTitle}" بقيمة ${amountEgp.toLocaleString()} ج.م. الأرباح محجوزة بأمان في رصيد الضمان المعلق.`,
    data: { orderId, itemTitle, amountEgp },
  });
}
