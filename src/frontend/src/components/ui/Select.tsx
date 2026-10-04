import React, { forwardRef, SelectHTMLAttributes, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className = '',
      label,
      error,
      helperText,
      options,
      placeholder,
      id,
      children,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-semibold text-navy-800 uppercase tracking-wider mb-1.5"
          >
            {label}
            {required && <span className="text-semantic-error ml-1">*</span>}
          </label>
        )}
        <div className="relative rounded-xl">
          <select
            id={selectId}
            ref={ref}
            disabled={disabled}
            required={required}
            className={`w-full appearance-none rounded-xl border bg-white px-3.5 py-2.5 pr-10 text-sm text-navy-900 transition focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-surface-100 disabled:text-surface-400 disabled:cursor-not-allowed ${
              error
                ? 'border-semantic-error focus:border-semantic-error focus:ring-semantic-error/20'
                : 'border-surface-200 hover:border-surface-300 focus:border-electric-600 focus:ring-electric-600/20'
            } ${className}`}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-navy-400">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-semantic-error font-medium">{error}</p>
        )}
        {!error && helperText && (
          <p className="mt-1 text-xs text-navy-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
