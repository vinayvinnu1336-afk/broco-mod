'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { formatDate, formatINRWhole } from '@/lib/format';
import { CheckSquare } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';

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

export default function AdvisorAssignmentsPage() {
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
        <ListGroup>
          {assignments.map((a, idx) => {
            const garage = a.garageName && a.garageName !== PLACEHOLDER_GARAGE_NAME ? a.garageName : 'Garage assigned';
            return (
              <ListItem
                key={`${a.serviceRequestId}-${a.assignedAtUtc}-${idx}`}
                href={`/advisor/requests/${a.serviceRequestId}`}
                leading={<IconTile icon={CheckSquare} tone="green" />}
                title={garage}
                subtitle={`Request ${a.serviceRequestId.slice(0, 8).toUpperCase()}`}
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
    </div>
  );
}
