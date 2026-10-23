'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { ServiceJobSummaryDto } from '@/types/serviceJob';
import { PagedResult } from '@/types/serviceRequest';
import { ChevronLeft, ChevronRight, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { LoadingState } from '@/components/ui/LoadingState';
import { dateRangeQuery, toQueryString, useUrlFilters } from '@/lib/useUrlFilters';

// Values are ServiceJobStatus names.
const STATUS_OPTIONS = [
  { value: 'BookingConfirmed', label: 'Booked' },
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'VehicleReceived', label: 'Car received' },
  { value: 'Inspection', label: 'Inspection' },
  { value: 'WorkInProgress', label: 'In progress' },
  { value: 'VehicleReady', label: 'Ready for handover' },
  { value: 'HandedOver', label: 'Handed over' },
  { value: 'PaymentReceived', label: 'Payment received' },
  { value: 'Closed', label: 'Closed' },
];

const FILTER_DEFAULTS = { q: '', status: '', garage: '', range: '', from: '', to: '' };

/** The API returns the latest this many matching jobs. */
const JOB_LIMIT = 200;

export default function AdvisorJobsPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading service jobs..." />}>
      <AdvisorJobs />
    </Suspense>
  );
}

function AdvisorJobs() {
  const filters = useUrlFilters(FILTER_DEFAULTS);
  const { values: f, page: urlPage } = filters;
  const [jobs, setJobs] = useState<ServiceJobSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isPaged, setIsPaged] = useState(false);
  // Advisors can't list garages (admin only), so the garage options are the garages seen in the jobs loaded so far.
  const [garages, setGarages] = useState<Record<string, string>>({});
  const latest = useRef(0);

  const rememberGarages = useCallback((list: ServiceJobSummaryDto[]) => {
    setGarages((prev) => {
      const missing = list.filter((j) => j.garageId && !prev[j.garageId]);
      if (missing.length === 0) return prev;
      const next = { ...prev };
      missing.forEach((j) => (next[j.garageId] = j.garageName));
      return next;
    });
  }, []);

  const query = useMemo(
    () =>
      toQueryString({
        page: urlPage > 1 ? urlPage : undefined,
        search: f.q,
        status: f.status,
        garageId: f.garage,
        ...dateRangeQuery(f),
      }),
    [urlPage, f]
  );

  const loadJobs = useCallback(
    async (qs: string) => {
      const id = ++latest.current;
      setLoading(true);
      const res = await apiFetch<PagedResult<ServiceJobSummaryDto> | ServiceJobSummaryDto[]>(`/advisor/jobs${qs}`);
      if (id !== latest.current) return; // a newer filter change is already loading
      if (res.success && res.data) {
        // The API returns a plain array (the latest matching jobs); accept a paged result too.
        const list = Array.isArray(res.data) ? res.data : res.data.items ?? [];
        setJobs(list);
        rememberGarages(list);
        setIsPaged(!Array.isArray(res.data));
        setPage(Array.isArray(res.data) ? 1 : res.data.page ?? 1);
        setTotalPages(Array.isArray(res.data) ? 1 : res.data.totalPages ?? 1);
        setError(null);
      } else {
        setJobs([]);
        setError(res.message || 'Could not load service jobs.');
      }
      setLoading(false);
    },
    [rememberGarages]
  );

  useEffect(() => {
    loadJobs(query);
  }, [loadJobs, query]);

  // Opened from a link that already has filters: load the unfiltered list once so every garage is offered.
  const firstQuery = useRef(query);
  useEffect(() => {
    if (!firstQuery.current) return;
    apiFetch<PagedResult<ServiceJobSummaryDto> | ServiceJobSummaryDto[]>('/advisor/jobs').then((res) => {
      if (res.success && res.data) rememberGarages(Array.isArray(res.data) ? res.data : res.data.items ?? []);
    });
  }, [rememberGarages]);

  const garageOptions = useMemo(() => {
    const options = Object.entries(garages).map(([value, label]) => ({ value, label }));
    if (f.garage && !garages[f.garage]) options.push({ value: f.garage, label: 'Selected garage' });
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [garages, f.garage]);

  const anyFilter = (Object.keys(FILTER_DEFAULTS) as (keyof typeof FILTER_DEFAULTS)[]).some((k) => filters.isActive(k));
  const summary = loading
    ? 'Loading…'
    : error
    ? null
    : !isPaged && jobs.length >= JOB_LIMIT
    ? `Latest ${JOB_LIMIT} jobs`
    : `${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'}`;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Service jobs"
        description="Follow work at the garages, read inspection reports and approve extra work."
      />

      <FilterBar
        filters={filters}
        searchKey="q"
        searchPlaceholder="Job, car or garage"
        searchLabel="Search service jobs"
        fields={[
          { type: 'select', key: 'status', label: 'Status', allLabel: 'All statuses', options: STATUS_OPTIONS },
          { type: 'select', key: 'garage', label: 'Garage', allLabel: 'All garages', options: garageOptions },
          { type: 'dateRange', label: 'Created' },
        ]}
        summary={summary}
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-2xl" />
          ))}
        </div>
      ) : error && jobs.length === 0 ? (
        <ErrorState title="Could not load service jobs" error={error} onRetry={() => loadJobs(query)} />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No service jobs"
          description={anyFilter ? 'No service jobs match these filters.' : 'Jobs appear here once a customer accepts a quotation.'}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Garage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Link href={`/advisor/jobs/${job.id}`} className="font-mono font-semibold text-navy-900 hover:text-electric-600">
                        {job.jobNumber}
                      </Link>
                      <div className="font-mono text-xs text-navy-500">{job.requestNumber}</div>
                    </TableCell>
                    <TableCell className="text-navy-900">{job.garageName}</TableCell>
                    <TableCell>
                      <StatusBadge status={job.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-navy-700">{formatDate(job.scheduledStartAtUtc)}</TableCell>
                    <TableCell className="whitespace-nowrap text-navy-500">{formatDate(job.createdAtUtc)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Phone list */}
          <div className="md:hidden">
            <ListGroup>
              {jobs.map((job) => (
                <ListItem
                  key={job.id}
                  href={`/advisor/jobs/${job.id}`}
                  leading={<IconTile icon={Wrench} tone="neutral" />}
                  title={job.garageName}
                  subtitle={
                    <span className="font-mono">
                      {job.jobNumber} · {job.requestNumber}
                    </span>
                  }
                  meta={job.scheduledStartAtUtc ? `Scheduled ${formatDate(job.scheduledStartAtUtc)}` : `Created ${formatDate(job.createdAtUtc)}`}
                  trailing={<StatusBadge status={job.status} />}
                />
              ))}
            </ListGroup>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => filters.setPage(page - 1)}
                leftIcon={<ChevronLeft className="h-4 w-4" />}
              >
                Previous
              </Button>
              <span className="text-sm text-navy-500">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page >= totalPages || loading}
                onClick={() => filters.setPage(page + 1)}
                rightIcon={<ChevronRight className="h-4 w-4" />}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
