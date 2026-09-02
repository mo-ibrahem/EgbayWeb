'use client';

import React from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark active:bg-brand-dark disabled:bg-brand/50',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300',
  outline: 'bg-white text-slate-700 border border-slate-300 hover:border-slate-400 hover:bg-slate-50',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'bg-danger text-white hover:brightness-95 disabled:bg-danger/50',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'text-xs px-3 py-1.5 gap-1.5 rounded-md',
  md: 'text-sm px-4 py-2.5 gap-2 rounded-md',
  lg: 'text-sm px-5 py-3 gap-2 rounded-lg',
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

type ButtonAsButton = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type ButtonAsLink = CommonProps & { href: string; target?: string; rel?: string };

/**
 * The one button component for Egbay. Renders a <button> normally, or a
 * Next.js <Link> when `href` is passed -- so a "primary CTA" always looks
 * the same whether it navigates or submits. Border-radius/shadow/weight
 * are fixed per variant so nobody has to reinvent a button's look inline.
 */
export default function Button(props: ButtonAsButton | ButtonAsLink) {
  const {
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    icon,
    className = '',
    children,
    ...rest
  } = props as CommonProps & Record<string, any>;

  const classes = `inline-flex items-center justify-center font-bold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${fullWidth ? 'w-full' : ''} ${className}`;

  const content = (
    <>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </>
  );

  if ('href' in props && props.href) {
    const { href, target, rel } = props as ButtonAsLink;
    return (
      <Link href={href} target={target} rel={rel} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button className={classes} disabled={loading || (rest as any).disabled} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {content}
    </button>
  );
}
