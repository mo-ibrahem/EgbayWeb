import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';

type Tone = 'success' | 'warning' | 'danger' | 'info';

const CONFIG: Record<Tone, { icon: React.ElementType; classes: string }> = {
  success: { icon: CheckCircle2, classes: 'bg-success-soft border-success/20 text-success' },
  warning: { icon: AlertTriangle, classes: 'bg-warning-soft border-warning/20 text-warning' },
  danger:  { icon: XCircle,       classes: 'bg-danger-soft border-danger/20 text-danger' },
  info:    { icon: Info,          classes: 'bg-info-soft border-info/20 text-info' },
};

/**
 * Inline banner for form errors, confirmations, and warnings -- the one
 * component for "something the user needs to notice right here," used
 * in place of ad hoc colored <div>s scattered through forms.
 */
export default function Alert({
  tone = 'info',
  children,
  className = '',
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  const { icon: Icon, classes } = CONFIG[tone];
  return (
    <div className={`flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-xs font-medium leading-relaxed ${classes} ${className}`}>
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
