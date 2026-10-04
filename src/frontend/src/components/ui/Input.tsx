import React, { forwardRef, InputHTMLAttributes, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className = '',
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      id,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-navy-800 uppercase tracking-wider mb-1.5"
          >
            {label}
            {required && <span className="text-semantic-error ml-1">*</span>}
          </label>
        )}
        <div className="relative rounded-xl">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-navy-400">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            disabled={disabled}
            required={required}
            className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-navy-900 placeholder:text-surface-400 transition focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-surface-100 disabled:text-surface-400 disabled:cursor-not-allowed ${
              leftIcon ? 'pl-10' : ''
            } ${rightIcon ? 'pr-10' : ''} ${
              error
                ? 'border-semantic-error focus:border-semantic-error focus:ring-semantic-error/20'
                : 'border-surface-200 hover:border-surface-300 focus:border-electric-600 focus:ring-electric-600/20'
            } ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-navy-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-semantic-error font-medium flex items-center gap-1">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p className="mt-1 text-xs text-navy-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
