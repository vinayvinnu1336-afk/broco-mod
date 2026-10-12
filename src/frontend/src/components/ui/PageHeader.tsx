import React, { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Shows a back arrow linking here (detail pages). */
  backHref?: string;
  backLabel?: string;
  /** Buttons on the right. On phones they wrap below the title. */
  actions?: ReactNode;
  /** Small element above the title, e.g. a reference number or status. */
  eyebrow?: ReactNode;
  className?: string;
}

/**
 * Standard page title block. Every portal page starts with one so titles, back navigation and
 * primary actions sit in the same place on every screen.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  backHref,
  backLabel = 'Back',
  actions,
  eyebrow,
  className = '',
}) => {
  return (
    <header className={`mb-5 sm:mb-6 ${className}`}>
      {backHref && (
        <Link
          href={backHref}
          className="-ml-1.5 mb-2 inline-flex min-h-[36px] items-center gap-1 rounded-lg px-1.5 text-sm font-medium text-navy-500 hover:text-navy-900 transition"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <div className="mb-1.5 flex flex-wrap items-center gap-2">{eyebrow}</div>}
          <h1 className="text-[22px] leading-7 sm:text-2xl font-bold tracking-tight text-navy-900 break-words">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm leading-relaxed text-navy-500 max-w-2xl">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 [&>*]:flex-1 sm:[&>*]:flex-none">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
};
