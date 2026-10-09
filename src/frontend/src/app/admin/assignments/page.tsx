'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { GarageAssignmentDto } from '@/types/customerQuotation';
import { Building2, Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterChips } from '@/components/ui/FilterChips';
import { ListGroup, ListItem } from '@/components/ui/ListItem';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { formatDate, formatINR, formatINRWhole } from '@/lib/format';

// Client-side filter on the assignment status.
const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'Assigned', label: 'Assigned' },
  { value: 'Confirmed', label: 'Confirmed' },
  { value: 'Reassigned', label: 'Reassigned' },
  { value: 'Cancelled', label: 'Cancelled' },
];

const rowLink =
  'inline-flex min-h-[36px] items-center rounded-xl border border-surface-300 bg-white px-3 text-xs font-semibold text-navy-800 transition hover:bg-surface-50';

export default function AdminAssignmentsPage() {
  const [assignments, setAssignments] = useState<GarageAssignmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<GarageAssignmentDto[]>('/admin/assignments');
    if (res.success && res.data) {
      setAssignments(res.data);
      setError(null);
    } else {
      setError(res.message || 'Could not load assignments.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    assignments.forEach((a) => {
      map[a.status] = (map[a.status] ?? 0) + 1;
    });
    return map;
  }, [assignments]);

  const filtered = assignments.filter((a) => {
    if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
    const term = search.toLowerCase();
    return (
      a.requestNumber.toLowerCase().includes(term) ||
      a.garageName.toLowerCase().includes(term) ||
      a.quoteNumber.toLowerCase().includes(term) ||
      (a.assignedByAdvisorName ?? '').toLowerCase().includes(term)
    );
  });

  const statusOptions = STATUS_OPTIONS.map((o) => ({
    ...o,
    count: o.value === 'ALL' ? assignments.length : counts[o.value] ?? 0,
  }));

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Assignments"
        description="Which garage each request went to, the quote it was based on and the advisor who chose it."
      />

      {/* Search and filters */}
      <div className="space-y-3">
        <div className="sm:max-w-md">
          <Input
            type="search"
            aria-label="Search assignments"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Request, garage, quote or advisor"
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        {assignments.length > 0 && (
          <FilterChips options={statusOptions} value={statusFilter} onChange={setStatusFilter} ariaLabel="Filter by status" />
        )}
      </div>

      {loading ? (
        <LoadingState message="Loading assignments..." />
      ) : error ? (
        <ErrorState title="Could not load assignments" error={error} onRetry={loadAssignments} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No assignments found"
          description={
            search || statusFilter !== 'ALL'
              ? 'No assignments match this search or filter.'
              : 'Assignments appear here once an advisor picks a garage for a request.'
          }
        />
      ) : (
        <>
          <p className="text-xs text-navy-500">
            {filtered.length} {filtered.length === 1 ? 'assignment' : 'assignments'}
          </p>

          {/* Phones */}
          <div className="md:hidden">
            <ListGroup>
              {filtered.map((a) => (
                <ListItem
                  key={a.id}
                  href={`/admin/requests/${a.serviceRequestId}`}
                  title={a.garageName}
                  subtitle={
                    <>
                      <span className="font-mono">{a.requestNumber}</span> · quote {a.quoteNumber}
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
                      <span className="text-sm font-semibold tabular-nums text-navy-900">{formatINRWhole(a.quotedAmount)}</span>
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
                {filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs font-semibold text-navy-900">{a.requestNumber}</TableCell>
                    <TableCell className="font-medium text-navy-900">{a.garageName}</TableCell>
                    <TableCell className="hidden whitespace-nowrap font-mono text-xs text-navy-600 lg:table-cell">{a.quoteNumber}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums text-navy-900">
                      {formatINR(a.quotedAmount)}
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
    </div>
  );
}
