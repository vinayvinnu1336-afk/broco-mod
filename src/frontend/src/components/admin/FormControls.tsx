'use client';

import React, { ReactNode, useId } from 'react';
import { Check } from 'lucide-react';

/** A full-width on/off row (44px+ tap target) for admin forms: label + description + switch. */
export function ToggleField({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={`flex min-h-[52px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 transition hover:border-surface-300 ${
        disabled ? 'cursor-not-allowed opacity-60' : ''
      }`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-navy-900">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-navy-500">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0 items-center">
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          aria-hidden="true"
          className={`h-7 w-12 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-electric-600 peer-focus-visible:ring-offset-2 ${
            checked ? 'bg-electric-600' : 'bg-surface-300'
          }`}
        />
        <span
          aria-hidden="true"
          className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </label>
  );
}

export interface ChoiceOption {
  value: string;
  label: string;
}

/** Wrapping chips for picking one or several values (fuels, statuses). 44px tall on phones. */
export function ChoiceChips({
  label,
  options,
  value,
  onChange,
  multiple = false,
  error,
  helperText,
  required = false,
}: {
  label?: string;
  options: ChoiceOption[];
  value: string[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
  error?: string;
  helperText?: string;
  required?: boolean;
}) {
  const groupId = useId();
  const toggle = (v: string) => {
    if (!multiple) {
      onChange([v]);
      return;
    }
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  return (
    <div className="w-full">
      {label && (
        <div id={groupId} className="mb-1.5 block text-sm font-medium text-navy-800">
          {label}
          {required && <span className="ml-1 text-semantic-error">*</span>}
        </div>
      )}
      <div role="group" aria-labelledby={label ? groupId : undefined} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={active}
              onClick={() => toggle(option.value)}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3.5 text-sm font-medium transition touch-manipulation sm:min-h-[40px] ${
                active
                  ? 'border-electric-600 bg-electric-50 text-electric-700'
                  : 'border-surface-200 bg-white text-navy-600 hover:border-surface-300 hover:text-navy-900'
              }`}
            >
              {multiple && active && <Check className="h-4 w-4" aria-hidden="true" />}
              {option.label}
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-semantic-error">{error}</p>
      ) : (
        helperText && <p className="mt-1 text-xs text-navy-500">{helperText}</p>
      )}
    </div>
  );
}

/** Label / value line used inside detail sheets. */
export function DetailRow({ label, value, strong = false }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 py-2 text-sm ${strong ? 'font-semibold text-navy-900' : ''}`}>
      <span className={strong ? '' : 'text-navy-500'}>{label}</span>
      <span className={`text-right tabular-nums ${strong ? '' : 'text-navy-900'} break-words`}>{value}</span>
    </div>
  );
}

/** Inline error box shown inside sheets and forms. */
export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
      {message}
    </div>
  );
}

/** Paged list envelope returned by admin list endpoints. */
export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages?: number;
}
