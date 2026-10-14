'use client';

import React, { forwardRef, InputHTMLAttributes, useId, useState } from 'react';
import { INVALID_MOBILE_MESSAGE, isValidIndianMobile, mobileDigits } from '@/lib/phone';

export interface PhoneInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'type' | 'size'> {
  label?: string;
  /** Any format ("9876543210", "+91 98765 43210"); the field shows the 10 national digits. */
  value: string;
  /** Called with the national digits only (0-10 of them). Send `toIndianMobile(value)` to the API. */
  onChange: (digits: string) => void;
  error?: string;
  helperText?: string;
}

/**
 * Indian mobile number field: a fixed +91 prefix and up to 10 digits. Pasting or autofilling a full
 * number ("+91 98765 43210", "09876543210") keeps just the 10 digits. Shows its own error once the
 * field is left with an incomplete or invalid number; a parent `error` takes precedence.
 */
export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      label,
      value,
      onChange,
      error,
      helperText,
      id,
      disabled,
      required,
      className = '',
      placeholder = '10-digit number',
      autoComplete = 'tel-national',
      onBlur,
      onFocus,
      style,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const messageId = `${inputId}-message`;
    const digits = mobileDigits(value);
    // While someone types "+91 …" by hand, show what they type; the digits still go to onChange.
    const [draft, setDraft] = useState<string | null>(null);
    // Checked when the field is left, so nobody is told off halfway through typing.
    const [checkNow, setCheckNow] = useState(false);

    const ownError = checkNow && digits.length > 0 && !isValidIndianMobile(digits) ? INVALID_MOBILE_MESSAGE : undefined;
    const shownError = error || ownError;
    const message = shownError || helperText;

    const update = (raw: string) => {
      const next = mobileDigits(raw);
      setDraft(/^\s*\(?\s*\+/.test(raw) && next.length < 10 ? raw : null);
      onChange(next);
    };

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-navy-800">
            {label}
            {required && <span className="ml-1 text-semantic-error">*</span>}
          </label>
        )}
        <div
          className={`flex min-h-[44px] items-stretch overflow-hidden rounded-xl border transition focus-within:ring-2 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-electric-600 ${
            disabled ? 'cursor-not-allowed bg-surface-100' : 'bg-white'
          } ${
            shownError
              ? 'border-semantic-error focus-within:border-semantic-error focus-within:ring-semantic-error/20'
              : 'border-surface-200 hover:border-surface-300 focus-within:border-electric-600 focus-within:ring-electric-600/20'
          }`}
        >
          <span className="flex shrink-0 select-none items-center gap-1.5 border-r border-surface-200 bg-surface-50 px-3 text-base font-semibold text-navy-700 sm:text-sm">
            <span
              aria-hidden
              className="inline-block h-3 w-4 overflow-hidden rounded-[2px] bg-[linear-gradient(#FF9933_33%,#FFFFFF_33%_66%,#138808_66%)] ring-1 ring-inset ring-black/5"
            />
            +91
          </span>
          <input
            ref={ref}
            id={inputId}
            type="tel"
            inputMode="numeric"
            autoComplete={autoComplete}
            maxLength={17}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            value={draft ?? digits}
            onChange={(e) => update(e.target.value)}
            onPaste={(e) => {
              // A pasted number replaces the field rather than being appended to it.
              const pasted = e.clipboardData.getData('text');
              if (!/\d/.test(pasted)) return;
              e.preventDefault();
              setDraft(null);
              onChange(mobileDigits(pasted));
            }}
            onFocus={(e) => {
              setCheckNow(false);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setDraft(null);
              setCheckNow(true);
              onBlur?.(e);
            }}
            aria-invalid={shownError ? true : undefined}
            aria-describedby={message ? messageId : undefined}
            className={`min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-base tracking-wide text-navy-900 placeholder:tracking-normal placeholder:text-surface-400 disabled:cursor-not-allowed disabled:text-surface-400 sm:text-sm ${className}`}
            // The wrapper draws the focus ring around prefix and number together; the global
            // :focus-visible outline would otherwise outline the bare input inside it.
            style={{ ...style, outline: 'none' }}
            {...props}
          />
        </div>
        {shownError ? (
          <p id={messageId} className="mt-1.5 text-xs font-medium text-semantic-error">
            {shownError}
          </p>
        ) : (
          helperText && (
            <p id={messageId} className="mt-1 text-xs text-navy-500">
              {helperText}
            </p>
          )
        )}
      </div>
    );
  }
);

PhoneInput.displayName = 'PhoneInput';
