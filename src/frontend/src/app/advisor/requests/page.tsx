'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatDate, formatRelative } from '@/lib/format';
import {
  AdvisorServiceRequestSummaryDto,
  AdvisorServiceRequestDetailDto,
  DispatchedGarageSummaryDto,
  PagedResult,
} from '@/types/serviceRequest';
import { Info, Inbox, MapPin, Phone, Mail, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { ListGroup, ListItem } from '@/components/ui/ListItem';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

// The API names some fields differently from the shared types; read both so counts and contacts show.
type RequestSummary = AdvisorServiceRequestSummaryDto & { dispatchedGaragesCount?: number };
type DispatchedGarage = DispatchedGarageSummaryDto & { garagePhoneNumber?: string; sentAtUtc?: string };

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

export default function AdvisorRequestsPage() {
  const toast = useToast();
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Request details sheet
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AdvisorServiceRequestDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadRequests = useCallback(async (p = 1) => {
    setLoading(true);
    const res = await apiFetch<PagedResult<AdvisorServiceRequestSummaryDto>>(
      `/advisor/requests?page=${p}&pageSize=10`
    );
    if (res.success && res.data) {
      setRequests(res.data.items ?? []);
      setPage(res.data.page);
      setTotalPages(res.data.totalPages);
      setError(null);
    } else {
      setError(res.message || 'Could not load service requests.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function viewDetail(requestId: string) {
    setDetailOpen(true);
    setSelectedRequest(null);
    setDetailLoading(true);
    const res = await apiFetch<AdvisorServiceRequestDetailDto>(`/advisor/requests/${requestId}`);
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
    </div>
  );

  const garages = (selectedRequest?.dispatchedGarages ?? []) as DispatchedGarage[];

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Service requests"
        description="Requests assigned to you. Open one to compare garage quotes and assign a garage."
      />

      {loading && requests.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-2xl" />
          ))}
        </div>
      ) : error && requests.length === 0 ? (
        <ErrorState title="Could not load service requests" error={error} onRetry={() => loadRequests(page)} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No service requests yet"
          description="Customer requests assigned to you will appear here."
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
                        {notified !== null && (
                          <div className="mt-0.5 text-xs text-navy-500">
                            {notified} garage{notified === 1 ? '' : 's'} notified
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
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
                            Compare quotes
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
                    subtitle={r.problemDescription}
                    meta={
                      <>
                        {r.customerName} · {formatRelative(r.submittedAtUtc)}
                        <div className="mt-1.5">
                          <StatusBadge status={r.status} />
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
                Compare quotes
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
          </div>
        )}
      </Modal>
    </div>
  );
}
