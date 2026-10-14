'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { AdminGarageList, AdminJobListItem, PagedResult } from '@/types/adminOperations';
import { ChevronLeft, ChevronRight, RefreshCw, Wrench } from 'lucide-react';
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
import { formatDate } from '@/lib/format';
import { dateRangeQuery, toQueryString, useUrlFilters } from '@/lib/useUrlFilters';
import { SERVICE_TYPE_OPTIONS } from '@/lib/filterOptions';

// Values are ServiceJobStatus names (the API filters on them); labels are what operators read.
const STATUS_OPTIONS = [
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'VehicleReceived', label: 'Car received' },
  { value: 'Inspection', label: 'Inspection' },
  { value: 'WorkStarted', label: 'Work started' },
  { value: 'WorkInProgress', label: 'Work in progress' },
  { value: 'WorkCompleted', label: 'Work completed' },
  { value: 'VehicleReady', label: 'Ready for pickup' },
  { value: 'HandedOver', label: 'Handed over' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Cancelled', label: 'Cancelled' },
];

const FILTER_DEFAULTS = { q: '', status: '', garage: '', type: '', range: '', from: '', to: '', size: '25' };

const rowLink =
  'inline-flex min-h-[36px] items-center rounded-xl border border-surface-300 bg-white px-3 text-xs font-semibold text-navy-800 transition hover:bg-surface-50';

function jobProgress(job: AdminJobListItem): string {
  if (job.workCompletedAtUtc) return `Work completed ${formatDate(job.workCompletedAtUtc)}`;
  if (job.vehicleReceivedAtUtc) return `Car received ${formatDate(job.vehicleReceivedAtUtc)}`;
  if (job.scheduledStartAtUtc) return `Scheduled for ${formatDate(job.scheduledStartAtUtc)}`;
  return 'Not scheduled yet';
}

export default function AdminJobsPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading service jobs..." />}>
      <AdminJobs />
    </Suspense>
  );
}

function AdminJobs() {
  const filters = useUrlFilters(FILTER_DEFAULTS);
  const { values: f, page: urlPage } = filters;

  const [jobs, setJobs] = useState<AdminJobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [garageOptions, setGarageOptions] = useState<{ value: string; label: string }[]>([]);
  const pageSize = [25, 50, 100].includes(Number(f.size)) ? Number(f.size) : 25;
  const latest = useRef(0);

  useEffect(() => {
    let alive = true;
    apiFetch<PagedResult<AdminGarageList>>('/admin/garages?pageSize=100').then((res) => {
      if (!alive || !res.success || !res.data) return;
      setGarageOptions(
        res.data.items.map((g) => ({ value: g.id, label: g.name })).sort((a, b) => a.label.localeCompare(b.label))
      );
    });
    return () => {
      alive = false;
    };
  }, []);

  const query = useMemo(
    () =>
      toQueryString({
        page: urlPage,
        pageSize,
        search: f.q,
        status: f.status,
        garageId: f.garage,
        serviceType: f.type,
        ...dateRangeQuery(f),
      }),
    [urlPage, pageSize, f]
  );

  const loadJobs = useCallback(async (qs: string) => {
    const id = ++latest.current;
    setLoading(true);
    const res = await apiFetch<PagedResult<AdminJobListItem>>(`/admin/jobs${qs}`);
    if (id !== latest.current) return; // a newer filter change is already loading
    if (res.success && res.data) {
      setJobs(res.data.items);
      setPage(res.data.page ?? res.data.pageNumber ?? 1);
      setTotalPages(res.data.totalPages);
      setTotalCount(res.data.totalCount);
      setError(null);
    } else {
      setError(res.message || 'Could not load service jobs.');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadJobs(query);
  }, [loadJobs, query]);

  const goToPage = (p: number) => {
    filters.setPage(p);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const refresh = () => {
    setRefreshing(true);
    loadJobs(query);
  };

  const safeTotalPages = Math.max(1, totalPages);
  const anyFilter = Object.keys(FILTER_DEFAULTS).some((k) => k !== 'size' && filters.isActive(k as keyof typeof FILTER_DEFAULTS));

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Service jobs"
        description="Work booked with garages, from scheduling to handover."
        actions={
          <Button variant="outline" onClick={refresh} isLoading={refreshing} leftIcon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
        }
      />

      <FilterBar
        filters={filters}
        searchKey="q"
        searchPlaceholder="Job, garage, customer, phone or plate"
        searchLabel="Search jobs"
        fields={[
          { type: 'select', key: 'status', label: 'Status', allLabel: 'All statuses', options: STATUS_OPTIONS },
          { type: 'select', key: 'garage', label: 'Garage', allLabel: 'All garages', options: garageOptions },
          { type: 'select', key: 'type', label: 'Service type', allLabel: 'Packages and repairs', options: SERVICE_TYPE_OPTIONS },
          { type: 'dateRange', label: 'Created' },
        ]}
        summary={loading ? 'Loading…' : `${totalCount} ${totalCount === 1 ? 'job' : 'jobs'}`}
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
        <LoadingState message="Loading service jobs..." />
      ) : error ? (
        <ErrorState title="Could not load service jobs" error={error} onRetry={refresh} />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No service jobs found"
          description={
            anyFilter ? 'No jobs match these filters.' : 'Jobs appear here once a customer confirms a booking.'
          }
        />
      ) : (
        <>
          {/* Phones */}
          <div className="md:hidden">
            <ListGroup>
              {jobs.map((j) => (
                <ListItem
                  key={j.id}
                  href={`/admin/requests/${j.serviceRequestId}`}
                  title={j.vehicleSummary || j.jobNumber}
                  subtitle={`${j.garageName} · ${j.customerName}`}
                  meta={
                    <>
                      <span className="font-mono">{j.jobNumber}</span> · {jobProgress(j)}
                    </>
                  }
                  trailing={<StatusBadge status={j.status} />}
                />
              ))}
            </ListGroup>
          </div>

          {/* Tablets and laptops */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Garage</TableHead>
                  <TableHead>Customer and vehicle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Scheduled</TableHead>
                  <TableHead className="hidden lg:table-cell">Car received</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Open request</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="font-mono text-xs font-semibold text-navy-900">{j.jobNumber}</div>
                      <div className="font-mono text-xs text-navy-500">{j.requestNumber}</div>
                    </TableCell>
                    <TableCell className="font-medium text-navy-900">{j.garageName}</TableCell>
                    <TableCell>
                      <div className="font-medium text-navy-900">{j.customerName}</div>
                      <div className="text-xs text-navy-500">{j.vehicleSummary}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={j.status} />
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-navy-500 lg:table-cell">
                      {formatDate(j.scheduledStartAtUtc)}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-navy-500 lg:table-cell">
                      {j.vehicleReceivedAtUtc ? formatDate(j.vehicleReceivedAtUtc) : 'Not yet'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/requests/${j.serviceRequestId}`} className={rowLink}>
                        Open request
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
