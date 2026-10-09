import React, { ReactNode } from 'react';
import Link from 'next/link';

type Variant = 'primary' | 'outline' | 'ghost';

const variants: Record<Variant, string> = {
  primary: 'bg-electric-600 text-white hover:bg-electric-700 shadow-sm shadow-electric-600/20 focus-visible:ring-electric-600',
  outline: 'border border-surface-300 bg-white text-navy-800 hover:bg-surface-50 hover:border-surface-400 focus-visible:ring-electric-600',
  ghost: 'bg-transparent text-navy-700 hover:bg-surface-100 hover:text-navy-900 focus-visible:ring-surface-400',
};

/**
 * A Next.js Link styled like `Button` (md size). Avoids nesting a <button> inside an <a>.
 * Garage-portal local helper; see report for promoting it to `@/components/ui`.
 */
export function LinkButton({
  href,
  children,
  variant = 'primary',
  leftIcon,
  className = '',
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  leftIcon?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 touch-manipulation select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.99] ${variants[variant]} ${className}`}
    >
      {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
      <span>{children}</span>
    </Link>
  );
}
