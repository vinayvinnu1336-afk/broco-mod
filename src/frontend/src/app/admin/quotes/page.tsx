'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminGarageQuoteSummaryDto, AdminGarageQuoteDetailDto } from '@/types/garageQuote';
import { FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { ListGroup, ListItem } from '@/components/ui/ListItem';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { formatDate, formatDateTime, formatINR, formatINRWhole, humanize } from '@/lib/format';
import { inDateRange, matchesSearch, useUrlFilters } from '@/lib/useUrlFilters';

// Client-side filter on GarageQuoteStatus names, compared case-insensitively with the row status.
const STATUS_OPTIONS = [
  { value: 'Submitted', label: 'Submitted' },
  { value: 'UnderReview', label: 'Under review' },
  { value: 'SelectedByAdvisor', label: 'Selected' },
  { value: 'RejectedByAdvisor', label: 'Not selected' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Withdrawn', label: 'Withdrawn' },
  { value: 'Expired', label: 'Expired' },
];

const FILTER_DEFAULTS = { q: '', status: '', garage: '', range: '', from: '', to: '' };

function estimatedTime(quote: AdminGarageQuoteDetailDto): string {
  const parts: string[] = [];
  if (quote.estimatedCompletionDays) parts.push(`${quote.estimatedCompletionDays} ${quote.estimatedCompletionDays === 1 ? 'day' : 'days'}`);
  if (quote.estimatedCompletionHours) parts.push(`${quote.estimatedCompletionHours} h`);
  return parts.length ? parts.join(' · ') : 'Not given';
}

const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
  <div className={className}>
    <dt className="text-xs text-navy-500">{label}</dt>
    <dd className="mt-0.5 text-sm font-medium text-navy-900">{children}</dd>
  </div>
);

export default function AdminGarageQuotesPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading garage quotes..." />}>
      <AdminGarageQuotes />
    </Suspense>
  );
}

