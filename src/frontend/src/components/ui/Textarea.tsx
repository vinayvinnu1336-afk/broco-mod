import React, { forwardRef, TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className = '',
      label,
      error,
      helperText,
      id,
      disabled,
      required,
      rows = 4,
      ...props
    },
    ref
  ) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-xs font-semibold text-navy-800 uppercase tracking-wider mb-1.5"
          >
            {label}
            {required && <span className="text-semantic-error ml-1">*</span>}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          rows={rows}
          disabled={disabled}
          required={required}
          className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-navy-900 placeholder:text-surface-400 transition focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-surface-100 disabled:text-surface-400 disabled:cursor-not-allowed ${
            error
              ? 'border-semantic-error focus:border-semantic-error focus:ring-semantic-error/20'
              : 'border-surface-200 hover:border-surface-300 focus:border-electric-600 focus:ring-electric-600/20'
          } ${className}`}
          {...props}
        />
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

Textarea.displayName = 'Textarea';
