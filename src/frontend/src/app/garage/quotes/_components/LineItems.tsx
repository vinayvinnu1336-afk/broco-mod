'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { GarageQuoteLineItemDto, QuoteLineType } from '@/types/garageQuote';
import { formatINR } from '@/lib/format';

/** Line item as edited on the phone. Mirrors CreateQuoteLineItemRequest plus a local key. */
export interface LocalLineItem {
  id: string;
  lineType: QuoteLineType;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
}

export const LINE_TYPES: { value: QuoteLineType; label: string }[] = [
  { value: 'Labour', label: 'Labour' },
  { value: 'Part', label: 'Part' },
  { value: 'Service', label: 'Service' },
  { value: 'Other', label: 'Other' },
];

export function newLineItem(): LocalLineItem {
  return {
    id: Math.random().toString(36).substring(2, 9),
    lineType: 'Labour',
    description: '',
    quantity: 1,
    unitPrice: 0,
    discountAmount: 0,
  };
}

export interface LineCalc {
  gross: number;
  discount: number;
  lineTotal: number;
}

export function calcLine(item: LocalLineItem): LineCalc {
  const gross = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  const discount = Number(item.discountAmount) || 0;
  const lineTotal = Math.max(0, gross - discount);
  return { gross, discount, lineTotal };
}

export function calcTotals(items: LocalLineItem[]) {
  const calcs = items.map(calcLine);
  const subtotal = calcs.reduce((acc, c) => acc + c.gross, 0);
  const discount = calcs.reduce((acc, c) => acc + c.discount, 0);
  return { calcs, subtotal, discount, total: subtotal - discount };
}

const numberInputProps = {
  type: 'number' as const,
  inputMode: 'decimal' as const,
  className: 'tabular-nums',
};

interface LineItemsEditorProps {
  items: LocalLineItem[];
  onChange: (id: string, updates: Partial<LocalLineItem>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

/** Stacked, thumb-friendly line item cards with add/remove. */
export function LineItemsEditor({ items, onChange, onAdd, onRemove, disabled }: LineItemsEditorProps) {
  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const calc = calcLine(item);
        const key = `li-${item.id}`;
        return (
          <div key={item.id} className="rounded-2xl border border-surface-200 bg-white p-4 shadow-card sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-navy-900">Item {idx + 1}</span>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                disabled={disabled || items.length <= 1}
                className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-xl text-navy-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-navy-400"
                aria-label={`Remove item ${idx + 1}`}
                title={items.length <= 1 ? 'A quote needs at least one item' : 'Remove item'}
              >
                <Trash2 className="h-[18px] w-[18px]" />
              </button>
            </div>

            <div className="space-y-3">
              <div role="radiogroup" aria-label={`Item ${idx + 1} type`} className="grid grid-cols-4 gap-1.5">
                {LINE_TYPES.map((t) => {
                  const active = item.lineType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={disabled}
                      onClick={() => onChange(item.id, { lineType: t.value })}
                      className={`min-h-[40px] rounded-xl border px-1 text-sm font-medium transition touch-manipulation ${
                        active
                          ? 'border-navy-900 bg-navy-900 text-white'
                          : 'border-surface-200 bg-white text-navy-600 hover:border-surface-300'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <Input
                id={`${key}-desc`}
                label="Description"
                value={item.description}
                onChange={(e) => onChange(item.id, { description: e.target.value })}
                placeholder="e.g. Front brake pads"
                disabled={disabled}
              />

              <div className="grid grid-cols-3 gap-3">
                <Input
                  {...numberInputProps}
                  id={`${key}-qty`}
                  label="Qty"
                  min="0.1"
                  step="0.5"
                  value={item.quantity}
                  onChange={(e) => onChange(item.id, { quantity: Number(e.target.value) || 0 })}
                  disabled={disabled}
                />
                <Input
                  {...numberInputProps}
                  id={`${key}-price`}
                  label="Price (₹)"
                  min="0"
                  step="10"
                  value={item.unitPrice}
                  onChange={(e) => onChange(item.id, { unitPrice: Number(e.target.value) || 0 })}
                  disabled={disabled}
                />
                <Input
                  {...numberInputProps}
                  id={`${key}-disc`}
                  label="Discount (₹)"
                  min="0"
                  step="10"
                  value={item.discountAmount}
                  onChange={(e) => onChange(item.id, { discountAmount: Number(e.target.value) || 0 })}
                  disabled={disabled}
                />
              </div>

              <div className="flex items-baseline justify-between gap-3 border-t border-surface-200 pt-3">
                <span className="text-xs text-navy-500">
                  {calc.discount > 0 ? `Item total · ${formatINR(calc.discount)} off` : 'Item total'}
                </span>
                <span className="text-base font-semibold tabular-nums text-navy-900">{formatINR(calc.lineTotal)}</span>
              </div>
            </div>
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        onClick={onAdd}
        disabled={disabled}
        leftIcon={<Plus className="h-4 w-4" />}
        className="w-full border-dashed"
      >
        Add item
      </Button>
    </div>
  );
}

/** Read-only line items (submitted quotes). */
export function LineItemsList({ items }: { items: GarageQuoteLineItemDto[] }) {
  if (items.length === 0) {
    return <p className="rounded-2xl border border-dashed border-surface-300 bg-white p-4 text-sm text-navy-500">No items on this quote.</p>;
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-card divide-y divide-surface-200/80">
      {items.map((item) => (
        <div key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[15px] font-semibold leading-snug text-navy-900 break-words">{item.description}</div>
            <div className="mt-0.5 text-xs text-navy-500">
              {item.lineType} · {item.quantity} × {formatINR(item.unitPrice)}
              {item.discountAmount > 0 ? ` · ${formatINR(item.discountAmount)} off` : ''}
            </div>
          </div>
          <div className="shrink-0 text-sm font-semibold tabular-nums text-navy-900">{formatINR(item.lineTotal)}</div>
        </div>
      ))}
    </div>
  );
}

/** Subtotal / discount / total block. */
export function TotalsSummary({
  subtotal,
  discount,
  total,
}: {
  subtotal: number;
  discount: number;
  total: number;
}) {
  return (
    <dl className="space-y-2 rounded-2xl border border-surface-200 bg-white p-4 text-sm shadow-card sm:p-5">
      <div className="flex justify-between text-navy-600">
        <dt>Subtotal</dt>
        <dd className="tabular-nums">{formatINR(subtotal)}</dd>
      </div>
      <div className="flex justify-between text-navy-600">
        <dt>Discounts</dt>
        <dd className="tabular-nums">{discount > 0 ? `− ${formatINR(discount)}` : formatINR(0)}</dd>
      </div>
      <div className="flex items-baseline justify-between border-t border-surface-200 pt-2">
        <dt className="font-semibold text-navy-900">Quote total</dt>
        <dd className="text-lg font-bold tabular-nums text-navy-900">{formatINR(total)}</dd>
      </div>
    </dl>
  );
}

/** ActionBar summary: label + total. */
export function TotalSummaryLabel({ total, label = 'Total' }: { total: number; label?: string }) {
  return (
    <div className="leading-tight">
      <div className="text-xs text-navy-500">{label}</div>
      <div className="truncate text-base font-bold tabular-nums text-navy-900">{formatINR(total)}</div>
    </div>
  );
}
