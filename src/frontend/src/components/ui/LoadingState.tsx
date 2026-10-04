import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  message?: string;
  className?: string;
  inline?: boolean;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading data...',
  className = '',
  inline = false,
}) => {
  if (inline) {
    return (
      <div className={`flex items-center gap-2 text-xs text-navy-500 font-medium ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-electric-600" />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-surface-200 shadow-card ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-electric-50 text-electric-600 flex items-center justify-center mb-3">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
      <p className="text-sm font-semibold text-navy-800">{message}</p>
      <p className="text-xs text-navy-400 mt-1">Please wait while we fetch the latest records.</p>
    </div>
  );
};
