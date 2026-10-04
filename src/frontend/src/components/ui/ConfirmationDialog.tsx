'use client';

import React, { ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  isLoading = false,
}) => {
  const icons = {
    danger: (
      <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-5 h-5" />
      </div>
    ),
    warning: (
      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-5 h-5" />
      </div>
    ),
    primary: (
      <div className="w-10 h-10 rounded-xl bg-electric-100 text-electric-600 flex items-center justify-center shrink-0">
        <Info className="w-5 h-5" />
      </div>
    ),
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={false}>
      <div className="flex items-start gap-4">
        {icons[variant]}
        <div className="flex-1">
          <h3 className="text-base font-bold text-navy-900 leading-snug">{title}</h3>
          <div className="mt-1.5 text-xs text-navy-600 leading-relaxed">{message}</div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-surface-200">
        <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
          {cancelText}
        </Button>
        <Button
          variant={variant === 'danger' ? 'danger' : 'primary'}
          size="sm"
          onClick={onConfirm}
          isLoading={isLoading}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
};
