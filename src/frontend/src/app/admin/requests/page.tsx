'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { AdminRequestSummary, PagedResult } from '@/types/adminOperations';
import { ChevronLeft, ChevronRight, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { ListGroup, ListItem } from '@/components/ui/ListItem';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { formatDate, formatRelative } from '@/lib/format';
import { dateRangeQuery, toQueryString, useUrlFilters } from '@/lib/useUrlFilters';
import { SERVICE_CATEGORY_OPTIONS, SERVICE_TYPE_OPTIONS, useCityOptions } from '@/lib/filterOptions';

// Values must be ServiceRequestStatus names (the API parses them with Enum.TryParse and silently
// ignores anything else); labels are what operators read.
const STATUS_OPTIONS = [
  { value: 'Submitted', label: 'Submitted' },
  { value: 'GaragesNotified', label: 'Garages notified' },
  { value: 'QuotesReceived', label: 'Quotes received' },
  { value: 'AdvisorReview', label: 'Advisor review' },
  { value: 'CustomerQuotationSent', label: 'Quote sent' },
  { value: 'CustomerAccepted', label: 'Accepted' },
  { value: 'BookingConfirmed', label: 'Booking confirmed' },
  { value: 'InProgress', label: 'In progress' },
  { value: 'Completed', label: 'Completed' },
  { value: 'CustomerRejected', label: 'Declined' },
  { value: 'Cancelled', label: 'Cancelled' },
];

const FILTER_DEFAULTS = { q: '', status: '', type: '', category: '', city: '', range: '', from: '', to: '', size: '25' };

const rowLink =
  'inline-flex min-h-[36px] items-center rounded-xl border border-surface-300 bg-white px-3 text-xs font-semibold text-navy-800 transition hover:bg-surface-50';

export default function AdminRequestsPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading service requests..." />}>
      <AdminRequests />
    </Suspense>
  );
}

