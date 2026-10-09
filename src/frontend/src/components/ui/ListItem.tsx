import React, { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface ListGroupProps {
  children: ReactNode;
  className?: string;
  /** Optional heading above the group. */
  title?: ReactNode;
  action?: ReactNode;
}

/** A rounded card holding a stack of ListItems separated by hairlines (iOS/Android settings style). */
export const ListGroup: React.FC<ListGroupProps> = ({ children, className = '', title, action }) => (
  <section className={className}>
    {(title || action) && (
      <div className="mb-2 flex items-center justify-between px-1">
        {title && <h2 className="text-sm font-semibold text-navy-700">{title}</h2>}
        {action}
      </div>
    )}
    <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-card divide-y divide-surface-200/80">
      {children}
    </div>
  </section>
);

export interface ListItemProps {
  /** Main line, e.g. a vehicle or request number. */
  title: ReactNode;
  /** Second line, muted. */
  subtitle?: ReactNode;
  /** Third line / extra meta (dates, counts). */
  meta?: ReactNode;
  /** Leading visual: icon tile, avatar, image. */
  leading?: ReactNode;
  /** Right side: amount, status badge, etc. */
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  /** Hide the chevron even when the item is tappable. */
  hideChevron?: boolean;
  /** Let title and subtitle wrap onto several lines instead of truncating. */
  wrap?: boolean;
  className?: string;
}

/**
 * One tappable row. Use on phones instead of table rows; whole row is the tap target (min 56px high).
 */
export const ListItem: React.FC<ListItemProps> = ({
  title,
  subtitle,
  meta,
  leading,
  trailing,
  href,
  onClick,
  hideChevron = false,
  wrap = false,
  className = '',
}) => {
  const clamp = wrap ? 'break-words' : 'truncate';
  const interactive = Boolean(href || onClick);
  const content = (
    <>
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className={`${wrap ? clamp : 'line-clamp-2 break-words'} text-[15px] font-semibold leading-snug text-navy-900`}>{title}</div>
        {subtitle && <div className={`mt-0.5 ${clamp} text-sm text-navy-500`}>{subtitle}</div>}
        {meta && <div className="mt-1 text-xs text-navy-400">{meta}</div>}
      </div>
      {trailing && <div className="shrink-0 text-right">{trailing}</div>}
      {interactive && !hideChevron && <ChevronRight className="h-4 w-4 shrink-0 text-surface-400" aria-hidden="true" />}
    </>
  );

  const base = `flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left ${
    interactive ? 'transition-colors hover:bg-surface-50 active:bg-surface-100' : ''
  } ${className}`;

  if (href) {
    return (
      <Link href={href} className={base}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={base}>
        {content}
      </button>
    );
  }
  return <div className={base}>{content}</div>;
};

/** Square tinted icon used as ListItem `leading`. */
export const IconTile: React.FC<{
  icon: React.ElementType;
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'navy' | 'neutral';
  className?: string;
}> = ({ icon: Icon, tone = 'blue', className = '' }) => {
  const tones: Record<string, string> = {
    blue: 'bg-electric-50 text-electric-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    navy: 'bg-navy-900 text-white',
    neutral: 'bg-surface-100 text-navy-500',
  };
  return (
    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]} ${className}`}>
      <Icon className="h-5 w-5" />
    </div>
  );
};
