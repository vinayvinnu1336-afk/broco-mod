'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, HandCoins } from 'lucide-react';
import { formatINRShort } from '@/lib/format';
import { Skeleton } from '@/components/ui/Skeleton';
import { adminCatalogueApi, type CommissionOverview } from './catalogueAdminApi';

/** Compact link card with the garage commission overview (outstanding / overdue / collected). */
export function CommissionSummaryCard() {
  const [overview, setOverview] = useState<CommissionOverview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminCatalogueApi.commissionOverview().then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setOverview(res.data);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link
      href="/admin/commissions"
      className="block rounded-2xl border border-surface-200 bg-white p-4 shadow-card transition hover:border-surface-300 hover:shadow-elevated active:scale-[0.995] sm:p-5"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <HandCoins className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-navy-900">Garage commissions</h2>
          <p className="truncate text-xs text-navy-500">Commission + GST garages owe BroCo after each job</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-surface-400" aria-hidden="true" />
      </div>

      {failed ? (
        <p className="mt-3 text-sm text-navy-500">Summary unavailable. Open Commissions to see dues.</p>
      ) : !overview ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : (
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center sm:text-left">
          <Figure label="Outstanding" value={formatINRShort(overview.outstandingAmount)} hint={`${overview.outstandingCount} due`} />
          <Figure
            label="Overdue"
            value={formatINRShort(overview.overdueAmount)}
            hint={`${overview.overdueCount} overdue`}
            tone={overview.overdueCount > 0 ? 'text-red-600' : undefined}
          />
          <Figure label="Collected" value={formatINRShort(overview.collectedAmount)} tone="text-emerald-700" />
        </dl>
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
