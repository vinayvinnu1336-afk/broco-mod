import React, { ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  error?: string | Error | null;
  onRetry?: () => void;
  action?: ReactNode;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  error,
  onRetry,
  action,
  className = '',
}) => {
  // Format human-friendly message, concealing raw tech details from customers
  const rawMessage = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  let friendlyMessage = 'We could not complete your request right now. Please try again.';

  if (rawMessage) {
    if (rawMessage.toLowerCase().includes('failed to fetch') || rawMessage.toLowerCase().includes('network')) {
      friendlyMessage = 'Unable to reach the service network. Please check your internet connection or try again in a moment.';
    } else if (rawMessage.toLowerCase().includes('unauthorized') || rawMessage.toLowerCase().includes('forbidden')) {
      friendlyMessage = 'You do not have permission to view this section or your session has expired.';
    } else if (rawMessage.toLowerCase().includes('not found') || rawMessage.includes('404')) {
      friendlyMessage = 'The requested service record or vehicle could not be found.';
    } else if (!rawMessage.includes('Exception') && !rawMessage.includes('at ') && rawMessage.length < 120) {
      friendlyMessage = rawMessage;
    }
  }

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white rounded-2xl border border-red-200/80 shadow-card ${className}`}
      role="alert"
    >
      <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 text-semantic-error flex items-center justify-center mb-4 shadow-subtle">
        <AlertCircle className="w-7 h-7" />
      </div>
      <h3 className="text-base font-bold text-navy-900 mb-1">{title}</h3>
      <p className="text-xs text-navy-600 max-w-md mb-6 leading-relaxed">
        {friendlyMessage}
      </p>

      <div className="flex items-center gap-3">
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Try Again
          </Button>
        )}
        {action}
      </div>
    </div>
  );
};
