'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, ChevronRight, IndianRupee, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { formatINRWhole } from '@/lib/format';
import { COMMISSION_UPDATED_EVENT, GarageCommissionSummary } from './commission';

const DISMISS_KEY = 'broco_commission_banner_dismissed';
const COMMISSION_PATH = '/garage/commission';

function readDismissed(): string | null {
  try {
    return sessionStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

function writeDismissed(value: string) {
  try {
    sessionStorage.setItem(DISMISS_KEY, value);
  } catch {
    /* storage blocked: dismiss only lasts until the next render */
  }
}

/**
 * Slim reminder shown at the top of every garage screen while BroCo commission is outstanding.
 * Overdue dues can't be dismissed; a plain due can be hidden for this browser session (until the
 * outstanding amount changes).
 */
export function CommissionBanner() {
  const pathname = usePathname() ?? '';
  const [summary, setSummary] = useState<GarageCommissionSummary | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch<GarageCommissionSummary>('/garage/commission/summary');
    if (res.success && res.data) setSummary(res.data);
  }, []);

  useEffect(() => {
    setDismissedFor(readDismissed());
  }, []);

  // Refresh on navigation so the banner clears soon after paying.
  useEffect(() => {
    load();
  }, [load, pathname]);

  useEffect(() => {
    const onUpdated = () => load();
    window.addEventListener(COMMISSION_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(COMMISSION_UPDATED_EVENT, onUpdated);
  }, [load]);

  if (!summary || summary.outstandingCount <= 0) return null;
  if (pathname === COMMISSION_PATH || pathname.startsWith(`${COMMISSION_PATH}/`)) return null;

  const overdue = summary.overdueCount > 0;
  const dismissToken = `${summary.outstandingCount}:${summary.outstandingAmount}`;
  if (!overdue && dismissedFor === dismissToken) return null;

  const amount = formatINRWhole(summary.outstandingAmount);
  const tone = overdue
    ? 'border-red-200 bg-red-50 text-red-900'
    : 'border-amber-200 bg-amber-50 text-amber-900';

  return (
    <div className={`mb-4 flex items-stretch overflow-hidden rounded-xl border ${tone}`} role="status">
      <Link
        href={COMMISSION_PATH}
        className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-sm transition hover:bg-black/[0.03]"
      >
        {overdue ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
        ) : (
          <IndianRupee className="h-4 w-4 shrink-0 text-amber-600" />
        )}
        <span className="min-w-0 flex-1 leading-snug">
          <span className="font-semibold">
            {overdue
              ? `${amount} commission due to BroCo — ${formatINRWhole(summary.overdueAmount)} overdue`
              : `${amount} commission due to BroCo`}
          </span>
          {summary.newJobsBlocked && (
            <span className="block text-xs text-red-800">New jobs are paused until the overdue amount is paid.</span>
          )}
        </span>
        <span className={`inline-flex shrink-0 items-center gap-0.5 font-semibold ${overdue ? 'text-red-700' : 'text-amber-800'}`}>
          Pay now
          <ChevronRight className="h-4 w-4" />
        </span>
      </Link>
      {!overdue && (
        <button
          type="button"
          onClick={() => {
            writeDismissed(dismissToken);
            setDismissedFor(dismissToken);
          }}
          className="flex w-11 shrink-0 items-center justify-center border-l border-amber-200 text-amber-700 transition hover:bg-amber-100"
          aria-label="Hide commission reminder for now"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default CommissionBanner;
