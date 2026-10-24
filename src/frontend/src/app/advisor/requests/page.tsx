'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatDate, formatINRWhole, formatRelative } from '@/lib/format';
import {
  AdvisorServiceRequestSummaryDto,
  AdvisorServiceRequestDetailDto,
  DispatchedGarageSummaryDto,
  PagedResult,
} from '@/types/serviceRequest';
import { Info, Inbox, MapPin, Phone, Mail, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { ListGroup, ListItem } from '@/components/ui/ListItem';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { FilterBar } from '@/components/ui/FilterBar';
import { dateRangeQuery, toQueryString, useUrlFilters } from '@/lib/useUrlFilters';
import { SERVICE_CATEGORY_OPTIONS, SERVICE_TYPE_OPTIONS, useCityOptions } from '@/lib/filterOptions';

// The API names some fields differently from the shared types; read both so counts and contacts show.
type RequestSummary = AdvisorServiceRequestSummaryDto & {
  dispatchedGaragesCount?: number;
  servicePackageName?: string | null;
  packagePrice?: number | null;
  isAdvancePaid?: boolean;
};

/** "Package" and advance badges for fixed-price package bookings. */
function PackageBadges({ r }: { r: RequestSummary }) {
  if (!r.servicePackageName) return null;
  return (
    <>
      <Badge variant="blue" pill className="whitespace-nowrap" title={r.servicePackageName}>
        Package
      </Badge>
      {r.isAdvancePaid ? (
        <Badge variant="green" pill className="whitespace-nowrap">
          Advance paid
        </Badge>
      ) : (
        <Badge variant="amber" pill className="whitespace-nowrap">
          Awaiting advance
        </Badge>
      )}
    </>
  );
}
type DispatchedGarage = DispatchedGarageSummaryDto & { garagePhoneNumber?: string; sentAtUtc?: string };

/** Package fields on GET /advisor/requests/{id}. */
type RequestDetail = AdvisorServiceRequestDetailDto & {
  servicePackageCode?: string | null;
  servicePackageName?: string | null;
  packagePrice?: number | null;
  advancePaidAtUtc?: string | null;
  assignedGarageName?: string | null;
};

function garagesNotified(r: RequestSummary): number | null {
  const n = r.dispatchedGaragesCount ?? r.notifiedGaragesCount ?? r.matchedGaragesCount;
  return typeof n === 'number' ? n : null;
}

const linkButtonPrimary =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-electric-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-electric-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-600 focus-visible:ring-offset-2';

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-navy-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-navy-900 break-words">{children}</dd>
    </div>
  );
}

// Values are ServiceRequestStatus names (the API also accepts the upper-case form the rows show).
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

const FILTER_DEFAULTS = { q: '', status: '', type: '', category: '', city: '', range: '', from: '', to: '' };
const PAGE_SIZE = 10;

export default function AdvisorRequestsPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading service requests..." />}>
      <AdvisorRequests />
    </Suspense>
  );
}

