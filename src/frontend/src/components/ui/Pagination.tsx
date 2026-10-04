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

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  className = '',
}) => {
  if (totalPages <= 1 && !totalItems) return null;

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border border-surface-200 rounded-xl text-sm ${className}`}
    >
      <div className="text-xs text-navy-500">
        {totalItems !== undefined && pageSize !== undefined ? (
          <span>
            Showing <strong className="font-semibold text-navy-800">{(currentPage - 1) * pageSize + 1}</strong> to{' '}
            <strong className="font-semibold text-navy-800">
              {Math.min(currentPage * pageSize, totalItems)}
            </strong>{' '}
            of <strong className="font-semibold text-navy-800">{totalItems}</strong> entries
          </span>
        ) : (
          <span>
            Page <strong className="font-semibold text-navy-800">{currentPage}</strong> of{' '}
            <strong className="font-semibold text-navy-800">{totalPages}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="p-1.5 rounded-lg border border-surface-200 hover:bg-surface-50 text-navy-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
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
              onClick={() => onPageChange(pageNum)}
              className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${
                isActive
                  ? 'bg-electric-600 text-white shadow-sm'
                  : 'text-navy-700 hover:bg-surface-100'
              }`}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded-lg border border-surface-200 hover:bg-surface-50 text-navy-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
