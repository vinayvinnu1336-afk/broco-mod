import React, { ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
  variant?: 'pills' | 'underline';
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
  variant = 'pills',
}) => {
  if (variant === 'underline') {
    return (
      <div className={`border-b border-surface-200 ${className}`}>
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition ${
                  isActive
                    ? 'border-electric-600 text-electric-600 font-semibold'
                    : 'border-transparent text-navy-500 hover:text-navy-800 hover:border-surface-300'
                }`}
              >
                {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`ml-1 text-xs px-2 py-0.5 rounded-full font-semibold ${
                      isActive
                        ? 'bg-electric-100 text-electric-700'
                        : 'bg-surface-200 text-navy-600'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1.5 p-1 bg-surface-100 rounded-xl border border-surface-200 overflow-x-auto ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              isActive
                ? 'bg-white text-navy-900 shadow-sm'
                : 'text-navy-600 hover:text-navy-900 hover:bg-surface-50'
            }`}
          >
            {tab.icon && <span className="w-3.5 h-3.5">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive
                    ? 'bg-electric-100 text-electric-700'
                    : 'bg-surface-200 text-navy-600'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
