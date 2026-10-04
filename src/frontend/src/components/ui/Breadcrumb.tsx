import React, { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: ReactNode;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  showHome = true,
  className = '',
}) => {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center text-xs text-navy-500 ${className}`}>
      <ol className="flex items-center space-x-1.5 overflow-x-auto py-1">
        {showHome && (
          <li className="flex items-center">
            <Link
              href="/"
              className="text-navy-400 hover:text-navy-700 transition flex items-center gap-1"
            >
              <Home className="w-3.5 h-3.5" />
            </Link>
            <ChevronRight className="w-3.5 h-3.5 mx-1.5 text-surface-400 shrink-0" />
          </li>
        )}
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.label} className="flex items-center">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-navy-800 transition flex items-center gap-1 font-medium"
                >
                  {item.icon && <span className="w-3.5 h-3.5">{item.icon}</span>}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span
                  className="font-bold text-navy-900 flex items-center gap-1"
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.icon && <span className="w-3.5 h-3.5">{item.icon}</span>}
                  <span>{item.label}</span>
                </span>
              )}
              {!isLast && (
                <ChevronRight className="w-3.5 h-3.5 mx-1.5 text-surface-400 shrink-0" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
