import React, { ReactNode } from 'react';

export interface ActionBarProps {
  children: ReactNode;
  /** Optional summary on the left (e.g. total amount). */
  summary?: ReactNode;
  className?: string;
}

/**
 * Primary actions for a screen (Accept quote, Submit, Pay). On phones it is pinned to the bottom
 * of the viewport above the tab bar, within thumb reach; from `md` up it renders inline at the end
 * of the content. Add `<ActionBarSpacer />` at the end of the page so content is not hidden under it.
 */
export const ActionBar: React.FC<ActionBarProps> = ({ children, summary, className = '' }) => (
  <div
    className={`fixed inset-x-0 bottom-above-nav z-30 border-t border-surface-200 bg-white/95 px-4 py-3 shadow-bar backdrop-blur md:static md:z-auto md:mt-6 md:rounded-2xl md:border md:bg-white md:px-5 md:py-4 md:shadow-card md:backdrop-blur-none ${className}`}
  >
    <div className="mx-auto flex max-w-3xl items-center gap-3 md:max-w-none">
      {summary && <div className="min-w-0 flex-1">{summary}</div>}
      <div className={`flex gap-2 ${summary ? 'shrink-0' : 'flex-1 md:justify-end'} [&>*]:flex-1 md:[&>*]:flex-none`}>
        {children}
      </div>
    </div>
  </div>
);

/** Reserves space at the end of a page for the fixed ActionBar on phones. */
export const ActionBarSpacer: React.FC = () => <div className="h-20 md:hidden" aria-hidden="true" />;
