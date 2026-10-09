'use client';

import React, { ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle, Info } from 'lucide-react';

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
      <div className="w-11 h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-5 h-5" />
      </div>
    ),
    warning: (
      <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-5 h-5" />
      </div>
    ),
    primary: (
      <div className="w-11 h-11 rounded-2xl bg-electric-100 text-electric-600 flex items-center justify-center shrink-0">
        <Info className="w-5 h-5" />
      </div>
    ),
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      showCloseButton={false}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="w-full sm:w-auto">
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
            className="w-full sm:w-auto"
          >
            {confirmText}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-4">
        {icons[variant]}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-navy-900 leading-snug">{title}</h3>
          <div className="mt-1.5 text-sm text-navy-600 leading-relaxed">{message}</div>
        </div>
      </div>
    </Modal>
  );
};
