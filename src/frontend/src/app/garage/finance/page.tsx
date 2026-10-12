'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { GarageSettlementDto } from '@/types/finance';
import { Banknote, CheckCircle2, Clock, Percent, Search, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { FilterChips } from '@/components/ui/FilterChips';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Alert } from '@/components/ui/Alert';
import { formatDate, formatINR, formatINRShort, formatINRWhole } from '@/lib/format';

/**
 * The API's GarageSettlementDto (backend) uses different field names from the shared frontend type
 * (taxOnPlatformFee / settledAtUtc / payoutTransactionRef / jobNumber). Read both so the page works
 * either way; see report.
 */
type SettlementRow = Partial<GarageSettlementDto> & {
  id: string;
  settlementNumber: string;
  grossAmount: number;
  platformFeeAmount: number;
  totalPlatformFee: number;
  netPayableToGarage: number;
  status: string;
  createdAtUtc: string;
  jobNumber?: string | null;
  platformFeePercentage?: number | null;
  taxOnPlatformFee?: number | null;
  settledAtUtc?: string | null;
  payoutTransactionRef?: string | null;
};

const DUE_STATUSES = ['Pending', 'Processing'];
const PAID_STATUSES = ['Completed'];

function feeGst(s: SettlementRow) {
  return Number(s.taxOnPlatformFee ?? s.platformFeeGstAmount ?? s.totalPlatformFee - s.platformFeeAmount) || 0;
}

function feeRate(s: SettlementRow) {
  const rate = s.platformFeePercentage ?? s.platformFeeRatePercent;
  if (rate != null && Number(rate) > 0) return Number(rate);
  return s.grossAmount ? (s.platformFeeAmount / s.grossAmount) * 100 : 0;
}

function gstRate(s: SettlementRow) {
  const rate = s.platformFeeGstRatePercent;
  if (rate != null && Number(rate) > 0) return Number(rate);
  return s.platformFeeAmount ? (feeGst(s) / s.platformFeeAmount) * 100 : 0;
}

function pct(value: number) {
  return `${Number.isInteger(Math.round(value * 10) / 10) ? Math.round(value) : value.toFixed(1)}%`;
}

function paidOn(s: SettlementRow) {
  return s.settledAtUtc ?? s.payoutProcessedAtUtc ?? null;
}

function payoutRef(s: SettlementRow) {
  return s.payoutTransactionRef ?? s.payoutReference ?? null;
}

function jobRef(s: SettlementRow) {
  return s.jobNumber || (s.serviceJobId ? `Job ${s.serviceJobId.substring(0, 8)}` : null);
}

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'due', label: 'Due' },
  { value: 'paid', label: 'Paid' },
];

