'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { CustomerServiceRequestSummaryDto, PagedResult } from '@/types/serviceRequest';
import { Car, ChevronLeft, ChevronRight, ClipboardList, Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatINRWhole, formatRelative } from '@/lib/format';
import { RequestStatusBadge, isRequestFinished } from '@/app/customer/_lib/customer-ui';

/** Package fields on GET /customer/requests rows. */
type RequestRow = CustomerServiceRequestSummaryDto & {
  servicePackageName?: string | null;
  packagePrice?: number | null;
  isAdvancePaid?: boolean;
  /** The selected services, joined: "AC Service & Repair, Batteries". */
  serviceCategory?: string | null;
};

export default function CustomerRequestsPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadRequests = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    const res = await apiFetch<PagedResult<RequestRow>>(
      `/customer/requests?page=${p}&pageSize=10`
    );
    if (res.success && res.data) {
      setRequests(res.data.items);
      setPage(res.data.page);
      setTotalPages(res.data.totalPages);
    } else {
      setError(res.message || 'Unable to load your service requests.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <PageHeader
        title="My requests"
        description="Every service you have booked, newest first."
        actions={
          <Link href="/customer/requests/new">
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} className="w-full">
              Book a service
            </Button>
          </Link>
        }
      />

      {loading && requests.length === 0 ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading requests">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[76px]" />
          ))}
        </div>
      ) : error && requests.length === 0 ? (
        <ErrorState title="Could not load your requests" error={error} onRetry={() => loadRequests(page)} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No service requests yet"
          description="Book a fixed-price service package, or tell us what your car needs and nearby garages will quote."
          action={
            <Link href="/customer/requests/new">
              <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
                Book a service
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          <ListGroup className={loading ? 'opacity-60 transition-opacity' : ''}>
            {requests.map((r) => {
              const finished = isRequestFinished(r.status);
              const isPackage = !!r.servicePackageName;
              const services = !isPackage && r.serviceCategory && r.serviceCategory !== 'General' ? r.serviceCategory : null;
              const meta = [
                r.requestNumber,
                formatRelative(r.submittedAtUtc || r.createdAtUtc),
                !isPackage && r.quotesCount > 0 ? `${r.quotesCount} quote${r.quotesCount === 1 ? '' : 's'}` : null,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <ListItem
                  key={r.id}
                  href={`/customer/requests/${r.id}`}
                  leading={<IconTile icon={Car} tone={finished ? 'neutral' : 'blue'} />}
                  title={r.vehicleSummary || r.licensePlate || 'Service request'}
                  subtitle={
                    isPackage
                      ? [r.servicePackageName, typeof r.packagePrice === 'number' ? formatINRWhole(r.packagePrice) : null]
                          .filter(Boolean)
                          .join(' · ')
                      : services ?? r.problemDescription
                  }
                  meta={meta}
                  // The package and price, or every selected service, are the point of the row, so let them wrap
                  wrap={isPackage || !!services}
                  trailing={<RequestStatusBadge status={r.status} isPackage={isPackage} advancePaid={!!r.isAdvancePaid} />}
                />
              );
            })}
          </ListGroup>

          {totalPages > 1 && (
            <nav aria-label="Pages" className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => loadRequests(page - 1)}
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
                onClick={() => loadRequests(page + 1)}
                rightIcon={<ChevronRight className="h-4 w-4" />}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
