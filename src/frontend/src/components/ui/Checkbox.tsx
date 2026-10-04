import React, { forwardRef, InputHTMLAttributes, ReactNode } from 'react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  description?: ReactNode;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = '', label, description, error, id, ...props }, ref) => {
    const checkboxId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="flex items-start gap-3">
        <div className="flex items-center h-5">
          <input
            id={checkboxId}
            ref={ref}
            type="checkbox"
            className={`w-4 h-4 rounded border-surface-300 text-electric-600 focus:ring-electric-500 focus:ring-offset-0 transition cursor-pointer disabled:cursor-not-allowed ${className}`}
            {...props}
          />
        </div>
        {(label || description) && (
          <div className="text-sm">
            {label && (
              <label
                htmlFor={checkboxId}
                className="font-medium text-navy-900 cursor-pointer select-none"
              >
                {label}
              </label>
            )}
            {description && <p className="text-xs text-navy-500 mt-0.5">{description}</p>}
            {error && <p className="text-xs text-semantic-error mt-0.5">{error}</p>}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
