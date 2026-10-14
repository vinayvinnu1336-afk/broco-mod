'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { CustomerQuotationSummaryDto } from '@/types/customerQuotation';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { ListGroup, ListItem } from '@/components/ui/ListItem';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { formatDate, formatINR, formatINRWhole } from '@/lib/format';
import { dateRangeQuery, toQueryString, useUrlFilters } from '@/lib/useUrlFilters';

// Values are CustomerQuotationStatus names (the API filters on them); labels are what operators read.
const STATUS_OPTIONS = [
  { value: 'ReadyToSend', label: 'Ready to send' },
  { value: 'Sent', label: 'Sent' },
  { value: 'Accepted', label: 'Accepted' },
  { value: 'Rejected', label: 'Declined' },
  { value: 'Expired', label: 'Expired' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Cancelled', label: 'Cancelled' },
];

const FILTER_DEFAULTS = { q: '', status: '', range: '', from: '', to: '' };

// The endpoint returns a plain list (no total), so paging is Previous / Next.
const PAGE_SIZE = 50;

const rowLink =
  'inline-flex min-h-[36px] items-center rounded-xl border border-surface-300 bg-white px-3 text-xs font-semibold text-navy-800 transition hover:bg-surface-50';

export default function AdminCustomerQuotationsPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading customer quotations..." />}>
      <AdminCustomerQuotations />
    </Suspense>
  );
}

function AdminCustomerQuotations() {
  const filters = useUrlFilters(FILTER_DEFAULTS);
  const { values: f, page } = filters;
  const [quotations, setQuotations] = useState<CustomerQuotationSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const query = useMemo(
    () => toQueryString({ page, pageSize: PAGE_SIZE, search: f.q, status: f.status, ...dateRangeQuery(f) }),
    [page, f]
  );

  const loadQuotations = useCallback(async (qs: string) => {
    const id = ++latest.current;
    setLoading(true);
    const res = await apiFetch<CustomerQuotationSummaryDto[]>(`/admin/customer-quotations${qs}`);
    if (id !== latest.current) return; // a newer filter change is already loading
    if (res.success && res.data) {
      setQuotations(res.data);
      setError(null);
    } else {
      setError(res.message || 'Could not load customer quotations.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadQuotations(query);
  }, [loadQuotations, query]);

  const goToPage = (p: number) => {
    filters.setPage(p);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasMore = quotations.length === PAGE_SIZE;
  const anyFilter = (Object.keys(FILTER_DEFAULTS) as (keyof typeof FILTER_DEFAULTS)[]).some((k) => filters.isActive(k));
  const firstRow = (page - 1) * PAGE_SIZE + 1;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Customer quotations"
        description="Prices sent to customers after advisors pick a garage quote. Tap one to open its request."
      />

      <FilterBar
        filters={filters}
        searchKey="q"
        searchPlaceholder="Quotation, request, customer or plate"
        searchLabel="Search customer quotations"
        fields={[
          { type: 'select', key: 'status', label: 'Status', allLabel: 'All statuses', options: STATUS_OPTIONS },
          { type: 'dateRange', label: 'Created' },
        ]}
        summary={
          loading
            ? 'Loading…'
            : quotations.length === 0
            ? null
            : page > 1 || hasMore
            ? `Showing ${firstRow}–${firstRow + quotations.length - 1}`
            : `${quotations.length} ${quotations.length === 1 ? 'quotation' : 'quotations'}`
        }
      />

      {loading ? (
        <LoadingState message="Loading customer quotations..." />
      ) : error ? (
        <ErrorState title="Could not load customer quotations" error={error} onRetry={() => loadQuotations(query)} />
      ) : quotations.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No customer quotations found"
          description={
            page > 1
              ? 'There are no more quotations on this page.'
              : anyFilter
              ? 'No quotations match these filters.'
              : 'Quotations appear here once an advisor prepares one for a customer.'
          }
          action={
            page > 1 ? (
              <Button variant="outline" onClick={() => goToPage(1)}>
                Back to the first page
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Phones */}
          <div className="md:hidden">
            <ListGroup>
              {quotations.map((q) => (
                <ListItem
                  key={q.id}
                  href={`/admin/requests/${q.serviceRequestId}`}
                  title={q.assignedGarageName || 'Garage not set'}
                  subtitle={
                    <>
                      <span className="font-mono">{q.quotationNumber}</span> · {q.requestNumber}
                    </>
                  }
                  meta={`Version ${q.versionNumber} · valid until ${formatDate(q.validUntilUtc)}`}
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums text-navy-900">{formatINRWhole(q.customerTotal)}</span>
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
                  <TableHead>Quotation</TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead>Garage</TableHead>
                  <TableHead className="hidden lg:table-cell">Version</TableHead>
                  <TableHead className="text-right">Customer total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valid until</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Open request</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotations.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs font-semibold text-navy-900">{q.quotationNumber}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-navy-600">{q.requestNumber}</TableCell>
                    <TableCell className="font-medium text-navy-900">{q.assignedGarageName || '—'}</TableCell>
                    <TableCell className="hidden lg:table-cell">v{q.versionNumber}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums text-navy-900">
                      {formatINR(q.customerTotal, q.currency)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={q.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-navy-500">{formatDate(q.validUntilUtc)}</TableCell>
                    <TableCell className="hidden whitespace-nowrap text-navy-500 lg:table-cell">{formatDate(q.createdAtUtc)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/requests/${q.serviceRequestId}`} className={rowLink}>
                        Open
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Pagination */}
      {!error && !loading && (page > 1 || hasMore) && (
        <div className="flex items-center gap-3 md:justify-end">
          <Button
            variant="outline"
            className="flex-1 md:flex-none"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
            leftIcon={<ChevronLeft className="h-4 w-4" />}
          >
            Previous
          </Button>
          <span className="shrink-0 text-sm tabular-nums text-navy-500">Page {page}</span>
          <Button
            variant="outline"
            className="flex-1 md:flex-none"
            disabled={!hasMore}
            onClick={() => goToPage(page + 1)}
            rightIcon={<ChevronRight className="h-4 w-4" />}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
