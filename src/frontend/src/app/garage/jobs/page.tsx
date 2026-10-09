'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { ServiceJobSummaryDto } from '@/types/serviceJob';
import { PagedResult } from '@/types/serviceRequest';
import { CarFront, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Wrench, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterChips } from '@/components/ui/FilterChips';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { formatDate, formatDateTime } from '@/lib/format';

const FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'BookingConfirmed', label: 'To schedule' },
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'VehicleReceived', label: 'Car received' },
  { value: 'Inspection', label: 'Inspection' },
  { value: 'WorkInProgress', label: 'In progress' },
  { value: 'VehicleReady', label: 'Ready for pickup' },
  { value: 'HandedOver', label: 'Handed over' },
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

export default function GarageJobsPage() {
  const [jobs, setJobs] = useState<ServiceJobSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadJobs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function loadJobs(p = 1) {
    setLoading(true);
    setError(null);
    const query = statusFilter !== 'ALL' ? `&status=${statusFilter}` : '';
    const res = await apiFetch<PagedResult<ServiceJobSummaryDto> | ServiceJobSummaryDto[]>(
      `/garage/jobs?page=${p}&pageSize=15${query}`
    );
    if (res.success && res.data) {
      // The API currently returns a plain array (no paging); accept both shapes.
      if (Array.isArray(res.data)) {
        setJobs(res.data);
        setPage(1);
        setTotalPages(1);
      } else {
        setJobs(res.data.items ?? []);
        setPage(res.data.page ?? 1);
        setTotalPages(res.data.totalPages ?? 1);
      }
    } else {
      setError(res.message || 'Could not load jobs.');
    }
    setLoading(false);
  }

  const activeLabel = FILTERS.find((f) => f.value === statusFilter)?.label.toLowerCase();

  return (
    <div>
      <PageHeader title="Service jobs" description="Booked jobs from first booking to handover. Tap a job to move it to the next step." />

      <div className="space-y-4">
        <FilterChips options={FILTERS} value={statusFilter} onChange={setStatusFilter} ariaLabel="Filter jobs by stage" />

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[72px] w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState title="Couldn’t load jobs" error={error} onRetry={() => loadJobs(page)} />
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title={statusFilter === 'ALL' ? 'No jobs yet' : `No jobs in “${activeLabel}”`}
            description={
              statusFilter === 'ALL'
                ? 'When a customer accepts one of your quotes, the job appears here.'
                : 'Try another filter.'
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
                  trailing={<StatusBadge status={job.status} />}
                />
              ))}
            </ListGroup>

            {totalPages > 1 && (
              <nav className="flex items-center justify-between gap-2" aria-label="Pages">
                <Button
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => loadJobs(page - 1)}
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
                  onClick={() => loadJobs(page + 1)}
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
