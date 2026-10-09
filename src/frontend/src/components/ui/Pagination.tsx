import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  className?: string;
}

/**
 * Phones: full-width Previous / Next with "page / total" between them (44px targets).
 * From `sm` up: summary on the left, numbered page buttons on the right.
 */
export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  className = '',
}) => {
  if (totalPages <= 1 && !totalItems) return null;

  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;
  const go = (page: number) => {
    onPageChange(page);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navButton =
    'inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl border border-surface-200 bg-white px-3 text-sm font-medium text-navy-700 transition hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation';

  return (
    <div className={className}>
      {/* Phones */}
      <div className="flex items-center gap-2 sm:hidden">
        <button onClick={() => go(currentPage - 1)} disabled={!canPrev} className={`${navButton} flex-1`} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        <span className="min-w-[64px] text-center text-sm tabular-nums text-navy-500">
          {currentPage} / {Math.max(totalPages, 1)}
        </span>
        <button onClick={() => go(currentPage + 1)} disabled={!canNext} className={`${navButton} flex-1`} aria-label="Next page">
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Tablet and up */}
      <div className="hidden items-center justify-between gap-3 rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm sm:flex">
        <div className="text-sm text-navy-500">
          {totalItems !== undefined && pageSize !== undefined ? (
            <span>
              Showing <span className="font-semibold text-navy-800">{totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span>–
              <span className="font-semibold text-navy-800">{Math.min(currentPage * pageSize, totalItems)}</span> of{' '}
              <span className="font-semibold text-navy-800">{totalItems}</span>
            </span>
          ) : (
            <span>
              Page <span className="font-semibold text-navy-800">{currentPage}</span> of{' '}
              <span className="font-semibold text-navy-800">{totalPages}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => go(currentPage - 1)}
            disabled={!canPrev}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-200 text-navy-600 transition hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum = i + 1;
            if (totalPages > 5) {
              if (currentPage > 3 && currentPage < totalPages - 2) {
                pageNum = currentPage - 2 + i;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              }
            }
            const isActive = pageNum === currentPage;
            return (
              <button
                key={pageNum}
                onClick={() => go(pageNum)}
                aria-current={isActive ? 'page' : undefined}
                className={`h-10 min-w-[40px] rounded-xl px-2 text-sm font-semibold tabular-nums transition ${
                  isActive ? 'bg-electric-600 text-white shadow-sm' : 'text-navy-700 hover:bg-surface-100'
                }`}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            onClick={() => go(currentPage + 1)}
            disabled={!canNext}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-200 text-navy-600 transition hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