function AdminRequests() {
  const filters = useUrlFilters(FILTER_DEFAULTS);
  const { values: f, page: urlPage } = filters;
  const cityOptions = useCityOptions();

  const [requests, setRequests] = useState<AdminRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = [25, 50, 100].includes(Number(f.size)) ? Number(f.size) : 25;
  const latest = useRef(0);

  const query = useMemo(
    () =>
      toQueryString({
        page: urlPage,
        pageSize,
        search: f.q,
        status: f.status,
        serviceType: f.type,
        category: f.category,
        city: f.city,
        ...dateRangeQuery(f),
      }),
    [urlPage, pageSize, f]
  );

  const loadRequests = useCallback(async (qs: string) => {
    const id = ++latest.current;
    setLoading(true);
    const res = await apiFetch<PagedResult<AdminRequestSummary>>(`/admin/requests${qs}`);
    if (id !== latest.current) return; // a newer filter change is already loading
    if (res.success && res.data) {
      setRequests(res.data.items);
      setPage(res.data.page ?? res.data.pageNumber ?? 1);
      setTotalPages(res.data.totalPages);
      setTotalCount(res.data.totalCount);
      setError(null);
    } else {
      setError(res.message || 'Could not load service requests.');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadRequests(query);
  }, [loadRequests, query]);

  const goToPage = (p: number) => {
    filters.setPage(p);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const refresh = () => {
    setRefreshing(true);
    loadRequests(query);
  };

  const safeTotalPages = Math.max(1, totalPages);
  const anyFilter = Object.keys(FILTER_DEFAULTS).some((k) => k !== 'size' && filters.isActive(k as keyof typeof FILTER_DEFAULTS));

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Service requests"
        description="Every customer request, who is handling it and how far it has got."
        actions={
          <Button variant="outline" onClick={refresh} isLoading={refreshing} leftIcon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
        }
      />

      <FilterBar
        filters={filters}
        searchKey="q"
        searchPlaceholder="Request number, customer, phone or number plate"
        searchLabel="Search requests"
        fields={[
          { type: 'select', key: 'status', label: 'Status', allLabel: 'All statuses', options: STATUS_OPTIONS },
          { type: 'select', key: 'type', label: 'Service type', allLabel: 'Packages and repairs', options: SERVICE_TYPE_OPTIONS },
          { type: 'select', key: 'category', label: 'Service', allLabel: 'All services', options: SERVICE_CATEGORY_OPTIONS },
          { type: 'select', key: 'city', label: 'City', allLabel: 'All cities', options: cityOptions },
          { type: 'dateRange', label: 'Created' },
        ]}
        summary={loading ? 'Loading…' : `${totalCount} ${totalCount === 1 ? 'request' : 'requests'}`}
        trailing={
          <label className="flex items-center gap-2">
            Per page
            <select
              value={pageSize}
              onChange={(e) => filters.set({ size: e.target.value })}
              className="min-h-[36px] rounded-lg border border-surface-200 bg-white px-2 text-sm text-navy-900 focus:border-electric-600 focus:outline-none focus:ring-2 focus:ring-electric-600/20"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        }
      />

      {loading ? (
        <LoadingState message="Loading service requests..." />
      ) : error ? (
        <ErrorState title="Could not load service requests" error={error} onRetry={refresh} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No requests found"
          description={
            anyFilter
              ? 'No service requests match these filters.'
              : 'Customer requests will appear here once they are submitted.'
          }
        />
      ) : (
        <>
          {/* Phones */}
          <div className="md:hidden">
            <ListGroup>
              {requests.map((req) => (
                <ListItem
                  key={req.id}
                  href={`/admin/requests/${req.id}`}
                  title={req.customerName}
                  subtitle={`${req.vehicleMake} ${req.vehicleModel} · ${req.vehicleLicensePlate}`}
                  meta={
                    <>
                      <span className="font-mono">{req.requestNumber}</span> · {req.quotesReceivedCount} of{' '}
                      {req.dispatchedGaragesCount} garages quoted · {formatRelative(req.createdAtUtc)}
                      {req.assignedGarageName && <span className="block truncate">Garage: {req.assignedGarageName}</span>}
                    </>
                  }
                  trailing={<StatusBadge status={req.status} />}
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
                  <TableHead>Customer</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Advisor</TableHead>
                  <TableHead>Quotes</TableHead>
                  <TableHead className="hidden lg:table-cell">Garage</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs font-semibold text-navy-900">
                      <Link href={`/admin/requests/${req.id}`} className="hover:text-electric-600">
                        {req.requestNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-navy-900">{req.customerName}</div>
                      <div className="text-xs text-navy-500">{req.customerEmail}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-navy-800">
                        {req.vehicleMake} {req.vehicleModel}
                      </div>
                      <div className="font-mono text-xs text-navy-500">{req.vehicleLicensePlate}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={req.status} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {req.assignedAdvisorName || <span className="text-navy-400">Unassigned</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="font-semibold text-navy-900">{req.quotesReceivedCount}</span>
                      <span className="text-navy-500"> of {req.dispatchedGaragesCount}</span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {req.assignedGarageName || <span className="text-navy-400">—</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-navy-500">{formatDate(req.createdAtUtc)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/requests/${req.id}`} className={rowLink}>
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
      {totalCount > 0 && !error && (
        <>
          {safeTotalPages > 1 && (
            <div className="flex items-center gap-3 md:hidden">
              <Button
                variant="outline"
                className="flex-1"
                disabled={page <= 1 || loading}
                onClick={() => goToPage(page - 1)}
                leftIcon={<ChevronLeft className="h-4 w-4" />}
              >
                Previous
              </Button>
              <span className="shrink-0 text-sm tabular-nums text-navy-500">
                {page} / {safeTotalPages}
              </span>
              <Button
                variant="outline"
                className="flex-1"
                disabled={page >= safeTotalPages || loading}
                onClick={() => goToPage(page + 1)}
                rightIcon={<ChevronRight className="h-4 w-4" />}
              >
                Next
              </Button>
            </div>
          )}
          <div className="hidden md:block">
            <Pagination
              currentPage={page}
              totalPages={safeTotalPages}
              totalItems={totalCount}
              pageSize={pageSize}
              onPageChange={goToPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
