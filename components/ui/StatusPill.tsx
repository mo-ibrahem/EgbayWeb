'use client';

import React from 'react';
import {
  Clock, ShieldCheck, Truck, Navigation, PackageCheck,
  CheckCircle2, AlertTriangle, XCircle, RotateCcw,
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

export type OrderStatus =
  | 'pending_payment'
  | 'escrow_secured'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'completed'
  | 'disputed'
  | 'cancelled'
  | 'refunded';

// One fixed mapping of status -> icon, color, and label. This is the
// only place order status gets a color, so the same status can never
// look different on the orders list vs. the order detail page vs. an
// admin surface.
//
// Tone is grouped by what the color should tell you at a glance, not by
// giving every status its own hue (five semantic tones can't distinguish
// nine statuses without collisions, and diluting them further would make
// "danger"/"success" mean less everywhere else they're used):
//   warning = something is waiting on YOU right now
//   info    = actively moving (in transit)
//   neutral = paid and calm, nothing to do but wait
//   success / danger = terminal good / bad
// escrow_secured used to share "info" with shipped/out_for_delivery,
// which meant a list of mostly-still-in-escrow orders all rendered the
// identical blue pill as the one order that was actually moving --
// exactly the scannability problem StatusPill exists to prevent.
const STATUS_CONFIG: Record<
  OrderStatus,
  { icon: React.ElementType; tone: string; label: string; label_ar: string }
> = {
  pending_payment:  { icon: Clock,          tone: 'warning', label: 'Payment Pending',  label_ar: 'بانتظار الدفع' },
  escrow_secured:   { icon: ShieldCheck,    tone: 'neutral', label: 'In Escrow',        label_ar: 'محمي بالضمان' },
  shipped:          { icon: Truck,          tone: 'info',    label: 'Shipped',          label_ar: 'تم الشحن' },
  out_for_delivery: { icon: Navigation,     tone: 'info',    label: 'Out for Delivery', label_ar: 'في الطريق للتسليم' },
  delivered:        { icon: PackageCheck,   tone: 'warning', label: 'Delivered — Confirm Receipt', label_ar: 'تم التسليم — أكّد الاستلام' },
  completed:        { icon: CheckCircle2,   tone: 'success', label: 'Completed',        label_ar: 'مكتمل' },
  disputed:         { icon: AlertTriangle,  tone: 'danger',  label: 'Disputed',         label_ar: 'نزاع مفتوح' },
  cancelled:        { icon: XCircle,        tone: 'neutral', label: 'Cancelled',        label_ar: 'ملغي' },
  refunded:         { icon: RotateCcw,      tone: 'neutral', label: 'Refunded',         label_ar: 'تم الاسترداد' },
};

const TONE_CLASSES: Record<string, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

export default function StatusPill({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const { isRTL } = useLanguage();
  const config = STATUS_CONFIG[status as OrderStatus];

  if (!config) {
    // Unknown status: show it plainly rather than silently guessing a
    // color/meaning for something the mapping doesn't account for.
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md bg-slate-100 text-slate-600">
        {status}
      </span>
    );
  }

  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span className={`inline-flex items-center rounded-md font-bold whitespace-nowrap ${TONE_CLASSES[config.tone]} ${sizeClasses}`}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {isRTL ? config.label_ar : config.label}
    </span>
  );
}
