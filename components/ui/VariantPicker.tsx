'use client';

import React from 'react';
import type { ProductVariant } from '@/lib/products';

type Axis = 'storage' | 'color' | 'grade';
export type VariantSelection = Partial<Record<Axis, string>>;

const AXES: { key: Axis; label: string; label_ar: string }[] = [
  { key: 'storage', label: 'Storage', label_ar: 'السعة' },
  { key: 'color', label: 'Colour', label_ar: 'اللون' },
  { key: 'grade', label: 'Condition', label_ar: 'الحالة' },
];

/** Distinct non-null values of one axis, in listing order. */
function values(variants: ProductVariant[], axis: Axis): string[] {
  return [...new Set(variants.map((v) => v[axis]).filter((x): x is string => !!x))];
}

/** Axes with more than one choice -- a single-valued axis is not a choice. */
function choiceAxes(variants: ProductVariant[]) {
  return AXES.filter((a) => values(variants, a.key).length > 1);
}

/** In-stock variants matching every axis set in `sel`, ignoring `skip`. */
function inStockMatching(variants: ProductVariant[], sel: VariantSelection, skip?: Axis) {
  return variants.filter(
    (v) => v.stock > 0 && AXES.every((a) => a.key === skip || !sel[a.key] || v[a.key] === sel[a.key]),
  );
}

/** The one in-stock variant the selection points at, or null until every choice is made. */
export function resolveVariant(variants: ProductVariant[], sel: VariantSelection): ProductVariant | null {
  if (choiceAxes(variants).some((a) => !sel[a.key])) return null;
  return inStockMatching(variants, sel)[0] ?? null;
}

export default function VariantPicker({
  variants,
  selection,
  onChange,
  isRTL = false,
}: {
  variants: ProductVariant[];
  selection: VariantSelection;
  onChange: (next: VariantSelection) => void;
  isRTL?: boolean;
}) {
  const axes = choiceAxes(variants);

  const pick = (axis: Axis, value: string) => {
    const next: VariantSelection = { ...selection, [axis]: value };
    // Drop any other choice the new one makes impossible.
    for (const a of axes) {
      if (a.key !== axis && next[a.key] && inStockMatching(variants, next).length === 0) delete next[a.key];
    }
    onChange(next);
  };

  return (
    <div className="space-y-3.5">
      {axes.map((a) => (
        <div key={a.key}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">
            {isRTL ? a.label_ar : a.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {values(variants, a.key).map((val) => {
              // Disabled only when no unit with this option is in stock.
              const enabled = variants.some((v) => v[a.key] === val && v.stock > 0);
              const active = selection[a.key] === val;
              return (
                <button
                  key={val}
                  type="button"
                  disabled={!enabled}
                  aria-pressed={active}
                  onClick={() => pick(a.key, val)}
                  className={`text-xs font-bold px-3 py-2 rounded-md border transition-colors ${
                    active
                      ? 'bg-brand-soft border-brand text-brand-dark'
                      : enabled
                        ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
                        : 'bg-slate-50 border-slate-100 text-slate-300 line-through cursor-not-allowed'
                  }`}
                >
                  {val}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
