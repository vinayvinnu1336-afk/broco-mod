'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { ServiceRequestDetailDto } from '@/types/serviceRequest';
import { CustomerServiceJobDetailDto, ServiceJobStatus } from '@/types/serviceJob';
import { Building2, CheckCircle2, ClipboardList, CreditCard, MessageSquare, Store } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { formatDate, formatDateTime, formatINRWhole, humanize } from '@/lib/format';
import { advanceFor, payBookingAdvance } from '@/components/booking/advancePayment';
import {
  DetailRow,
  RequestProgress,
  StepList,
  requestNextStep,
  requestStageIndex,
  statusKey,
} from '@/app/customer/_lib/customer-ui';

/** Package / advance fields returned by GET /customer/requests/{id}. */
type RequestDetail = ServiceRequestDetailDto & {
  servicePackageCode?: string | null;
  servicePackageName?: string | null;
  packagePrice?: number | null;
  advanceAmountDue?: number | null;
  advancePaidAmount?: number | null;
  advancePaidAtUtc?: string | null;
  vehicleFuel?: string | null;
};

const JOB_ORDER: ServiceJobStatus[] = [
  'BookingConfirmed',
  'Scheduled',
  'VehicleReceived',
  'Inspection',
  'WorkStarted',
  'WorkInProgress',
  'WorkCompleted',
  'VehicleReady',
  'HandedOver',
  'Closed',
];

// Customer-facing milestones and the job status index at which each one is reached.
const JOB_STEPS: { label: string; reachedAt: number }[] = [
  { label: 'Booking confirmed', reachedAt: 0 },
  { label: 'Drop-off scheduled', reachedAt: 1 },
  { label: 'Car received at garage', reachedAt: 2 },
  { label: 'Work in progress', reachedAt: 4 },
  { label: 'Ready for pickup', reachedAt: 7 },
  { label: 'Handed over', reachedAt: 8 },
];

function severityVariant(severity: string): BadgeVariant {
  switch (severity?.toLowerCase()) {
    case 'critical':
    case 'high':
      return 'red';
    case 'medium':
      return 'amber';
    case 'low':
      return 'green';
    default:
      return 'neutral';
  }
}

