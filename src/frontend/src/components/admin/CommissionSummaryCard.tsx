'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronRight, HandCoins } from 'lucide-react';
import { formatINRShort } from '@/lib/format';
import { Skeleton } from '@/components/ui/Skeleton';
import { duesPageHref, type DuesPortal } from '@/components/commissions/garageDuesApi';
import { useGarageDuesOverview } from '@/components/commissions/useGarageDuesOverview';

/**
 * Link card with the garage commission totals (outstanding / overdue / collected or garages overdue),
 * highlighted when garages are late. Used on the admin finance page and both staff dashboards.
 */
export function CommissionSummaryCard({
  portal = 'admin',
  title = 'Garage commissions',
  city,
}: {
  portal?: DuesPortal;
  title?: string;
  /** Admins: one city's garages only. */
  city?: string;
}) {
  const { overview, failed } = useGarageDuesOverview(portal, city || undefined);
  const late = (overview?.overdueCount ?? 0) > 0;
  const href = late ? `${duesPageHref(portal)}?status=Overdue` : duesPageHref(portal);

  return (
    <Link
      href={href}
      className={`block rounded-2xl border bg-white p-4 shadow-card transition hover:shadow-elevated active:scale-[0.995] sm:p-5 ${
        late ? 'border-red-200 hover:border-red-300' : 'border-surface-200 hover:border-surface-300'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${late ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}
        >
          <HandCoins className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-navy-900">{title}</h2>
          <p className="truncate text-xs text-navy-500">Commission garages owe BroCo after each job</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-surface-400" aria-hidden="true" />
      </div>

      {failed && !overview ? (
        <p className="mt-3 text-sm text-navy-500">Summary unavailable. Open the dues list to see what garages owe.</p>
      ) : !overview ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center sm:text-left">
            <Figure label="Outstanding" value={formatINRShort(overview.outstandingAmount)} hint={`${overview.outstandingCount} due`} />
            <Figure
              label="Overdue"
              value={formatINRShort(overview.overdueAmount)}
              hint={`${overview.overdueCount} overdue`}
              tone={late ? 'text-red-600' : undefined}
            />
            {portal === 'admin' && overview.collectedAmount !== undefined ? (
              <Figure label="Collected" value={formatINRShort(overview.collectedAmount)} tone="text-emerald-700" />
            ) : (
              <Figure
                label="Garages late"
                value={String(overview.garagesWithOverdue)}
                hint={`of ${overview.garagesWithDues} owing`}
                tone={overview.garagesWithOverdue > 0 ? 'text-red-600' : undefined}
              />
            )}
          </dl>
          {late && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {overview.garagesWithOverdue} garage{overview.garagesWithOverdue === 1 ? ' is' : 's are'} late
                {overview.garagesBlocked > 0 ? `, ${overview.garagesBlocked} paused for new jobs` : ''}. Tap to remind them.
              </span>
            </p>
          )}
        </>
      )}
    </Link>
  );
}

function Figure({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-50 px-2 py-2.5 sm:px-3">
      <dt className="truncate text-xs text-navy-500">{label}</dt>
      <dd className={`truncate text-lg font-bold tabular-nums ${tone ?? 'text-navy-900'}`}>{value}</dd>
      {hint && <dd className="truncate text-[11px] text-navy-400">{hint}</dd>}
    </div>
  );
}
