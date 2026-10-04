import React, { HTMLAttributes, forwardRef, ReactNode } from 'react';

export type BadgeVariant = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'navy';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  pill?: boolean;
  dot?: boolean;
  icon?: React.ElementType | ReactNode;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className = '',
      variant = 'neutral',
      pill = true,
      dot = false,
      icon,
      children,
      ...props
    },
    ref
  ) => {
    const variantStyles: Record<BadgeVariant, string> = {
      neutral: 'bg-surface-100 text-navy-700 border-surface-200',
      blue: 'bg-electric-50 text-electric-700 border-electric-200',
      green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      amber: 'bg-amber-50 text-amber-700 border-amber-200',
      red: 'bg-red-50 text-red-700 border-red-200',
      navy: 'bg-navy-900 text-white border-navy-800',
    };

    const dotColors: Record<BadgeVariant, string> = {
      neutral: 'bg-navy-400',
      blue: 'bg-electric-600',
      green: 'bg-emerald-500',
      amber: 'bg-amber-500',
      red: 'bg-red-500',
      navy: 'bg-electric-400',
    };

    const renderIcon = () => {
      if (!icon) return null;
      if (React.isValidElement(icon)) return <span className="shrink-0">{icon}</span>;
      const IconComp = icon as React.ElementType;
      return <IconComp className="w-3.5 h-3.5 shrink-0" />;
    };

    return (
      <span
        ref={ref}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold border ${
          pill ? 'rounded-full' : 'rounded-lg'
        } ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {dot && (
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]}`} />
        )}
        {renderIcon()}
        <span>{children}</span>
      </span>
    );
  }
);
Badge.displayName = 'Badge';
