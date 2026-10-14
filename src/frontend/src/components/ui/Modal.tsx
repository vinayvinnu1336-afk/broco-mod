'use client';

import React, { useEffect, useId, useRef, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
  /** Pinned under the title and above the scrolling content, e.g. a back link and a search box. */
  subheader?: ReactNode;
  /**
   * Keeps one height whatever the content (a near full-height sheet on phones, a fixed-height card
   * from `sm` up), so multi-step dialogs don't jump between steps. The content scrolls inside.
   */
  fixedHeight?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open dialogs, newest last: only the top one reacts to Escape and Tab, and the page stays
// scroll-locked until the last one closes (e.g. the car picker opened from a vehicle form).
const openStack: symbol[] = [];

/**
 * Dialog that renders as a bottom sheet on phones and a centred card from the `sm` breakpoint up.
 * It is portalled to <body> so the backdrop covers everything, including sticky headers, wherever
 * the dialog is used.
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
  subheader,
  fixedHeight = false,
}) => {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const visible = isOpen && mounted;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!visible) return;
    const id = Symbol('modal');
    const isTop = () => openStack[openStack.length - 1] === id;
    const returnFocus = document.activeElement as HTMLElement | null;
    openStack.push(id);
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTop() || e.defaultPrevented) return;
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      // Keep keyboard focus inside the dialog.
      const root = panelRef.current;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
      if (items.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!root.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (active === first || active === root)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      const i = openStack.indexOf(id);
      if (i >= 0) openStack.splice(i, 1);
      if (openStack.length === 0) document.body.style.overflow = '';
      // Hand focus back to what opened the dialog, unless the page has already moved it somewhere.
      const active = document.activeElement;
      if (returnFocus?.isConnected && (!active || active === document.body)) returnFocus.focus({ preventScroll: true });
    };
  }, [visible]);

  if (!visible) return null;

  const sizeClasses: Record<string, string> = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
    full: 'sm:max-w-6xl',
  };
  const heightClasses = fixedHeight ? 'h-[92dvh] sm:h-[min(640px,calc(100dvh-3rem))]' : 'max-h-[92dvh] sm:max-h-[85vh]';
  const hasHeader = !!title || showCloseButton;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      <div
        className="fixed inset-0 bg-navy-950/50 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        data-modal-panel
        className={`relative z-10 flex w-full ${sizeClasses[size]} ${heightClasses} flex-col bg-white rounded-t-3xl sm:rounded-2xl border border-surface-200 shadow-modal overflow-hidden outline-none animate-sheet-up sm:animate-pop-in`}
      >
        {/* Drag handle (visual affordance on phones) */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1" aria-hidden="true">
          <span className="h-1.5 w-10 rounded-full bg-surface-300" />
        </div>

        {hasHeader && (
          <div className={`flex items-start justify-between gap-3 px-5 pt-2 pb-3 sm:px-6 sm:pt-5 sm:pb-4 ${subheader ? '' : 'border-b border-surface-200'}`}>
            <div className="min-w-0">
              {title && (
                <h3 id={titleId} className="text-lg font-bold text-navy-900 leading-tight">
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

        {subheader && (
          <div className={`shrink-0 border-b border-surface-200 px-5 pb-3 sm:px-6 sm:pb-4 ${hasHeader ? '' : 'pt-3 sm:pt-5'}`}>{subheader}</div>
        )}

        <div
          data-modal-body
          className={`flex-1 overflow-y-auto overscroll-contain px-5 pt-5 sm:px-6 ${footer ? 'pb-5' : 'pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-6'}`}
        >
          {children}
        </div>

        {footer && (
          <div className="border-t border-surface-200 bg-white px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
