import React from 'react';

export interface FilterChipOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterChipsProps {
  options: FilterChipOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * Horizontally scrolling filter chips (status filters on list screens). Bleeds to the screen edge on
 * phones so long lists of filters can be swiped.
 */
export const FilterChips: React.FC<FilterChipsProps> = ({ options, value, onChange, className = '', ariaLabel = 'Filter' }) => (
  <div
    role="tablist"
    aria-label={ariaLabel}
    className={`-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0 ${className}`}
  >
    {options.map((option) => {
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(option.value)}
          className={`inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition touch-manipulation ${
            active
              ? 'border-navy-900 bg-navy-900 text-white'
              : 'border-surface-200 bg-white text-navy-600 hover:border-surface-300 hover:text-navy-900'
          }`}
        >
          {option.label}
          {option.count !== undefined && (
            <span className={`rounded-full px-1.5 text-xs font-semibold ${active ? 'bg-white/20 text-white' : 'bg-surface-100 text-navy-500'}`}>
              {option.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);
