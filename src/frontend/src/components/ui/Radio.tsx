import React, { forwardRef, InputHTMLAttributes, ReactNode } from 'react';

export interface RadioOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name: string;
  options: RadioOption[];
  selectedValue?: string;
  onChange?: (value: string) => void;
  label?: string;
  error?: string;
  direction?: 'horizontal' | 'vertical';
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  options,
  selectedValue,
  onChange,
  label,
  error,
  direction = 'vertical',
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-semibold text-navy-800 uppercase tracking-wider mb-2">
          {label}
        </label>
      )}
      <div
        className={
          direction === 'horizontal'
            ? 'flex flex-wrap items-center gap-4'
            : 'space-y-2'
        }
      >
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
              selectedValue === opt.value
                ? 'border-electric-600 bg-electric-50/50 text-navy-900 shadow-sm'
                : 'border-surface-200 bg-white hover:border-surface-300 text-navy-800'
            } ${opt.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={selectedValue === opt.value}
              onChange={() => onChange?.(opt.value)}
              disabled={opt.disabled}
              className="mt-0.5 w-4 h-4 text-electric-600 border-surface-300 focus:ring-electric-500"
            />
            <div className="text-sm">
              <div className="font-semibold text-navy-900">{opt.label}</div>
              {opt.description && (
                <div className="text-xs text-navy-500 mt-0.5">{opt.description}</div>
              )}
            </div>
          </label>
        ))}
      </div>
      {error && <p className="mt-1.5 text-xs text-semantic-error font-medium">{error}</p>}
    </div>
  );
};
