'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { GarageAssignmentDto } from '@/types/customerQuotation';
import { Building2, ChevronLeft, ChevronRight } from 'lucide-react';
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

// Values are GarageAssignmentStatus names (the API filters on them).
const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'Assigned', label: 'Assigned' },
  { value: 'Confirmed', label: 'Confirmed' },
  { value: 'Reassigned', label: 'Reassigned' },
  { value: 'Cancelled', label: 'Cancelled' },
];

const FILTER_DEFAULTS = { q: '', status: '', range: '', from: '', to: '' };

// The endpoint returns a plain list (no total), so paging is Previous / Next.
const PAGE_SIZE = 50;

const rowLink =
  'inline-flex min-h-[36px] items-center rounded-xl border border-surface-300 bg-white px-3 text-xs font-semibold text-navy-800 transition hover:bg-surface-50';

export default function AdminAssignmentsPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading assignments..." />}>
      <AdminAssignments />
    </Suspense>
  );
}

function AdminAssignments() {
  const filters = useUrlFilters(FILTER_DEFAULTS);
  const { values: f, page } = filters;
  const [assignments, setAssignments] = useState<GarageAssignmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const query = useMemo(
    () => toQueryString({ page, pageSize: PAGE_SIZE, search: f.q, status: f.status, ...dateRangeQuery(f) }),
    [page, f]
  );

  const loadAssignments = useCallback(async (qs: string) => {
    const id = ++latest.current;
    setLoading(true);
    const res = await apiFetch<GarageAssignmentDto[]>(`/admin/assignments${qs}`);
    if (id !== latest.current) return; // a newer filter change is already loading
    if (res.success && res.data) {
      setAssignments(res.data);
      setError(null);
    } else {
      setError(res.message || 'Could not load assignments.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAssignments(query);
  }, [loadAssignments, query]);

  const goToPage = (p: number) => {
    filters.setPage(p);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasMore = assignments.length === PAGE_SIZE;
  const anyFilter = (Object.keys(FILTER_DEFAULTS) as (keyof typeof FILTER_DEFAULTS)[]).some((k) => filters.isActive(k));
  const firstRow = (page - 1) * PAGE_SIZE + 1;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Assignments"
        description="Which garage each request went to, the quote it was based on and the advisor who chose it."
      />

      <FilterBar
        filters={filters}
        searchKey="q"
        searchPlaceholder="Request or quote number, or garage"
        searchLabel="Search assignments"
        status={{ key: 'status', options: STATUS_OPTIONS }}
        fields={[{ type: 'dateRange', label: 'Assigned' }]}
        summary={
          loading
            ? 'Loading…'
            : assignments.length === 0
            ? null
            : page > 1 || hasMore
            ? `Showing ${firstRow}–${firstRow + assignments.length - 1}`
            : `${assignments.length} ${assignments.length === 1 ? 'assignment' : 'assignments'}`
        }
      />

      {loading ? (
        <LoadingState message="Loading assignments..." />
      ) : error ? (
        <ErrorState title="Could not load assignments" error={error} onRetry={() => loadAssignments(query)} />
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No assignments found"
          description={
            page > 1
              ? 'There are no more assignments on this page.'
              : anyFilter
              ? 'No assignments match these filters.'
              : 'Assignments appear here once an advisor picks a garage for a request.'
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
              {assignments.map((a) => (
                <ListItem
                  key={a.id}
                  href={`/admin/requests/${a.serviceRequestId}`}
                  title={a.garageName}
                  subtitle={
                    <>
                      <span className="font-mono">{a.requestNumber}</span> · quote {a.selectedQuoteNumber}
                    </>
                  }
                  meta={
                    <>
                      {a.assignedByAdvisorName || 'Advisor not recorded'} · {formatDate(a.assignedAtUtc)}
                      {a.cancellationReason && (
                        <span className="mt-0.5 block whitespace-normal break-words">Cancelled: {a.cancellationReason}</span>
                      )}
                    </>
                  }
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums text-navy-900">{formatINRWhole(a.selectedQuoteAmount)}</span>
                      <StatusBadge status={a.status} />
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
                  <TableHead>Request</TableHead>
                  <TableHead>Garage</TableHead>
                  <TableHead className="hidden lg:table-cell">Quote</TableHead>
                  <TableHead className="text-right">Quoted</TableHead>
                  <TableHead>Advisor</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Open request</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs font-semibold text-navy-900">{a.requestNumber}</TableCell>
                    <TableCell className="font-medium text-navy-900">{a.garageName}</TableCell>
                    <TableCell className="hidden whitespace-nowrap font-mono text-xs text-navy-600 lg:table-cell">{a.selectedQuoteNumber}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums text-navy-900">
                      {formatINR(a.selectedQuoteAmount)}
                    </TableCell>
                    <TableCell className="text-navy-700">{a.assignedByAdvisorName || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap text-navy-500">{formatDate(a.assignedAtUtc)}</TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/requests/${a.serviceRequestId}`} className={rowLink}>
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