export default function GarageFinancePage() {
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');

  async function loadSettlements() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<SettlementRow[]>('/garage/finance/settlements');
      if (res.success && res.data) {
        setSettlements(res.data);
      } else {
        setError(res.message || 'Could not load payouts.');
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load payouts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettlements();
  }, []);

  const totals = useMemo(() => {
    const sum = (rows: SettlementRow[], pick: (s: SettlementRow) => number) => rows.reduce((acc, s) => acc + (pick(s) || 0), 0);
    const due = settlements.filter((s) => DUE_STATUSES.includes(s.status));
    const paid = settlements.filter((s) => PAID_STATUSES.includes(s.status));
    return {
      gross: sum(settlements, (s) => s.grossAmount),
      fees: sum(settlements, (s) => s.totalPlatformFee),
      due: sum(due, (s) => s.netPayableToGarage),
      dueCount: due.length,
      paid: sum(paid, (s) => s.netPayableToGarage),
      paidCount: paid.length,
    };
  }, [settlements]);

  const filtered = settlements.filter((s) => {
    if (filter === 'due' && !DUE_STATUSES.includes(s.status)) return false;
    if (filter === 'paid' && !PAID_STATUSES.includes(s.status)) return false;
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return [s.settlementNumber, payoutRef(s), jobRef(s)].some((v) => v && v.toLowerCase().includes(term));
  });

  return (
    <div>
      <PageHeader
        title="Past payouts"
        description="What you earn on each finished job, after the BroCo platform fee and GST on that fee."
      />

      <div className="space-y-5 sm:space-y-6">
        <Alert type="info" title="Payouts are no longer used for new jobs">
          Customers now pay you directly at handover (after a 10% advance to BroCo), and BroCo bills you a
          commission instead.{' '}
          <Link href="/garage/commission" className="font-semibold underline">
            See BroCo commission
          </Link>
          . This page keeps your older payouts for reference.
        </Alert>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[104px] w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          !error && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Payouts due"
                value={formatINRShort(totals.due)}
                hint={`${totals.dueCount} not paid yet`}
                icon={Clock}
                tone="amber"
              />
              <StatCard
                label="Paid to you"
                value={formatINRShort(totals.paid)}
                hint={`${totals.paidCount} payout${totals.paidCount === 1 ? '' : 's'}`}
                icon={CheckCircle2}
                tone="green"
              />
              <StatCard label="Gross (quote totals)" value={formatINRShort(totals.gross)} hint="All jobs" icon={Banknote} tone="blue" />
              <StatCard
                label="Platform fee + GST"
                value={formatINRShort(totals.fees)}
                hint="Deducted from gross"
                icon={Percent}
                tone="neutral"
              />
            </div>
          )
        )}

        <div className="rounded-2xl border border-surface-200 bg-white p-4 text-sm text-navy-600 shadow-card sm:p-5">
          <h2 className="text-base font-semibold text-navy-900">How a payout is worked out</h2>
          <ul className="mt-2 space-y-1">
            <li>
              <span className="font-medium text-navy-800">Gross</span> is your accepted quote total for the job.
            </li>
            <li>
              <span className="font-medium text-navy-800">Platform fee</span> is a percentage of gross, and{' '}
              <span className="font-medium text-navy-800">GST</span> is charged on that fee.
            </li>
            <li>
              <span className="font-medium text-navy-800">Net payable</span> = gross − platform fee − GST on fee.
            </li>
          </ul>
        </div>

        {!loading && !error && settlements.length > 0 && (
          <div className="space-y-3">
            <Input
              id="payout-search"
              aria-label="Search payouts"
              placeholder="Search by payout, job or UTR number"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
            <FilterChips options={FILTERS} value={filter} onChange={setFilter} ariaLabel="Filter payouts" />
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-44 w-full rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <ErrorState title="Couldn’t load payouts" error={error} onRetry={loadSettlements} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={settlements.length === 0 ? 'No payouts yet' : 'No matching payouts'}
            description={
              settlements.length === 0 ? (
                <>
                  A payout is created once the customer has paid for a finished job. See your{' '}
                  <Link href="/garage/jobs" className="font-semibold text-electric-700 underline">
                    service jobs
                  </Link>
                  .
                </>
              ) : (
                'Try a different search or filter.'
              )
            }
          />
        ) : (
          <>
            {/* Phones: one card per payout */}
            <div className="space-y-3 md:hidden">
              {filtered.map((s) => {
                const ref = payoutRef(s);
                const paid = paidOn(s);
                return (
                  <article key={s.id} className="rounded-2xl border border-surface-200 bg-white p-4 shadow-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-[15px] font-semibold text-navy-900">{jobRef(s) ?? s.settlementNumber}</h3>
                        <div className="mt-0.5 text-xs text-navy-500">
                          {s.settlementNumber} · {formatDate(s.createdAtUtc)}
                        </div>
                      </div>
                      <StatusBadge status={s.status} />
                    </div>

                    <dl className="mt-3 space-y-1.5 text-sm">
                      <div className="flex justify-between gap-3 text-navy-600">
                        <dt>Gross (quote total)</dt>
                        <dd className="tabular-nums">{formatINR(s.grossAmount)}</dd>
                      </div>
                      <div className="flex justify-between gap-3 text-navy-600">
                        <dt>Platform fee ({pct(feeRate(s))})</dt>
                        <dd className="tabular-nums">− {formatINR(s.platformFeeAmount)}</dd>
                      </div>
                      <div className="flex justify-between gap-3 text-navy-600">
                        <dt>GST on fee ({pct(gstRate(s))})</dt>
                        <dd className="tabular-nums">− {formatINR(feeGst(s))}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3 border-t border-surface-200 pt-2">
                        <dt className="font-semibold text-navy-900">Net payable</dt>
                        <dd className="text-base font-bold tabular-nums text-navy-900">{formatINR(s.netPayableToGarage)}</dd>
                      </div>
                    </dl>

                    {(paid || ref) && (
                      <div className="mt-2 text-xs text-navy-500">
                        {paid ? `Paid ${formatDate(paid)}` : 'Not paid yet'}
                        {ref ? ` · UTR ${ref}` : ''}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-card md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payout</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Platform fee</TableHead>
                    <TableHead className="text-right">GST on fee</TableHead>
                    <TableHead className="text-right">Net payable</TableHead>
                    <TableHead className="text-right">Paid on</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => {
                    const ref = payoutRef(s);
                    const paid = paidOn(s);
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="font-semibold text-navy-900">{jobRef(s) ?? s.settlementNumber}</div>
                          <div className="text-xs text-navy-400">{s.settlementNumber}</div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={s.status} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatINRWhole(s.grossAmount)}</TableCell>
                        <TableCell className="text-right tabular-nums text-navy-500">
                          − {formatINRWhole(s.platformFeeAmount)}
                          <div className="text-xs text-navy-400">{pct(feeRate(s))}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-navy-500">
                          − {formatINRWhole(feeGst(s))}
                          <div className="text-xs text-navy-400">{pct(gstRate(s))}</div>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-navy-900">
                          {formatINR(s.netPayableToGarage)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-navy-500">
                          {paid ? formatDate(paid) : 'Not yet'}
                          {ref && <div className="text-xs text-navy-400">UTR {ref}</div>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
