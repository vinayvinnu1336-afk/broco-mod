import React, { ReactNode } from 'react';
import Link from 'next/link';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: React.ElementType;
  hint?: ReactNode;
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'neutral';
  href?: string;
  className?: string;
}

const toneClasses: Record<NonNullable<StatCardProps['tone']>, string> = {
  blue: 'bg-electric-50 text-electric-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  neutral: 'bg-surface-100 text-navy-500',
};

/**
 * KPI tile. Lay out in `grid grid-cols-2 lg:grid-cols-4 gap-3` so phones get a tidy 2x2.
 */
export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon: Icon,
  hint,
  tone = 'blue',
  href,
  className = '',
}) => {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-navy-500 leading-tight">{label}</span>
        {Icon && (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneClasses[tone]}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-navy-900 tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-navy-400 truncate">{hint}</div>}
    </>
  );

  const base = `block rounded-2xl border border-surface-200 bg-white p-4 shadow-card ${className}`;
  if (href) {
    return (
      <Link href={href} className={`${base} transition hover:border-surface-300 hover:shadow-elevated active:scale-[0.99]`}>
        {body}
      </Link>
    );
  }
  return <div className={base}>{body}</div>;
};
