import React, { ReactNode } from 'react';
import { CheckCircle2, Circle, Clock } from 'lucide-react';

export type TimelineStatus = 'completed' | 'current' | 'upcoming' | 'error';

export interface TimelineItem {
  id: string;
  title: string;
  description?: ReactNode;
  timestamp?: string;
  status: TimelineStatus;
  icon?: ReactNode;
}

export interface TimelineProps {
  items: TimelineItem[];
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({
  items,
  orientation = 'vertical',
  className = '',
}) => {
  if (orientation === 'horizontal') {
    return (
      <div className={`w-full overflow-x-auto py-4 ${className}`}>
        <div className="flex items-center min-w-max justify-between gap-4">
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1;
            const isCompleted = item.status === 'completed';
            const isCurrent = item.status === 'current';

            return (
              <div key={item.id} className="flex items-center gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition border-2 ${
                      isCompleted
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                        : isCurrent
                        ? 'bg-electric-600 border-electric-600 text-white shadow-md shadow-electric-600/30 animate-pulse'
                        : 'bg-white border-surface-300 text-navy-400'
                    }`}
                  >
                    {item.icon ? (
                      item.icon
                    ) : isCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <div className="mt-2 text-center max-w-[110px]">
                    <div
                      className={`text-xs font-bold leading-tight ${
                        isCurrent
                          ? 'text-electric-700'
                          : isCompleted
                          ? 'text-navy-900'
                          : 'text-navy-400'
                      }`}
                    >
                      {item.title}
                    </div>
                    {item.timestamp && (
                      <div className="text-[10px] text-navy-500 mt-0.5">{item.timestamp}</div>
                    )}
                  </div>
                </div>

                {!isLast && (
                  <div
                    className={`w-12 sm:w-16 h-0.5 rounded-full mb-6 ${
                      isCompleted ? 'bg-emerald-500' : 'bg-surface-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Vertical orientation
  return (
    <div className={`relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-200 ${className}`}>
      {items.map((item) => {
        const isCompleted = item.status === 'completed';
        const isCurrent = item.status === 'current';
        const isError = item.status === 'error';

        return (
          <div key={item.id} className="relative group">
            {/* Bullet */}
            <div
              className={`absolute -left-6 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 bg-white ${
                isCompleted
                  ? 'border-emerald-500 text-emerald-600'
                  : isCurrent
                  ? 'border-electric-600 text-electric-600 ring-4 ring-electric-50'
                  : isError
                  ? 'border-red-500 text-red-600'
                  : 'border-surface-300 text-surface-400'
              }`}
            >
              {isCompleted ? (
                <CheckCircle2 className="w-4 h-4 fill-emerald-100" />
              ) : isCurrent ? (
                <Clock className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Circle className="w-2.5 h-2.5 fill-current" />
              )}
            </div>

            {/* Content */}
            <div className="bg-white p-3.5 rounded-xl border border-surface-200 shadow-subtle hover:border-surface-300 transition">
              <div className="flex items-center justify-between gap-2">
                <h4
                  className={`text-sm font-bold ${
                    isCurrent ? 'text-electric-700' : 'text-navy-900'
                  }`}
                >
                  {item.title}
                </h4>
                {item.timestamp && (
                  <span className="text-[11px] font-mono text-navy-400 shrink-0">
                    {item.timestamp}
                  </span>
                )}
              </div>
              {item.description && (
                <div className="text-xs text-navy-600 mt-1 leading-relaxed">
                  {item.description}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
