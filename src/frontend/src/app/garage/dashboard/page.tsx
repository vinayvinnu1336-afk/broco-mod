'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { GarageQuoteSummaryDto } from '@/types/garageQuote';
import { Car, FileSpreadsheet, IndianRupee, Inbox, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatINRShort, formatINRWhole, formatRelative } from '@/lib/format';
import { LinkButton } from '../_components/LinkButton';
import { GarageCommissionSummary } from '@/components/garage/commission';

/** Shape of GET /garage/dashboard (GarageDashboardDto). */
interface GarageDashboardData {
  garageId: string;
  garageName: string;
  /** Requests in Pending / Notified / Viewed state (not yet quoted or declined). */
  newRequestsCount: number;
  /** Every quote this garage has created, any status (drafts included). */
  submittedQuotesCount: number;
  /** Jobs that are not Closed or Cancelled. */
  activeJobsCount: number;
  /** Five most recent requests sent to this garage. */
  availableRequests: Array<{
    serviceRequestId: string;
    vehicleMake: string;
    vehicleModel: string;
    vehicleYear: number;
    description: string;
    distanceKm: number;
    createdAtUtc: string;
    status: string;
  }>;
  /** Five most recent quotes. */
  submittedQuotes: GarageQuoteSummaryDto[];
}

const OPEN_REQUEST_STATUSES = ['PENDING', 'NOTIFIED', 'VIEWED'];
const OPEN_QUOTE_STATUSES = ['Draft', 'Submitted', 'UnderReview'];

function formatKm(km: number | null | undefined) {
  const value = Number(km ?? 0);
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} km`;
}

export default function GarageDashboardPage() {
  const [data, setData] = useState<GarageDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commission, setCommission] = useState<GarageCommissionSummary | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<GarageDashboardData>('/garage/dashboard');
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.message || 'Could not load your overview.');
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load your overview.');
    } finally {
      setLoading(false);
    }
  }

  async function loadCommission() {
    // BroCo commission owed on handed-over jobs (10% of service value).
    const res = await apiFetch<GarageCommissionSummary>('/garage/commission/summary');
    if (res.success && res.data) setCommission(res.data);
  }

  useEffect(() => {
    loadDashboard();
    loadCommission();
  }, []);

  const openRequests = (data?.availableRequests ?? []).filter((r) =>
    OPEN_REQUEST_STATUSES.includes(String(r.status).toUpperCase())
  );
  const openQuotes = (data?.submittedQuotes ?? []).filter((q) => OPEN_QUOTE_STATUSES.includes(q.status));

  return (
    <div>
      <PageHeader title={data?.garageName || 'Overview'} description="Today’s work at a glance." />

      {loading ? (
        <div className="space-y-5 sm:space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[104px] w-full rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : error || !data ? (
        <ErrorState title="Couldn’t load your overview" error={error} onRetry={loadDashboard} />
      ) : (
        <div className="space-y-5 sm:space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="New requests"
              value={data.newRequestsCount}
              hint="Waiting for a quote"
              icon={Inbox}
              tone="blue"
              href="/garage/requests"
            />
            <StatCard
              label="Open jobs"
              value={data.activeJobsCount}
              hint="Not closed or cancelled"
              icon={Wrench}
              tone="amber"
              href="/garage/jobs"
            />
            <StatCard
              label="Quotes"
              value={data.submittedQuotesCount}
              hint="All quotes, incl. drafts"
              icon={FileSpreadsheet}
              tone="neutral"
              href="/garage/quotes"
            />
            <StatCard
              label="Commission due"
              value={commission ? formatINRShort(commission.outstandingAmount) : '—'}
              hint={
                !commission
                  ? 'BroCo commission'
                  : commission.overdueCount > 0
                  ? `${formatINRWhole(commission.overdueAmount)} overdue · pay now`
                  : commission.outstandingCount > 0
                  ? `${commission.outstandingCount} job${commission.outstandingCount === 1 ? '' : 's'} · pay within 24 h`
                  : 'All paid up'
              }
              icon={IndianRupee}
              tone={commission && commission.overdueCount > 0 ? 'red' : commission && commission.outstandingCount > 0 ? 'amber' : 'green'}
              href="/garage/commission"
            />
          </div>

          <ListGroup
            title="Requests to quote"
            action={
              <LinkButton href="/garage/requests" variant="ghost" className="-mr-2 !min-h-[36px] !px-2 text-electric-700">
                See all
              </LinkButton>
            }
          >
            {openRequests.length > 0 ? (
              openRequests.map((r) => (
                <ListItem
                  key={`${r.serviceRequestId}-${r.createdAtUtc}`}
                  href="/garage/requests"
                  leading={<IconTile icon={Car} tone="blue" />}
                  title={`${r.vehicleYear ?? ''} ${r.vehicleMake ?? ''} ${r.vehicleModel ?? ''}`.trim() || 'Vehicle'}
                  subtitle={r.description}
                  meta={`${formatKm(r.distanceKm)} away · ${formatRelative(r.createdAtUtc)}`}
                  trailing={<StatusBadge status={r.status} />}
                />
              ))
            ) : (
              <div className="px-4 py-4 text-sm text-navy-500">No new requests right now. They appear here when a customer nearby books a service.</div>
            )}
          </ListGroup>

          <ListGroup
            title="Quotes in progress"
            action={
              <LinkButton href="/garage/quotes" variant="ghost" className="-mr-2 !min-h-[36px] !px-2 text-electric-700">
                See all
              </LinkButton>
            }
          >
            {openQuotes.length > 0 ? (
              openQuotes.map((q) => (
                <ListItem
                  key={q.id}
                  href={`/garage/quotes/${q.id}`}
                  leading={<IconTile icon={FileSpreadsheet} tone={q.status === 'Draft' ? 'neutral' : 'amber'} />}
                  title={q.vehicleSummary || q.quoteNumber}
                  subtitle={q.status === 'Draft' ? 'Draft · finish and submit' : 'Waiting for the advisor'}
                  meta={`${q.quoteNumber}${q.requestNumber ? ` · ${q.requestNumber}` : ''}`}
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums text-navy-900">{formatINRWhole(q.totalAmount)}</span>
                      <StatusBadge status={q.status} />
                    </div>
                  }
                />
              ))
            ) : (
              <div className="px-4 py-4 text-sm text-navy-500">No drafts or quotes waiting for a decision.</div>
            )}
          </ListGroup>
        </div>
      )}
    </div>
  );
}
