'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatDate, formatINR, formatINRWhole } from '@/lib/format';
import { AdvisorGarageQuoteSummaryDto } from '@/types/garageQuote';
import { Building2, FileSpreadsheet } from 'lucide-react';
import { StatusBadge, statusLabel } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { LoadingState } from '@/components/ui/LoadingState';
import { inDateRange, matchesSearch, useUrlFilters } from '@/lib/useUrlFilters';

function etaLabel(days?: number | null) {
  if (days === null || days === undefined) return 'Time not given';
  return `${days} day${days === 1 ? '' : 's'}`;
}

function isPast(value: string) {
  const t = new Date(value).getTime();
  return !Number.isNaN(t) && t < Date.now();
}

const FILTER_DEFAULTS = { q: '', status: '', range: '', from: '', to: '' };

export default function AdvisorQuotesPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading garage quotes..." />}>
      <AdvisorQuotes />
    </Suspense>
  );
}

function AdvisorQuotes() {
  const filters = useUrlFilters(FILTER_DEFAULTS);
  const { values: f } = filters;
  const [quotes, setQuotes] = useState<AdvisorGarageQuoteSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // The whole list is loaded, so filtering happens here. Chips are the statuses actually present;
  // their counts follow the search and date.
  const matching = useMemo(
    () =>
      quotes.filter(
        (q) =>
          inDateRange(q.submittedAtUtc, f) &&
          matchesSearch(f.q, q.quoteNumber, q.serviceRequestNumber, q.garageName, q.vehicleSummary, q.problemSummary)
      ),
    [quotes, f]
  );

  const chipOptions = useMemo(() => {
    const counts = new Map<string, number>();
    quotes.forEach((q) => counts.set(q.status, 0));
    if (f.status) counts.set(f.status, 0);
    matching.forEach((q) => counts.set(q.status, (counts.get(q.status) ?? 0) + 1));
    return [
      { value: '', label: 'All', count: matching.length },
      ...Array.from(counts.entries()).map(([status, count]) => ({ value: status, label: statusLabel(status), count })),
    ];
  }, [quotes, matching, f.status]);

  const visible = f.status ? matching.filter((q) => q.status === f.status) : matching;

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
          <FilterBar
            filters={filters}
            searchKey="q"
            searchPlaceholder="Quote, garage or car"
            searchLabel="Search garage quotes"
            status={chipOptions.length > 2 || f.status ? { key: 'status', options: chipOptions, ariaLabel: 'Quote status' } : undefined}
            fields={[{ type: 'dateRange', label: 'Submitted' }]}
            summary={`${visible.length} ${visible.length === 1 ? 'quote' : 'quotes'}`}
          />

          {visible.length === 0 ? (
            <EmptyState icon={FileSpreadsheet} title="No quotes found" description="No garage quotes match these filters." />
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
