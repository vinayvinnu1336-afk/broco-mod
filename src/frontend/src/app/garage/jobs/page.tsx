'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { ServiceJobSummaryDto } from '@/types/serviceJob';
import { PagedResult } from '@/types/serviceRequest';
import { CarFront, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Wrench, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { LoadingState } from '@/components/ui/LoadingState';
import { dateRangeQuery, toQueryString, useUrlFilters } from '@/lib/useUrlFilters';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatDate, formatDateTime } from '@/lib/format';

/** Booking fields the API adds to job summaries (not yet in the shared type). */
type JobSummary = ServiceJobSummaryDto & { servicePackageName?: string | null; isAdvancePaid?: boolean };

/** Until the car is received the garage waits for the customer's 10% BroCo advance. */
const AWAITING_ADVANCE_STATUSES = ['BookingConfirmed', 'Scheduled'];

// Values are ServiceJobStatus names.
const FILTERS = [
  { value: '', label: 'All' },
  { value: 'BookingConfirmed', label: 'To schedule' },
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'VehicleReceived', label: 'Car received' },
  { value: 'Inspection', label: 'Inspection' },
  { value: 'WorkInProgress', label: 'In progress' },
  { value: 'VehicleReady', label: 'Ready for handover' },
  { value: 'HandedOver', label: 'Handed over' },
  { value: 'PaymentReceived', label: 'Payment received' },
  { value: 'Closed', label: 'Closed' },
];

function jobTile(status: string) {
  switch (status) {
    case 'BookingConfirmed':
    case 'Scheduled':
      return <IconTile icon={CarFront} tone="neutral" />;
    case 'VehicleReceived':
    case 'Inspection':
      return <IconTile icon={ClipboardList} tone="amber" />;
    case 'WorkStarted':
    case 'WorkInProgress':
      return <IconTile icon={Wrench} tone="blue" />;
    case 'WorkCompleted':
    case 'VehicleReady':
    case 'HandedOver':
    case 'PaymentReceived':
      return <IconTile icon={CheckCircle2} tone="green" />;
    case 'Cancelled':
      return <IconTile icon={XCircle} tone="red" />;
    default:
      return <IconTile icon={Wrench} tone="neutral" />;
  }
}

function jobMeta(job: ServiceJobSummaryDto) {
  if (job.actualWorkCompletedAtUtc) return `Work done ${formatDate(job.actualWorkCompletedAtUtc)}`;
  if (job.estimatedCompletionAtUtc) {
    return `${job.scheduledStartAtUtc ? `Starts ${formatDateTime(job.scheduledStartAtUtc)} · ` : ''}Ready by ${formatDateTime(
      job.estimatedCompletionAtUtc
    )}`;
  }
  if (job.scheduledStartAtUtc) return `Starts ${formatDateTime(job.scheduledStartAtUtc)}`;
  return `Booked ${formatDate(job.createdAtUtc)} · not scheduled yet`;
}

const FILTER_DEFAULTS = { q: '', status: '', range: '', from: '', to: '' };

/** The API returns the latest this many matching jobs. */
const JOB_LIMIT = 200;

export default function GarageJobsPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading jobs..." />}>
      <GarageJobs />
    </Suspense>
  );
}

function GarageJobs() {
  const filters = useUrlFilters(FILTER_DEFAULTS);
  const { values: f, page: urlPage } = filters;
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isPaged, setIsPaged] = useState(false);
  const latest = useRef(0);

  const query = useMemo(
    () =>
      toQueryString({
        page: urlPage > 1 ? urlPage : undefined,
        search: f.q,
        status: f.status,
        ...dateRangeQuery(f),
      }),
    [urlPage, f]
  );

  useEffect(() => {
    loadJobs(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function loadJobs(qs: string) {
    const id = ++latest.current;
    setLoading(true);
    setError(null);
    const res = await apiFetch<PagedResult<JobSummary> | JobSummary[]>(`/garage/jobs${qs}`);
    if (id !== latest.current) return; // a newer filter change is already loading
    if (res.success && res.data) {
      // The API returns a plain array (the latest matching jobs); accept a paged result too.
      if (Array.isArray(res.data)) {
        setJobs(res.data);
        setPage(1);
        setTotalPages(1);
      } else {
        setJobs(res.data.items ?? []);
        setPage(res.data.page ?? 1);
        setTotalPages(res.data.totalPages ?? 1);
      }
      setIsPaged(!Array.isArray(res.data));
    } else {
      setError(res.message || 'Could not load jobs.');
    }
    setLoading(false);
  }

  const anyFilter = (Object.keys(FILTER_DEFAULTS) as (keyof typeof FILTER_DEFAULTS)[]).some((k) => filters.isActive(k));
  const summary = loading
    ? 'Loading…'
    : error
    ? null
    : !isPaged && jobs.length >= JOB_LIMIT
    ? `Latest ${JOB_LIMIT} jobs`
    : `${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'}`;

  return (
    <div>
      <PageHeader title="Service jobs" description="Booked jobs from first booking to handover. Tap a job to move it to the next step." />

      <div className="space-y-4">
        <FilterBar
          filters={filters}
          searchKey="q"
          searchPlaceholder="Job no., car or plate"
          searchLabel="Search jobs"
          status={{ key: 'status', options: FILTERS, ariaLabel: 'Filter jobs by stage' }}
          fields={[{ type: 'dateRange', label: 'Booked' }]}
          summary={summary}
        />

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[72px] w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState title="Couldn’t load jobs" error={error} onRetry={() => loadJobs(query)} />
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title={anyFilter ? 'No jobs found' : 'No jobs yet'}
            description={
              anyFilter ? 'No jobs match these filters.' : 'When a customer accepts one of your quotes, the job appears here.'
            }
          />
        ) : (
          <>
            <ListGroup>
              {jobs.map((job) => (
                <ListItem
                  key={job.id}
                  href={`/garage/jobs/${job.id}`}
                  leading={jobTile(String(job.status))}
                  title={job.vehicleSummary || job.jobNumber}
                  subtitle={[job.vehicleLicensePlate, job.vehicleSummary ? job.jobNumber : null, `Request ${job.requestNumber || '—'}`]
                    .filter(Boolean)
                    .join(' · ')}
                  meta={jobMeta(job)}
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={job.status} />
                      {job.servicePackageName && (
                        <Badge variant="blue" pill className="whitespace-nowrap">
                          Package
                        </Badge>
                      )}
                      {job.isAdvancePaid === false && AWAITING_ADVANCE_STATUSES.includes(String(job.status)) && (
                        <Badge variant="amber" pill className="whitespace-nowrap">
                          Awaiting advance
                        </Badge>
                      )}
                    </div>
                  }
                />
              ))}
            </ListGroup>

            {totalPages > 1 && (
              <nav className="flex items-center justify-between gap-2" aria-label="Pages">
                <Button
                  variant="outline"
                  disabled={page <= 1}
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
                  disabled={page >= totalPages}
                  onClick={() => filters.setPage(page + 1)}
                  rightIcon={<ChevronRight className="h-4 w-4" />}
                >
                  Next
                </Button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