function AdvisorRequests() {
  const toast = useToast();
  const filters = useUrlFilters(FILTER_DEFAULTS);
  const { values: f, page: urlPage } = filters;
  const cityOptions = useCityOptions();
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const latest = useRef(0);

  // Request details sheet
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const query = useMemo(
    () =>
      toQueryString({
        page: urlPage,
        pageSize: PAGE_SIZE,
        search: f.q,
        status: f.status,
        serviceType: f.type,
        category: f.category,
        city: f.city,
        ...dateRangeQuery(f),
      }),
    [urlPage, f]
  );

  const loadRequests = useCallback(async (qs: string) => {
    const id = ++latest.current;
    setLoading(true);
    const res = await apiFetch<PagedResult<AdvisorServiceRequestSummaryDto>>(`/advisor/requests${qs}`);
    if (id !== latest.current) return; // a newer filter change is already loading
    if (res.success && res.data) {
      setRequests(res.data.items ?? []);
      setPage(res.data.page);
      setTotalPages(res.data.totalPages);
      setTotalCount(res.data.totalCount ?? 0);
      setError(null);
    } else {
      setRequests([]);
      setError(res.message || 'Could not load service requests.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRequests(query);
  }, [loadRequests, query]);

  const goToPage = (p: number) => {
    filters.setPage(p);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const anyFilter = (Object.keys(FILTER_DEFAULTS) as (keyof typeof FILTER_DEFAULTS)[]).some((k) => filters.isActive(k));

  async function viewDetail(requestId: string) {
    setDetailOpen(true);
    setSelectedRequest(null);
    setDetailLoading(true);
    const res = await apiFetch<RequestDetail>(`/advisor/requests/${requestId}`);
    if (res.success && res.data) {
      setSelectedRequest(res.data);
    } else {
      setDetailOpen(false);
      toast.error('Could not load request details', res.message);
    }
    setDetailLoading(false);
  }

  function closeDetail() {
    setDetailOpen(false);
    setSelectedRequest(null);
  }

  const pagination = totalPages > 1 && (
    <div className="flex items-center justify-between gap-3">
      <Button
        variant="outline"
        disabled={page <= 1 || loading}
        onClick={() => goToPage(page - 1)}
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
        onClick={() => goToPage(page + 1)}
        rightIcon={<ChevronRight className="h-4 w-4" />}
      >
        Next
      </Button>
    </div>
  );

  const garages = (selectedRequest?.dispatchedGarages ?? []) as DispatchedGarage[];
  const selectedIsPackage = !!(selectedRequest?.servicePackageCode || selectedRequest?.servicePackageName);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Service requests"
        description="Requests assigned to you. Open one to compare garage quotes, or to assign a garage to a package booking."
      />

      <FilterBar
        filters={filters}
        searchKey="q"
        searchPlaceholder="Request, name or plate"
        searchLabel="Search requests"
        fields={[
          { type: 'select', key: 'status', label: 'Status', allLabel: 'All statuses', options: STATUS_OPTIONS },
          { type: 'select', key: 'type', label: 'Service type', allLabel: 'Packages and repairs', options: SERVICE_TYPE_OPTIONS },
          { type: 'select', key: 'category', label: 'Service', allLabel: 'All services', options: SERVICE_CATEGORY_OPTIONS },
          { type: 'select', key: 'city', label: 'City', allLabel: 'All cities', options: cityOptions },
          { type: 'dateRange', label: 'Created' },
        ]}
        summary={loading ? 'Loading…' : error ? null : `${totalCount} ${totalCount === 1 ? 'request' : 'requests'}`}
      />

      {loading && requests.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-2xl" />
          ))}
        </div>
      ) : error && requests.length === 0 ? (
        <ErrorState title="Could not load service requests" error={error} onRetry={() => loadRequests(query)} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={anyFilter ? 'No requests found' : 'No service requests yet'}
          description={anyFilter ? 'No service requests match these filters.' : 'Customer requests assigned to you will appear here.'}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Problem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => {
                  const notified = garagesNotified(r);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link
                          href={`/advisor/requests/${r.id}`}
                          className="font-semibold text-navy-900 hover:text-electric-600"
                        >
                          {r.vehicleSummary}
                        </Link>
                        <div className="font-mono text-xs text-navy-500">{r.requestNumber}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-navy-900">{r.customerName}</div>
                        {r.locationSummary && <div className="text-xs text-navy-500">{r.locationSummary}</div>}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="line-clamp-2 text-navy-700">{r.problemDescription}</p>
                        {notified !== null && !r.servicePackageName && (
                          <div className="mt-0.5 text-xs text-navy-500">
                            {notified} garage{notified === 1 ? '' : 's'} notified
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={r.status} />
                          <PackageBadges r={r} />
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-navy-600">{formatDate(r.submittedAtUtc)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => viewDetail(r.id)}>
                            Details
                          </Button>
                          <Link
                            href={`/advisor/requests/${r.id}`}
                            className="inline-flex min-h-[36px] items-center rounded-xl border border-surface-300 bg-white px-3 text-xs font-semibold text-navy-800 transition hover:bg-surface-50"
                          >
                            {r.servicePackageName ? 'Assign garage' : 'Open request'}
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Phone list */}
          <div className="md:hidden">
            <ListGroup>
              {requests.map((r) => (
                <div key={r.id} className="flex items-stretch">
                  <ListItem
                    className="min-w-0 flex-1"
                    href={`/advisor/requests/${r.id}`}
                    hideChevron
                    title={r.vehicleSummary}
                    subtitle={
                      r.servicePackageName
                        ? [r.servicePackageName, typeof r.packagePrice === 'number' ? formatINRWhole(r.packagePrice) : null]
                            .filter(Boolean)
                            .join(' · ')
                        : r.problemDescription
                    }
                    meta={
                      <>
                        {r.customerName} · {formatRelative(r.submittedAtUtc)}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={r.status} />
                          <PackageBadges r={r} />
                        </div>
                      </>
                    }
                  />
                  <button
                    type="button"
                    onClick={() => viewDetail(r.id)}
                    aria-label={`Customer and garage details for ${r.requestNumber}`}
                    className="flex w-12 shrink-0 items-center justify-center border-l border-surface-200/80 text-navy-400 transition hover:bg-surface-50 hover:text-navy-700 active:bg-surface-100"
                  >
                    <Info className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </ListGroup>
          </div>

          {pagination}
        </>
      )}

      {/* Request details sheet */}
      <Modal
        isOpen={detailOpen}
        onClose={closeDetail}
        size="lg"
        title={selectedRequest ? selectedRequest.vehicleSummary : 'Request details'}
        description={
          selectedRequest ? <span className="font-mono">{selectedRequest.requestNumber}</span> : undefined
        }
        footer={
          selectedRequest ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={closeDetail} className="w-full sm:w-auto">
                Close
              </Button>
              <Link href={`/advisor/requests/${selectedRequest.id}`} className={`${linkButtonPrimary} w-full sm:w-auto`}>
                {selectedIsPackage ? (selectedRequest.assignedGarageName ? 'Open booking' : 'Assign garage') : 'Open request'}
              </Link>
            </div>
          ) : undefined
        }
      >
        {detailLoading || !selectedRequest ? (
          <LoadingState inline message="Loading request..." className="py-6 justify-center" />
        ) : (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <DetailRow label="Customer">{selectedRequest.customerName}</DetailRow>
              <DetailRow label="Status">
                <StatusBadge status={selectedRequest.status} />
              </DetailRow>
              <DetailRow label="Number plate">
                <span className="font-mono">{selectedRequest.vehicleLicensePlate || '—'}</span>
              </DetailRow>
              <DetailRow label="Service type">{selectedRequest.serviceCategory || '—'}</DetailRow>
              {selectedRequest.preferredServiceDate && (
                <DetailRow label="Preferred date">{formatDate(selectedRequest.preferredServiceDate)}</DetailRow>
              )}
              <DetailRow label="Submitted">{formatDate(selectedRequest.submittedAtUtc)}</DetailRow>
            </dl>

            {(selectedRequest.customerPhone || selectedRequest.customerEmail) && (
              <div className="flex flex-col gap-2 sm:flex-row">
                {selectedRequest.customerPhone && (
                  <a
                    href={`tel:${selectedRequest.customerPhone}`}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-surface-300 bg-white px-4 text-sm font-semibold text-navy-800 hover:bg-surface-50"
                  >
                    <Phone className="h-4 w-4" />
                    {selectedRequest.customerPhone}
                  </a>
                )}
                {selectedRequest.customerEmail && (
                  <a
                    href={`mailto:${selectedRequest.customerEmail}`}
                    className="inline-flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-surface-300 bg-white px-4 text-sm font-semibold text-navy-800 hover:bg-surface-50"
                  >
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="truncate">{selectedRequest.customerEmail}</span>
                  </a>
                )}
              </div>
            )}

            <section>
              <h4 className="text-sm font-semibold text-navy-900">Problem</h4>
              <p className="mt-1 whitespace-pre-wrap rounded-xl bg-surface-50 p-3 text-sm text-navy-800">
                {selectedRequest.problemDescription}
              </p>
            </section>

            {selectedRequest.serviceLocation && (
              <section>
                <h4 className="text-sm font-semibold text-navy-900">Location</h4>
                <p className="mt-1 flex items-start gap-2 text-sm text-navy-800">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" />
                  <span>{selectedRequest.serviceLocation.formattedAddress}</span>
                </p>
              </section>
            )}

            {selectedIsPackage ? (
              <section>
                <h4 className="text-sm font-semibold text-navy-900">Package booking</h4>
                <p className="mt-1 text-sm text-navy-700">
                  {[
                    selectedRequest.servicePackageName,
                    typeof selectedRequest.packagePrice === 'number' ? `fixed price ${formatINRWhole(selectedRequest.packagePrice)}` : null,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  .{' '}
                  {selectedRequest.assignedGarageName
                    ? `Assigned to ${selectedRequest.assignedGarageName}.`
                    : selectedRequest.advancePaidAtUtc
                    ? 'Advance paid. Garages don’t quote for packages: assign a nearby garage.'
                    : 'Waiting for the customer’s 10% advance before you assign a garage.'}
                </p>
              </section>
            ) : (
            <section>
              <h4 className="text-sm font-semibold text-navy-900">
                Garages notified ({garages.length})
              </h4>
              {garages.length > 0 ? (
                <ul className="mt-2 divide-y divide-surface-200 rounded-xl border border-surface-200">
                  {garages.map((g) => {
                    const phone = g.garagePhone || g.garagePhoneNumber;
                    const sentAt = g.notifiedAtUtc || g.sentAtUtc;
                    return (
                      <li key={g.garageRequestId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-navy-900">{g.garageName}</div>
                          <div className="text-xs text-navy-500">
                            {[
                              typeof g.distanceKm === 'number' ? `${g.distanceKm.toFixed(1)} km` : null,
                              phone,
                              sentAt ? `notified ${formatRelative(sentAt)}` : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        </div>
                        <StatusBadge status={g.status} />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-navy-500">No garages have been notified for this request yet.</p>
              )}
            </section>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