function AdminGarageQuotes() {
  const toast = useToast();
  const filters = useUrlFilters(FILTER_DEFAULTS);
  const { values: f } = filters;
  const [quotes, setQuotes] = useState<AdminGarageQuoteSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail modal
  const [selectedQuote, setSelectedQuote] = useState<AdminGarageQuoteDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const pendingQuoteId = useRef<string | null>(null);

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<AdminGarageQuoteSummaryDto[]>('/admin/garage-quotes');
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

  async function viewDetail(quoteId: string) {
    pendingQuoteId.current = quoteId;
    setSelectedQuote(null);
    setDetailLoading(true);
    const res = await apiFetch<AdminGarageQuoteDetailDto>(`/admin/garage-quotes/${quoteId}`);
    // Ignore the response if the sheet was closed or another quote was opened meanwhile.
    if (pendingQuoteId.current !== quoteId) return;
    if (res.success && res.data) {
      setSelectedQuote(res.data);
    } else {
      pendingQuoteId.current = null;
      toast.error('Could not open quote', res.message);
    }
    setDetailLoading(false);
  }

  function closeDetail() {
    pendingQuoteId.current = null;
    setSelectedQuote(null);
    setDetailLoading(false);
  }

  const garageOptions = useMemo(() => {
    const names = new Map<string, string>();
    quotes.forEach((q) => names.set(q.garageId, q.garageName));
    return Array.from(names, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [quotes]);

  // Rows matching everything except the status, so each chip can show how many it would leave.
  const matchingOtherFilters = useMemo(
    () =>
      quotes.filter(
        (q) =>
          matchesSearch(f.q, q.quoteNumber, q.serviceRequestNumber, q.garageName, q.vehicleSummary) &&
          (!f.garage || q.garageId === f.garage) &&
          inDateRange(q.submittedAtUtc, f)
      ),
    [quotes, f]
  );

  const filteredQuotes = useMemo(
    () => matchingOtherFilters.filter((q) => !f.status || q.status.toUpperCase() === f.status.toUpperCase()),
    [matchingOtherFilters, f.status]
  );

  const statusOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    matchingOtherFilters.forEach((q) => {
      const key = q.status.toUpperCase();
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return [
      { value: '', label: 'All', count: matchingOtherFilters.length },
      ...STATUS_OPTIONS.map((o) => ({ ...o, count: counts[o.value.toUpperCase()] ?? 0 })),
    ];
  }, [matchingOtherFilters]);

  const anyFilter = (Object.keys(FILTER_DEFAULTS) as (keyof typeof FILTER_DEFAULTS)[]).some((k) => filters.isActive(k));
  const modalOpen = detailLoading || selectedQuote !== null;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Garage quotes"
        description="Every quote garages have sent, with line items and version history. Read-only."
      />

      <FilterBar
        filters={filters}
        searchKey="q"
        searchPlaceholder="Quote, request, garage or car"
        searchLabel="Search garage quotes"
        status={{ key: 'status', options: statusOptions }}
        fields={[
          { type: 'select', key: 'garage', label: 'Garage', allLabel: 'All garages', options: garageOptions },
          { type: 'dateRange', label: 'Submitted' },
        ]}
        summary={loading ? 'Loading…' : `${filteredQuotes.length} ${filteredQuotes.length === 1 ? 'quote' : 'quotes'}`}
      />

      {loading ? (
        <LoadingState message="Loading garage quotes..." />
      ) : error ? (
        <ErrorState title="Could not load garage quotes" error={error} onRetry={loadQuotes} />
      ) : filteredQuotes.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="No quotes found"
          description={
            anyFilter ? 'No quotes match these filters.' : 'Quotes appear here once garages respond to requests.'
          }
        />
      ) : (
        <>
          {/* Phones */}
          <div className="md:hidden">
            <ListGroup>
              {filteredQuotes.map((q) => (
                <ListItem
                  key={q.id}
                  onClick={() => viewDetail(q.id)}
                  title={q.garageName}
                  subtitle={q.vehicleSummary}
                  meta={
                    <>
                      <span className="font-mono">{q.quoteNumber}</span> · {q.serviceRequestNumber} ·{' '}
                      {q.submittedAtUtc ? formatDate(q.submittedAtUtc) : 'Not submitted'}
                    </>
                  }
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums text-navy-900">{formatINRWhole(q.totalAmount)}</span>
                      <StatusBadge status={q.status} />
                    </div>
                  }
                />
              ))}
            </ListGroup>
          </div>

          {/* Tablets and laptops */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote</TableHead>
                  <TableHead>Garage</TableHead>
                  <TableHead className="hidden lg:table-cell">Request</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="hidden lg:table-cell">Submitted</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Details</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs font-semibold text-navy-900">{q.quoteNumber}</TableCell>
                    <TableCell className="font-medium text-navy-900">{q.garageName}</TableCell>
                    <TableCell className="hidden whitespace-nowrap font-mono text-xs text-navy-600 lg:table-cell">
                      {q.serviceRequestNumber}
                    </TableCell>
                    <TableCell className="text-navy-700">{q.vehicleSummary}</TableCell>
                    <TableCell>
                      <StatusBadge status={q.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums text-navy-900">
                      {formatINR(q.totalAmount, q.currency)}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-navy-500 lg:table-cell">
                      {q.submittedAtUtc ? formatDate(q.submittedAtUtc) : 'Not submitted'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => viewDetail(q.id)} aria-label={`View quote ${q.quoteNumber}`}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Quote detail */}
      <Modal
        isOpen={modalOpen}
        onClose={closeDetail}
        size="lg"
        title={selectedQuote ? selectedQuote.garageName : 'Quote details'}
        description={
          selectedQuote
            ? `${selectedQuote.quoteNumber} · Request ${selectedQuote.serviceRequestNumber} · ${selectedQuote.vehicleSummary}`
            : undefined
        }
        footer={
          <div className="flex justify-end">
            <Button variant="outline" className="w-full sm:w-auto" onClick={closeDetail}>
              Close
            </Button>
          </div>
        }
      >
        {!selectedQuote ? (
          <LoadingState inline message="Loading quote..." className="justify-center py-10" />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StatusBadge status={selectedQuote.status} />
              <span className="text-xl font-bold tabular-nums text-navy-900">
                {formatINR(selectedQuote.totalAmount, selectedQuote.currency)}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Valid until">{formatDate(selectedQuote.validUntil)}</Field>
              <Field label="Estimated time">{estimatedTime(selectedQuote)}</Field>
              <Field label="Submitted">
                {selectedQuote.submittedAtUtc ? formatDateTime(selectedQuote.submittedAtUtc) : 'Not submitted'}
              </Field>
              {selectedQuote.garagePhone && (
                <Field label="Garage phone">
                  <a href={`tel:${selectedQuote.garagePhone}`} className="text-electric-600 hover:underline">
                    {selectedQuote.garagePhone}
                  </a>
                </Field>
              )}
              {selectedQuote.garageAddress && (
                <Field label="Garage address" className="col-span-2">
                  {selectedQuote.garageAddress}
                </Field>
              )}
            </dl>

            {selectedQuote.garageRemarks && (
              <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                <p className="text-xs text-navy-500">Garage remarks</p>
                <p className="mt-0.5 text-sm text-navy-800">{selectedQuote.garageRemarks}</p>
              </div>
            )}

            {selectedQuote.withdrawnAtUtc && (
              <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                <p className="text-xs text-navy-500">Withdrawn {formatDateTime(selectedQuote.withdrawnAtUtc)}</p>
                {selectedQuote.withdrawalReason && (
                  <p className="mt-0.5 text-sm text-navy-800">{selectedQuote.withdrawalReason}</p>
                )}
              </div>
            )}

            {/* Line items */}
            <section>
              <h4 className="mb-2 text-base font-semibold text-navy-900">Line items</h4>
              {selectedQuote.lineItems.length === 0 ? (
                <p className="text-sm text-navy-500">No line items.</p>
              ) : (
                <div className="divide-y divide-surface-200 rounded-xl border border-surface-200">
                  {selectedQuote.lineItems.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-navy-900">{item.description}</p>
                        <p className="mt-0.5 text-xs text-navy-500">
                          {humanize(String(item.lineType))} · {item.quantity} × {formatINR(item.unitPrice, selectedQuote.currency)} · GST{' '}
                          {item.taxRate}%
                          {item.discountAmount > 0 && (
                            <span className="text-emerald-700"> · −{formatINR(item.discountAmount, selectedQuote.currency)}</span>
                          )}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-navy-900">
                        {formatINR(item.lineTotal, selectedQuote.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between text-navy-600">
                  <dt>Subtotal</dt>
                  <dd className="tabular-nums">{formatINR(selectedQuote.subtotal, selectedQuote.currency)}</dd>
                </div>
                <div className="flex justify-between text-navy-600">
                  <dt>GST</dt>
                  <dd className="tabular-nums">{formatINR(selectedQuote.taxAmount, selectedQuote.currency)}</dd>
                </div>
                {selectedQuote.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <dt>Discount</dt>
                    <dd className="tabular-nums">−{formatINR(selectedQuote.discountAmount, selectedQuote.currency)}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-surface-200 pt-2 font-semibold text-navy-900">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatINR(selectedQuote.totalAmount, selectedQuote.currency)}</dd>
                </div>
              </dl>
            </section>

            {/* Version history */}
            {selectedQuote.versions && selectedQuote.versions.length > 0 && (
              <section>
                <h4 className="mb-2 text-base font-semibold text-navy-900">Version history</h4>
                <div className="divide-y divide-surface-200 rounded-xl border border-surface-200">
                  {selectedQuote.versions.map((ver) => (
                    <div key={ver.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-navy-900">Version {ver.versionNumber}</p>
                        <p className="text-xs text-navy-500">{formatDateTime(ver.submittedAtUtc)}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-navy-900">
                        {formatINR(ver.totalAmount, selectedQuote.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