export default function CustomerRequestDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const toast = useToast();

  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [paying, setPaying] = useState(false);
  const [job, setJob] = useState<CustomerServiceJobDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cancellation
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErrorMsg(null);

    const reqRes = await apiFetch<RequestDetail>(`/customer/requests/${id}`);
    if (reqRes.success && reqRes.data) {
      setRequest(reqRes.data);

      const jobRes = await apiFetch<CustomerServiceJobDetailDto>(`/customer/requests/${id}/job`);
      if (jobRes.success && jobRes.data) {
        setJob(jobRes.data);
      }
    } else {
      setErrorMsg(reqRes.message || 'Service request not found.');
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCancelRequest() {
    if (!request || !cancelReason.trim()) return;
    setCancelLoading(true);
    setCancelError(null);

    const res = await apiFetch<boolean>(`/customer/requests/${request.id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: cancelReason }),
    });

    setCancelLoading(false);

    if (res.success) {
      setCancelOpen(false);
      setCancelReason('');
      toast.success('Request cancelled');
      loadData();
    } else {
      setCancelError(res.message || 'Failed to cancel service request.');
    }
  }

  async function handlePayAdvance() {
    if (!request) return;
    setPaying(true);
    const result = await payBookingAdvance(request.id);
    if (result.kind === 'redirect') return; // continuing on the provider's checkout page
    setPaying(false);
    if (result.kind === 'paid') {
      toast.success('Booking confirmed', `${formatINRWhole(result.amount)} advance received. An advisor will assign a verified garage near you shortly.`);
      loadData();
    } else {
      toast.error('Payment not completed', result.message);
    }
  }

  if (loading && !request) {
    return (
      <div className="mx-auto max-w-3xl space-y-5" aria-busy="true" aria-label="Loading request">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-40" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  if (errorMsg || !request) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Service request" backHref="/customer/requests" backLabel="My requests" />
        <ErrorState title="Could not load this request" error={errorMsg} onRetry={loadData} />
      </div>
    );
  }

  const reqKey = statusKey(request.status);
  const canCancel = reqKey !== 'CANCELLED' && reqKey !== 'COMPLETED';
  const isPackageBooking = !!request.servicePackageCode;
  const advancePaid = !!request.advancePaidAtUtc;
  // Package bookings have a fixed price: no garage quotes, an advisor assigns a garage once the advance is paid.
  const nextStep =
    isPackageBooking && requestStageIndex(request.status) === 0
      ? advancePaid
        ? 'Booking confirmed. An advisor will assign a verified garage near you shortly.'
        : 'Pay the 10% booking advance below to confirm your booking.'
      : requestNextStep(request.status);

  const jobIdx = job ? JOB_ORDER.indexOf(job.status as ServiceJobStatus) : -1;
  const jobFinished = jobIdx >= JOB_ORDER.indexOf('HandedOver');
  const jobSteps = JOB_STEPS.map((step, i) => {
    const reached = jobIdx >= step.reachedAt;
    const nextReached = i < JOB_STEPS.length - 1 && jobIdx >= JOB_STEPS[i + 1].reachedAt;
    const state: 'done' | 'current' | 'upcoming' = !reached
      ? 'upcoming'
      : nextReached || jobFinished
      ? 'done'
      : 'current';
    return { label: step.label, state };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <PageHeader
        backHref="/customer/requests"
        backLabel="My requests"
        eyebrow={
          <>
            <StatusBadge status={request.status} />
            <span className="font-mono text-xs text-navy-500">{request.requestNumber}</span>
          </>
        }
        title={request.vehicleSummary || 'Service request'}
        description={request.vehicleLicensePlate}
      />

      {/* Where things stand */}
      {job ? (
        <Card className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-navy-900">Service progress</h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-navy-500">
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{job.garageName}</span>
              </p>
            </div>
            <StatusBadge status={job.status} className="shrink-0" />
          </div>

          {(job.scheduledStartAtUtc || job.estimatedCompletionAtUtc) && (
            <dl className="mt-3 divide-y divide-surface-200 rounded-xl bg-surface-50 px-3">
              {job.scheduledStartAtUtc && (
                <DetailRow label="Scheduled">{formatDateTime(job.scheduledStartAtUtc)}</DetailRow>
              )}
              {job.estimatedCompletionAtUtc && (
                <DetailRow label="Expected ready" strong>
                  {formatDateTime(job.estimatedCompletionAtUtc)}
                </DetailRow>
              )}
            </dl>
          )}

          <div className="mt-4">
            <StepList steps={jobSteps} />
          </div>

          {job.customerFacingNotes && (
            <div className="mt-4 rounded-xl border border-surface-200 bg-surface-50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-navy-500">
                <MessageSquare className="h-3.5 w-3.5" />
                Note from the garage
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-navy-800">{job.customerFacingNotes}</p>
            </div>
          )}

          <p className="mt-3 text-xs text-navy-400">Job {job.jobNumber}</p>
        </Card>
      ) : (
        <Card className="p-4 sm:p-5">
          <h2 className="text-base font-semibold text-navy-900">Where things stand</h2>
          <RequestProgress status={request.status} className="mt-3" />
          {nextStep && <p className="mt-3 text-sm text-navy-700">{nextStep}</p>}
          {request.matchedGaragesCount > 0 && reqKey !== 'CANCELLED' && !isPackageBooking && (
            <p className="mt-1 text-sm text-navy-500">
              {request.matchedGaragesCount} garage{request.matchedGaragesCount === 1 ? '' : 's'} contacted so far.
            </p>
          )}
        </Card>
      )}

      <PaymentCard request={request} paying={paying} onPay={handlePayAdvance} />

      {/* Inspection */}
      {job?.inspection && (
        <Card className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-navy-900">
              <ClipboardList className="h-4 w-4 text-navy-400" />
              Inspection
            </h2>
            {job.inspection.overallSeverity && (
              <Badge variant={severityVariant(String(job.inspection.overallSeverity))}>
                {humanize(String(job.inspection.overallSeverity))}
              </Badge>
            )}
          </div>
          {job.inspection.customerVisibleSummary ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-navy-700">
              {job.inspection.customerVisibleSummary}
            </p>
          ) : (
            <p className="mt-2 text-sm text-navy-500">
              {job.inspection.inspectionCompletedAtUtc ? 'Inspection completed.' : 'Inspection in progress.'}
            </p>
          )}
        </Card>
      )}

      {/* Updates */}
      {job && (
        <section>
          <h2 className="mb-2 px-1 text-base font-semibold text-navy-900">Updates</h2>
          {job.timeline && job.timeline.length > 0 ? (
            <ol className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-card divide-y divide-surface-200/80">
              {job.timeline.map((act, index) => (
                <li key={index} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-navy-900">{humanize(act.activityType)}</span>
                    <time className="shrink-0 text-xs text-navy-400" dateTime={act.createdAtUtc}>
                      {formatDateTime(act.createdAtUtc)}
                    </time>
                  </div>
                  {act.message && <p className="mt-0.5 text-sm text-navy-600">{act.message}</p>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-2xl border border-dashed border-surface-300 bg-white p-4 text-sm text-navy-500">
              No updates from the garage yet.
            </p>
          )}
        </section>
      )}

      {/* Request details */}
      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-navy-900">Request details</h2>
        <div className="mt-3">
          <div className="text-xs font-medium text-navy-400">Problem</div>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-navy-800">{request.problemDescription}</p>
        </div>
        <dl className="mt-3 divide-y divide-surface-200 border-t border-surface-200">
          {request.serviceCategory && <DetailRow label="Service">{request.serviceCategory}</DetailRow>}
          {request.preferredServiceDate && (
            <DetailRow label="Preferred date">{formatDate(request.preferredServiceDate)}</DetailRow>
          )}
          {request.serviceLocation?.formattedAddress && (
            <DetailRow label="Location">{request.serviceLocation.formattedAddress}</DetailRow>
          )}
          {request.assignedAdvisorName && <DetailRow label="Your advisor">{request.assignedAdvisorName}</DetailRow>}
          <DetailRow label="Requested">{formatDateTime(request.submittedAtUtc)}</DetailRow>
        </dl>

        {request.cancelledAtUtc && (
          <Alert type="error" className="mt-3" title={`Cancelled on ${formatDate(request.cancelledAtUtc)}`}>
            {request.cancellationReason ? `Reason: ${request.cancellationReason}` : 'This request was cancelled.'}
          </Alert>
        )}
      </Card>

      {canCancel && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            className="w-full text-red-600 hover:bg-red-50 hover:text-red-700 sm:w-auto"
            onClick={() => {
              setCancelReason('');
              setCancelError(null);
              setCancelOpen(true);
            }}
          >
            Cancel this request
          </Button>
        </div>
      )}

      <Modal
        isOpen={cancelOpen}
        onClose={() => !cancelLoading && setCancelOpen(false)}
        title="Cancel this request?"
        description="Garages preparing a quote will be told you no longer need the service."
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setCancelOpen(false)}
              disabled={cancelLoading}
              className="w-full sm:w-auto"
            >
              Keep request
            </Button>
            <Button
              variant="danger"
              onClick={handleCancelRequest}
              isLoading={cancelLoading}
              disabled={!cancelReason.trim()}
              className="w-full sm:w-auto"
            >
              Cancel request
            </Button>
          </div>
        }
      >
        {cancelError && (
          <Alert type="error" className="mb-4">
            {cancelError}
          </Alert>
        )}
        <Textarea
          id="cancelReason"
          label="Why are you cancelling?"
          rows={3}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="e.g. Plans changed, or the problem is fixed."
          required
        />
      </Modal>
    </div>
  );
}

function PaymentCard({ request, paying, onPay }: { request: RequestDetail; paying: boolean; onPay: () => void }) {
  const cancelled = statusKey(request.status) === 'CANCELLED';
  const isPackage = !!request.servicePackageCode;

  if (!isPackage) {
    if (cancelled) return null;
    return (
      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-navy-900">Payment</h2>
        <p className="mt-1 text-sm leading-relaxed text-navy-600">
          Nothing to pay yet. Once you accept a garage quote, you pay 10% online to BroCo to confirm the booking and the
          remaining 90% directly at the garage after the service.
        </p>
      </Card>
    );
  }

  const price = Number(request.packagePrice ?? 0);
  const due = Number(request.advanceAmountDue ?? advanceFor(price));
  const paidAmount = Number(request.advancePaidAmount ?? 0);
  const paid = !!request.advancePaidAtUtc || (due > 0 && paidAmount >= due);
  const balance = Math.max(0, price - (paid ? paidAmount : due));

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-base font-semibold text-navy-900">Payment</h2>
      <dl className="mt-3 divide-y divide-surface-200 rounded-xl border border-surface-200 px-3">
        <DetailRow label={request.servicePackageName || 'Package'} strong>
          {formatINRWhole(price)}
        </DetailRow>
        <div className="flex items-start justify-between gap-4 py-2.5">
          <dt className="text-sm text-navy-500">Booking advance (10%)</dt>
          <dd className="text-right text-sm">
            {paid ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                {formatINRWhole(paidAmount || due)} paid
              </span>
            ) : (
              <span className="font-semibold text-amber-700">{formatINRWhole(due)} due</span>
            )}
            {paid && request.advancePaidAtUtc && (
              <span className="block text-xs text-navy-400">{formatDateTime(request.advancePaidAtUtc)}</span>
            )}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-4 py-2.5">
          <dt className="flex items-center gap-1.5 text-sm text-navy-500">
            <Store className="h-4 w-4 shrink-0 text-navy-400" />
            Balance at the garage
          </dt>
          <dd className="text-right text-sm font-semibold tabular-nums text-navy-900">{formatINRWhole(balance)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-navy-500">
        Balance {formatINRWhole(balance)} payable at the garage after the service.
      </p>
      {!paid && !cancelled && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-navy-700">Your booking is saved but not confirmed yet. Pay the advance to confirm it.</p>
          <Button
            variant="primary"
            className="w-full sm:w-auto"
            onClick={onPay}
            isLoading={paying}
            leftIcon={!paying ? <CreditCard className="h-4 w-4" /> : undefined}
          >
            {paying ? 'Processing…' : `Pay ${formatINRWhole(due)} advance to confirm`}
          </Button>
        </div>
      )}
    </Card>
  );
}
