'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatDate, formatINR, formatINRWhole } from '@/lib/format';
import { AdvisorGarageQuoteSummaryDto } from '@/types/garageQuote';
import { Building2, FileSpreadsheet } from 'lucide-react';
import { StatusBadge, statusLabel } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterChips } from '@/components/ui/FilterChips';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';

function etaLabel(days?: number | null) {
  if (days === null || days === undefined) return 'Time not given';
  return `${days} day${days === 1 ? '' : 's'}`;
}

function isPast(value: string) {
  const t = new Date(value).getTime();
  return !Number.isNaN(t) && t < Date.now();
}

export default function AdvisorQuotesPage() {
  const [quotes, setQuotes] = useState<AdvisorGarageQuoteSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<AdvisorGarageQuoteSummaryDto[]>('/advisor/garage-quotes');
    if (res.success && res.data) {
      setQuotes(res.data);
      setError(null);
    } else {
      setError(res.message || 'Could not load garage quotes.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  // Filter chips are built from the statuses actually present (filtering happens on this page only).
  const chipOptions = useMemo(() => {
    const counts = new Map<string, number>();
    quotes.forEach((q) => counts.set(q.status, (counts.get(q.status) ?? 0) + 1));
    return [
      { value: 'all', label: 'All', count: quotes.length },
      ...Array.from(counts.entries()).map(([status, count]) => ({ value: status, label: statusLabel(status), count })),
    ];
  }, [quotes]);

  const visible = statusFilter === 'all' ? quotes : quotes.filter((q) => q.status === statusFilter);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Garage quotes"
        description="Quotes garages have sent for your requests. To assign a garage, open the service request and compare its quotes."
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-2xl" />
          ))}
        </div>
      ) : error && quotes.length === 0 ? (
        <ErrorState title="Could not load garage quotes" error={error} onRetry={loadQuotes} />
      ) : quotes.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="No garage quotes yet"
          description="When garages quote for your requests, they appear here."
        />
      ) : (
        <>
          {chipOptions.length > 2 && (
            <FilterChips ariaLabel="Quote status" options={chipOptions} value={statusFilter} onChange={setStatusFilter} />
          )}

          {visible.length === 0 ? (
            <EmptyState icon={FileSpreadsheet} title="No quotes with this status" />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Garage</TableHead>
                      <TableHead>Request</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Valid until</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell>
                          <Link href={`/advisor/quotes/${q.id}`} className="font-semibold text-navy-900 hover:text-electric-600">
                            {q.garageName}
                          </Link>
                          <div className="font-mono text-xs text-navy-500">{q.quoteNumber}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-navy-900">{q.vehicleSummary}</div>
                          <div className="font-mono text-xs text-navy-500">{q.serviceRequestNumber}</div>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-navy-900">
                          {formatINR(q.totalAmount, q.currency)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-navy-700">{etaLabel(q.estimatedCompletionDays)}</TableCell>
                        <TableCell className={`whitespace-nowrap ${isPast(q.validUntil) ? 'text-red-600' : 'text-navy-700'}`}>
                          {formatDate(q.validUntil)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={q.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Phone list */}
              <div className="md:hidden">
                <ListGroup>
                  {visible.map((q) => (
                    <ListItem
                      key={q.id}
                      href={`/advisor/quotes/${q.id}`}
                      leading={<IconTile icon={Building2} tone="neutral" />}
                      title={q.garageName}
                      subtitle={`${q.serviceRequestNumber} · ${q.vehicleSummary}`}
                      meta={`${etaLabel(q.estimatedCompletionDays)} · valid until ${formatDate(q.validUntil)}`}
                      trailing={
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-sm font-semibold tabular-nums text-navy-900">
                            {q.currency && q.currency !== 'INR' ? formatINR(q.totalAmount, q.currency) : formatINRWhole(q.totalAmount)}
                          </span>
                          <StatusBadge status={q.status} />
                        </div>
                      }
                    />
                  ))}
                </ListGroup>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
