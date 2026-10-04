import React, { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export type AlertType = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps {
  type?: AlertType;
  title?: ReactNode;
  children: ReactNode;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  children,
  onClose,
  className = '',
}) => {
  const styles: Record<AlertType, { container: string; icon: ReactNode; text: string }> = {
    info: {
      container: 'bg-electric-50 border-electric-200 text-electric-900',
      icon: <Info className="w-5 h-5 text-electric-600 shrink-0" />,
      text: 'text-electric-800',
    },
    success: {
      container: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
      text: 'text-emerald-800',
    },
    warning: {
      container: 'bg-amber-50 border-amber-200 text-amber-900',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
      text: 'text-amber-800',
    },
    error: {
      container: 'bg-red-50 border-red-200 text-red-900',
      icon: <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />,
      text: 'text-red-800',
    },
  };

  const current = styles[type];

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border ${current.container} ${className}`}
      role="alert"
    >
      {current.icon}
      <div className="flex-1 text-sm">
        {title && <div className="font-bold mb-0.5">{title}</div>}
        <div className={current.text}>{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-black/5 transition text-navy-500"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
