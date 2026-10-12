'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  GarageIncomingRequestDto,
  GarageIncomingRequestDetailDto,
  PagedResult,
} from '@/types/serviceRequest';
import { Calendar, Car, ChevronLeft, ChevronRight, Clock, FilePlus2, Inbox, MapPin, Navigation } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { formatDate, formatRelative, humanize } from '@/lib/format';

/** Requests the garage can still quote on. Others (declined/expired) stay visible but de-emphasised. */
const CLOSED_STATUSES = ['DECLINED', 'EXPIRED'];

function formatKm(km: number | null | undefined) {
  const value = Number(km ?? 0);
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} km away`;
}

export default function GarageRequestsPage() {
  const router = useRouter();
  const toast = useToast();
  const [requests, setRequests] = useState<GarageIncomingRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Detail sheet
  const [selectedRequest, setSelectedRequest] = useState<GarageIncomingRequestDetailDto | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);

  async function loadRequests(p = 1, { quiet = false } = {}) {
    if (!quiet) {
      setLoading(true);
      setLoadError(null);
    }
    const res = await apiFetch<PagedResult<GarageIncomingRequestDto>>(`/garage/requests?page=${p}&pageSize=10`);
    if (res.success && res.data) {
      setRequests(res.data.items);
      setPage(res.data.page);
      setTotalPages(res.data.totalPages);
    } else if (!quiet) {
      setLoadError(res.message || 'Could not load requests.');
    }
    if (!quiet) setLoading(false);
  }

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function viewDetail(garageRequestId: string) {
    setDetailLoadingId(garageRequestId);
    const res = await apiFetch<GarageIncomingRequestDetailDto>(`/garage/requests/${garageRequestId}`);
    if (res.success && res.data) {
      setSelectedRequest(res.data);
      // Reload list in background to reflect VIEWED status
      loadRequests(page, { quiet: true });
    } else {
      toast.error('Could not open request', res.message || 'Please try again.');
    }
    setDetailLoadingId(null);
  }

  function createQuote(garageRequestId: string) {
    router.push(`/garage/quotes/new?requestId=${garageRequestId}`);
  }

  return (
    <div>
      <PageHeader
        title="New requests"
        description="Customer jobs near your workshop. Check the details, then send a quote."
      />

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : loadError ? (
        <ErrorState title="Couldn’t load requests" error={loadError} onRetry={() => loadRequests(page)} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No requests right now"
          description="When a customer near your workshop books a service, it shows up here."
        />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const closed = CLOSED_STATUSES.includes(String(r.status).toUpperCase());
            return (
              <article
                key={r.garageRequestId}
                className={`rounded-2xl border border-surface-200 bg-white p-4 shadow-card sm:p-5 ${closed ? 'opacity-70' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-[15px] font-semibold leading-snug text-navy-900">
                      <Car className="h-4 w-4 shrink-0 text-navy-400" />
                      <span className="truncate">{r.vehicleSummary || 'Vehicle'}</span>
                    </h2>
                    <div className="mt-0.5 text-xs text-navy-500">{r.requestNumber}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>

                <p className="mt-3 line-clamp-3 text-sm text-navy-700">{r.problemDescription}</p>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-navy-500">
                  <span className="inline-flex items-center gap-1 font-medium text-electric-700">
                    <Navigation className="h-3.5 w-3.5" />
                    {formatKm(r.distanceKm)}
                  </span>
                  {r.locationArea && (
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{r.locationArea}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatRelative(r.sentAtUtc)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => viewDetail(r.garageRequestId)}
                    isLoading={detailLoadingId === r.garageRequestId}
                    disabled={detailLoadingId !== null}
                  >
                    Details
                  </Button>
                  <Button
                    variant={closed ? 'outline' : 'primary'}
                    onClick={() => createQuote(r.garageRequestId)}
                    leftIcon={<FilePlus2 className="h-4 w-4" />}
                  >
                    Create quote
                  </Button>
                </div>
              </article>
            );
          })}

          {totalPages > 1 && (
            <nav className="flex items-center justify-between gap-2 pt-1" aria-label="Pages">
              <Button
                variant="outline"
                disabled={page <= 1}
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
                disabled={page >= totalPages}
                onClick={() => loadRequests(page + 1)}
                rightIcon={<ChevronRight className="h-4 w-4" />}
              >
                Next
              </Button>
            </nav>
          )}
        </div>
      )}

      {/* Detail sheet */}
      <Modal
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title={
          selectedRequest
            ? `${selectedRequest.vehicleYear} ${selectedRequest.vehicleMake} ${selectedRequest.vehicleModel}`
            : ''
        }
        description={selectedRequest?.requestNumber}
        footer={
          selectedRequest && (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setSelectedRequest(null)}>
                Close
              </Button>
              <Button
                className="w-full sm:w-auto"
                leftIcon={<FilePlus2 className="h-4 w-4" />}
                onClick={() => {
                  const reqId = selectedRequest.garageRequestId;
                  setSelectedRequest(null);
                  createQuote(reqId);
                }}
              >
                Create quote
              </Button>
            </div>
          )
        }
      >
        {selectedRequest && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selectedRequest.status} />
              <span className="text-xs font-medium text-electric-700">{formatKm(selectedRequest.distanceKm)}</span>
            </div>

            <div>
              <div className="text-xs text-navy-500">Problem</div>
              <p className="mt-0.5 whitespace-pre-wrap text-navy-900">{selectedRequest.problemDescription}</p>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <dt className="text-xs text-navy-500">Number plate</dt>
                <dd className="font-medium text-navy-900">{selectedRequest.vehicleLicensePlate || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-navy-500">Service type</dt>
                <dd className="font-medium text-navy-900">{humanize(selectedRequest.serviceCategory) || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-navy-500">Area</dt>
                <dd className="font-medium text-navy-900">{selectedRequest.locationArea || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-navy-500">Preferred date</dt>
                <dd className="flex items-center gap-1 font-medium text-navy-900">
                  {selectedRequest.preferredServiceDate ? (
                    <>
                      <Calendar className="h-3.5 w-3.5 text-navy-400" />
                      {formatDate(selectedRequest.preferredServiceDate)}
                    </>
                  ) : (
                    'Not given'
                  )}
                </dd>
              </div>
            </dl>

            <p className="rounded-xl bg-surface-50 p-3 text-xs text-navy-600">
              Your quote goes to a BroCo Mod advisor, not straight to the customer. Item prices stay private.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
