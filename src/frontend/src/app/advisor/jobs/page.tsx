'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { ServiceJobSummaryDto } from '@/types/serviceJob';
import { PagedResult } from '@/types/serviceRequest';
import { ChevronLeft, ChevronRight, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterChips } from '@/components/ui/FilterChips';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';

const tabs = [
  { value: 'ALL', label: 'All' },
  { value: 'BookingConfirmed', label: 'Booked' },
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'VehicleReceived', label: 'Car received' },
  { value: 'Inspection', label: 'Inspection' },
  { value: 'WorkInProgress', label: 'In progress' },
  { value: 'VehicleReady', label: 'Ready for pickup' },
  { value: 'HandedOver', label: 'Handed over' },
  { value: 'Closed', label: 'Closed' },
];

export default function AdvisorJobsPage() {
  const [jobs, setJobs] = useState<ServiceJobSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadJobs = useCallback(
    async (p = 1) => {
      setLoading(true);
      const query = statusFilter !== 'ALL' ? `&status=${statusFilter}` : '';
      const res = await apiFetch<PagedResult<ServiceJobSummaryDto> | ServiceJobSummaryDto[]>(
        `/advisor/jobs?page=${p}&pageSize=15${query}`
      );
      if (res.success && res.data) {
        // The API currently returns a plain array; accept a paged result too.
        if (Array.isArray(res.data)) {
          setJobs(res.data);
          setPage(1);
          setTotalPages(1);
        } else {
          setJobs(res.data.items ?? []);
          setPage(res.data.page ?? p);
          setTotalPages(res.data.totalPages ?? 1);
        }
        setError(null);
      } else {
        setError(res.message || 'Could not load service jobs.');
      }
      setLoading(false);
    },
    [statusFilter]
  );

  useEffect(() => {
    loadJobs(1);
  }, [loadJobs]);

  const activeLabel = tabs.find((t) => t.value === statusFilter)?.label;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Service jobs"
        description="Follow work at the garages, read inspection reports and approve extra work."
      />

      <FilterChips ariaLabel="Job status" options={tabs} value={statusFilter} onChange={setStatusFilter} />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-2xl" />
          ))}
        </div>
      ) : error && jobs.length === 0 ? (
        <ErrorState title="Could not load service jobs" error={error} onRetry={() => loadJobs(page)} />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No service jobs"
          description={statusFilter === 'ALL' ? 'Jobs appear here once a customer accepts a quotation.' : `No jobs are "${activeLabel}" right now.`}
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
                disabled={page >= totalPages || loading}
                onClick={() => loadJobs(page + 1)}
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
