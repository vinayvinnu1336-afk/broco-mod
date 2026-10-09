'use client';

import React, { useEffect, ReactNode } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  /** Sticky footer (action buttons). On phones it stays pinned above the home indicator. */
  footer?: ReactNode;
}

/**
 * Dialog that renders as a bottom sheet on phones and a centred card from the `sm` breakpoint up.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true,
  footer,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses: Record<string, string> = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
    full: 'sm:max-w-6xl',
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-navy-950/50 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`relative z-10 flex w-full ${sizeClasses[size]} max-h-[92dvh] sm:max-h-[85vh] flex-col bg-white rounded-t-3xl sm:rounded-2xl border border-surface-200 shadow-modal overflow-hidden animate-sheet-up sm:animate-pop-in`}
      >
        {/* Drag handle (visual affordance on phones) */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1" aria-hidden="true">
          <span className="h-1.5 w-10 rounded-full bg-surface-300" />
        </div>

        {(title || showCloseButton) && (
          <div className="flex items-start justify-between gap-3 px-5 pt-2 pb-3 sm:pt-5 sm:pb-4 border-b border-surface-200">
            <div className="min-w-0">
              {title && (
                <h3 className="text-lg font-bold text-navy-900 leading-tight">
                  {title}
                </h3>
              )}
              {description && (
                <p className="mt-1 text-sm text-navy-500 leading-relaxed">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="-mr-1.5 -mt-0.5 p-2 rounded-full text-navy-400 hover:text-navy-700 hover:bg-surface-100 transition shrink-0"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        <div className={`flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 ${footer ? '' : 'pb-safe'}`}>
          <div className={footer ? '' : 'pb-4 sm:pb-0'}>{children}</div>
        </div>

        {footer && (
          <div className="border-t border-surface-200 bg-white px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
