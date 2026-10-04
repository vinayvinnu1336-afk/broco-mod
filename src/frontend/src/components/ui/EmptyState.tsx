import React, { ReactNode } from 'react';
import { PackageOpen } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ElementType | ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  const renderIcon = () => {
    if (!icon) return <PackageOpen className="w-7 h-7" />;
    if (React.isValidElement(icon)) return icon;
    const IconComp = icon as React.ElementType;
    return <IconComp className="w-7 h-7" />;
  };

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white rounded-2xl border border-dashed border-surface-300 ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-surface-100 border border-surface-200 text-navy-400 flex items-center justify-center mb-4 shadow-subtle">
        {renderIcon()}
      </div>
      <h3 className="text-base font-bold text-navy-900 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-navy-500 max-w-sm mb-5 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};
