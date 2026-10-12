'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock, IndianRupee, Receipt } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { formatDate, formatDateTime, formatINR, formatINRShort, formatINRWhole } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { FilterChips } from '@/components/ui/FilterChips';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { ActionBar, ActionBarSpacer } from '@/components/ui/ActionBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import {
  GarageCommission,
  GarageCommissionSummary,
  commissionTiming,
  payCommissions,
  pctLabel,
} from '@/components/garage/commission';

type Filter = 'Due' | 'Paid' | 'All';

/** Exact rupees in KPI tiles while they fit; compact once they get long. */
function kpiAmount(value: number) {
  return Math.abs(value) >= 1_00_000 ? formatINRShort(value) : formatINRWhole(value);
}

function Row({ label, value, strong, muted }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-2 ${strong ? 'border-t border-surface-200 pt-3' : ''}`}>
      <dt className={strong ? 'text-sm font-semibold text-navy-900' : 'text-sm text-navy-500'}>{label}</dt>
      <dd
        className={`text-right tabular-nums ${
          strong ? 'text-lg font-bold text-navy-900' : muted ? 'text-sm text-navy-500' : 'text-sm font-medium text-navy-900'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function statusChip(c: GarageCommission) {
  if (c.status === 'Due') {
    return c.isOverdue ? (
      <Badge variant="red" dot pill className="whitespace-nowrap">
        Overdue
      </Badge>
    ) : (
      <Badge variant="amber" dot pill className="whitespace-nowrap">
        Due
      </Badge>
    );
  }
  return <StatusBadge status={c.status} />;
}

export default function GarageCommissionPage() {
  const toast = useToast();
  const [summary, setSummary] = useState<GarageCommissionSummary | null>(null);
  const [items, setItems] = useState<GarageCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('Due');
  const [selected, setSelected] = useState<GarageCommission | null>(null);
  /** 'all' while paying every outstanding due, or the id of the single due being paid. */
  const [paying, setPaying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [summaryRes, listRes] = await Promise.all([
      apiFetch<GarageCommissionSummary>('/garage/commission/summary'),
      apiFetch<GarageCommission[]>('/garage/commission'),
    ]);
    if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data);
    if (listRes.success && Array.isArray(listRes.data)) {
      setItems(listRes.data);
    } else {
      setError(listRes.message || 'Could not load your commission.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      Due: items.filter((c) => c.status === 'Due').length,
      Paid: items.filter((c) => c.status === 'Paid').length,
      All: items.length,
    }),
    [items]
  );

  const visible = useMemo(() => {
    const rows = filter === 'All' ? items : items.filter((c) => c.status === filter);
    // Overdue first, then the soonest due; paid rows newest first.
    return [...rows].sort((a, b) => {
      if (a.status === 'Due' && b.status === 'Due') {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        return new Date(a.dueAtUtc).getTime() - new Date(b.dueAtUtc).getTime();
      }
      if (a.status === 'Due') return -1;
      if (b.status === 'Due') return 1;
      return new Date(b.paidAtUtc ?? b.createdAtUtc).getTime() - new Date(a.paidAtUtc ?? a.createdAtUtc).getTime();
    });
  }, [items, filter]);

  const outstandingAmount = summary?.outstandingAmount ?? items.filter((c) => c.status === 'Due').reduce((s, c) => s + c.totalDue, 0);
  const outstandingCount = summary?.outstandingCount ?? counts.Due;

  async function pay(target: GarageCommission | null) {
    setPaying(target ? target.id : 'all');
    const result = await payCommissions(target ? [target.id] : null);
    if (result.status === 'redirected') return; // leaving for the gateway's checkout page
    if (result.status === 'paid') {
      toast.success('Payment received', `${formatINR(result.amount)} paid to BroCo. Thank you!`);
      setSelected(null);
      await load();
    } else {
      toast.error('Payment failed', result.message);
    }
    setPaying(null);
  }

  const selectedTiming = selected ? commissionTiming(selected) : null;

  return (
    <div>
      <PageHeader
        title="BroCo commission"
        description="What you owe BroCo for cars you've handed back: 10% of the service value plus 18% GST on it."
      />

      {loading ? (
        <div className="space-y-5 sm:space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className={`h-[104px] w-full rounded-2xl ${i === 2 ? 'col-span-2 lg:col-span-1' : ''}`} />
            ))}
          </div>
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : error && items.length === 0 ? (
        <ErrorState title="Couldn’t load your commission" error={error} onRetry={load} />
      ) : (
        <div className="space-y-5 sm:space-y-6">
          {summary?.newJobsBlocked && (
            <Alert type="error" title="New jobs are paused until overdue commission is paid">
              Commission older than 3 days is overdue. Pay it to start receiving new bookings again.
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard
              label="Outstanding"
              value={kpiAmount(outstandingAmount)}
              hint={outstandingCount > 0 ? `${outstandingCount} job${outstandingCount === 1 ? '' : 's'} to pay` : 'Nothing to pay'}
              icon={Clock}
              tone="amber"
            />
            <StatCard
              label="Overdue"
              value={kpiAmount(summary?.overdueAmount ?? 0)}
              hint={
                (summary?.overdueCount ?? 0) > 0
                  ? `${summary?.overdueCount} past the due time`
                  : 'Nothing overdue'
              }
              icon={AlertTriangle}
              tone={(summary?.overdueCount ?? 0) > 0 ? 'red' : 'neutral'}
            />
            <StatCard
              label="Paid this month"
              value={kpiAmount(summary?.paidThisMonth ?? 0)}
              hint="Commission + GST"
              icon={CheckCircle2}
              tone="green"
              className="col-span-2 lg:col-span-1"
            />
          </div>

          <section className="space-y-3">
            <FilterChips
              ariaLabel="Filter commission"
              value={filter}
              onChange={(v) => setFilter(v as Filter)}
              options={[
                { value: 'Due', label: 'Due', count: counts.Due },
                { value: 'Paid', label: 'Paid', count: counts.Paid },
                { value: 'All', label: 'All', count: counts.All },
              ]}
            />

            {visible.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title={filter === 'Due' ? 'No commission due' : filter === 'Paid' ? 'Nothing paid yet' : 'No commission yet'}
                description={
                  filter === 'Due'
                    ? 'When you hand a car back, BroCo’s commission for that job shows up here. You have 24 hours to pay it.'
                    : 'Commission for each handed-over job appears here.'
                }
              />
            ) : (
              <ListGroup>
                {visible.map((c) => {
                  const timing = commissionTiming(c);
                  const timingClass =
                    timing.tone === 'red' ? 'font-medium text-red-600' : timing.tone === 'amber' ? 'text-amber-700' : '';
                  return (
                    <ListItem
                      key={c.id}
                      onClick={() => setSelected(c)}
                      leading={
                        <IconTile
                          icon={c.status === 'Due' ? (c.isOverdue ? AlertTriangle : IndianRupee) : CheckCircle2}
                          tone={c.status === 'Due' ? (c.isOverdue ? 'red' : 'amber') : c.status === 'Paid' ? 'green' : 'neutral'}
                        />
                      }
                      title={c.vehicleSummary || c.jobNumber}
                      subtitle={c.jobNumber}
                      meta={
                        <>
                          <span className="block">
                            Service {formatINRWhole(c.serviceValue)} · {formatINRWhole(c.commissionAmount)} +{' '}
                            {formatINRWhole(c.taxAmount)} GST
                          </span>
                          <span className={`mt-0.5 block whitespace-nowrap ${timingClass}`}>
                            {c.status === 'Paid' && c.paidAtUtc ? `Paid ${formatDate(c.paidAtUtc)}` : timing.text}
                          </span>
                        </>
                      }
                      trailing={
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-sm font-semibold tabular-nums text-navy-900">{formatINRWhole(c.totalDue)}</span>
                          {statusChip(c)}
                        </div>
                      }
                    />
                  );
                })}
              </ListGroup>
            )}
          </section>

          <section className="rounded-2xl border border-surface-200 bg-white p-4 text-sm text-navy-600 shadow-card sm:p-5">
            <h2 className="text-base font-semibold text-navy-900">How it’s calculated</h2>
            <p className="mt-1">
              The customer pays 10% to BroCo when booking and the rest to you at handover. When you hand the car
              back, BroCo bills you 10% of the full service value plus 18% GST. Pay within 24 hours; after 3 days
              you stop getting new jobs.
            </p>
            <div className="mt-3 rounded-xl bg-surface-50 p-3">
              <div className="text-xs font-medium text-navy-500">Example: ₹5,000 service</div>
              <dl className="mt-1 divide-y divide-surface-200/80">
                <Row label="Customer paid BroCo online (10%)" value="₹500" />
                <Row label="Customer paid you at the garage" value="₹4,500" />
                <Row label="Commission (10% of ₹5,000)" value="₹500" />
                <Row label="GST on commission (18%)" value="₹90" />
                <Row label="You pay BroCo" value="₹590" strong />
              </dl>
            </div>
          </section>
        </div>
      )}

      {!loading && outstandingCount > 0 && (
        <>
          <ActionBar
            summary={
              <div className="min-w-0">
                <div className="truncate text-xs text-navy-500">
                  {outstandingCount} job{outstandingCount === 1 ? '' : 's'} · incl. GST
                </div>
                <div className="text-base font-bold tabular-nums text-navy-900">{formatINR(outstandingAmount)}</div>
              </div>
            }
          >
            <Button onClick={() => pay(null)} isLoading={paying === 'all'} disabled={paying !== null}>
              Pay {formatINRWhole(outstandingAmount)} now
            </Button>
          </ActionBar>
          <ActionBarSpacer />
        </>
      )}

      <Modal
        isOpen={!!selected}
        onClose={() => paying === null && setSelected(null)}
        title={selected ? selected.vehicleSummary || selected.jobNumber : undefined}
        description={selected ? `${selected.commissionNumber} · ${selected.jobNumber}` : undefined}
        footer={
          selected ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setSelected(null)}
                disabled={paying !== null}
              >
                Close
              </Button>
              {selected.status === 'Due' && (
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => pay(selected)}
                  isLoading={paying === selected.id}
                  disabled={paying !== null}
                >
                  Pay {formatINR(selected.totalDue)}
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        {selected && selectedTiming && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {statusChip(selected)}
              <span
                className={`text-sm ${
                  selectedTiming.tone === 'red' ? 'font-medium text-red-600' : selectedTiming.tone === 'amber' ? 'text-amber-700' : 'text-navy-500'
                }`}
              >
                {selected.status === 'Due'
                  ? `${selectedTiming.text} · due ${formatDateTime(selected.dueAtUtc)}`
                  : selected.status === 'Paid'
                  ? `Paid ${formatDateTime(selected.paidAtUtc)}${selected.settledVia ? ` · ${selected.settledVia}` : ''}`
                  : 'Waived by BroCo'}
              </span>
            </div>

            <dl className="divide-y divide-surface-200 rounded-xl border border-surface-200 px-3">
              <Row label="Service value" value={formatINR(selected.serviceValue)} />
              <Row label="Advance BroCo collected online" value={formatINR(selected.advanceCollectedByPlatform)} muted />
              <Row label="Balance you collected" value={formatINR(selected.balanceCollectedByGarage)} muted />
              <Row
                label={`Commission (${pctLabel(selected.commissionPercentage)} of service value)`}
                value={formatINR(selected.commissionAmount)}
              />
              <Row label={`GST on commission (${pctLabel(selected.taxPercentage)})`} value={formatINR(selected.taxAmount)} />
              <Row label={selected.status === 'Paid' ? 'Total paid' : 'Total to pay'} value={formatINR(selected.totalDue)} strong />
            </dl>

            {selected.paymentReference && (
              <p className="text-xs text-navy-500">
                Payment reference <span className="font-mono text-navy-700">{selected.paymentReference}</span>
              </p>
            )}
            {selected.waiverReason && <p className="text-sm text-navy-600">Reason: {selected.waiverReason}</p>}
            {selected.status === 'Due' && selected.remindersSent > 0 && (
              <p className="text-xs text-navy-500">
                {selected.remindersSent} reminder{selected.remindersSent === 1 ? '' : 's'} sent.
              </p>
            )}

            <Link
              href={`/garage/jobs/${selected.serviceJobId}`}
              className="inline-flex min-h-[44px] items-center text-sm font-medium text-electric-700 hover:underline"
            >
              Open job {selected.jobNumber}
            </Link>
          </div>
        )}
      </Modal>
    </div>
  );
}
