'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { formatDate, formatINRWhole } from '@/lib/format';
import { CheckSquare } from 'lucide-react';
import { StatusBadge, statusLabel } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { LoadingState } from '@/components/ui/LoadingState';
import { FilterBar } from '@/components/ui/FilterBar';
import { inDateRange, matchesSearch, useUrlFilters } from '@/lib/useUrlFilters';

interface AdvisorAssignment {
  serviceRequestId: string;
  garageId: string;
  garageName: string;
  customerFacingPrice: number;
  status: string;
  assignedAtUtc: string;
}

// The API currently fills this placeholder instead of the garage's real name; do not show it as a name.
const PLACEHOLDER_GARAGE_NAME = 'Assigned Partner';

const FILTER_DEFAULTS = { q: '', status: '', range: '', from: '', to: '' };

function garageLabel(a: AdvisorAssignment) {
  return a.garageName && a.garageName !== PLACEHOLDER_GARAGE_NAME ? a.garageName : 'Garage assigned';
}

/** Short request reference shown on each row (the API sends only the request id). */
function requestRef(a: AdvisorAssignment) {
  return a.serviceRequestId.slice(0, 8).toUpperCase();
}

export default function AdvisorAssignmentsPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading assignments..." />}>
      <AdvisorAssignments />
    </Suspense>
  );
}

function AdvisorAssignments() {
  const filters = useUrlFilters(FILTER_DEFAULTS);
  const { values: f } = filters;
  const [assignments, setAssignments] = useState<AdvisorAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<AdvisorAssignment[]>('/advisor/assignments');
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

  // Fully loaded list: filter here. Chip counts follow the search and date.
  const matching = useMemo(
    () =>
      assignments.filter(
        (a) => inDateRange(a.assignedAtUtc, f) && matchesSearch(f.q, garageLabel(a), requestRef(a), a.serviceRequestId)
      ),
    [assignments, f]
  );

  const chipOptions = useMemo(() => {
    const counts = new Map<string, number>();
    assignments.forEach((a) => counts.set(a.status, 0));
    if (f.status) counts.set(f.status, 0);
    matching.forEach((a) => counts.set(a.status, (counts.get(a.status) ?? 0) + 1));
    return [
      { value: '', label: 'All', count: matching.length },
      ...Array.from(counts.entries()).map(([status, count]) => ({ value: status, label: statusLabel(status), count })),
    ];
  }, [assignments, matching, f.status]);

  const visible = f.status ? matching.filter((a) => a.status === f.status) : matching;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Assignments"
        description="Requests where a garage has been chosen, with the price quoted to the customer."
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-2xl" />
          ))}
        </div>
      ) : error && assignments.length === 0 ? (
        <ErrorState title="Could not load assignments" error={error} onRetry={loadAssignments} />
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No assignments yet"
          description="Once you assign a garage and prepare a customer quotation, it shows up here."
        />
      ) : (
        <>
        <FilterBar
          filters={filters}
          searchKey="q"
          searchPlaceholder="Garage or request"
          searchLabel="Search assignments"
          status={chipOptions.length > 2 || f.status ? { key: 'status', options: chipOptions, ariaLabel: 'Assignment status' } : undefined}
          fields={[{ type: 'dateRange', label: 'Assigned' }]}
          summary={`${visible.length} ${visible.length === 1 ? 'assignment' : 'assignments'}`}
        />
        {visible.length === 0 ? (
          <EmptyState icon={CheckSquare} title="No assignments found" description="No assignments match these filters." />
        ) : (
        <ListGroup>
          {visible.map((a, idx) => {
            const garage = garageLabel(a);
            return (
              <ListItem
                key={`${a.serviceRequestId}-${a.assignedAtUtc}-${idx}`}
                href={`/advisor/requests/${a.serviceRequestId}`}
                leading={<IconTile icon={CheckSquare} tone="green" />}
                title={garage}
                subtitle={`Request ${requestRef(a)}`}
                meta={formatDate(a.assignedAtUtc)}
                trailing={
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums text-navy-900">
                      {formatINRWhole(a.customerFacingPrice)}
                    </span>
                    <StatusBadge status={a.status} />
                  </div>
                }
              />
            );
          })}
        </ListGroup>
        )}
        </>
      )}
    </div>
  );
}
