'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatDateTime, formatINR, formatRelative, humanize } from '@/lib/format';
import {
  AdvisorServiceJobDetailDto,
  AdditionalWorkRequestDto,
  ReviewAdditionalWorkRequest,
} from '@/types/serviceJob';
import { AlertTriangle, Check, Eye, Lock, Phone, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActionBar, ActionBarSpacer } from '@/components/ui/ActionBar';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

function isPendingReview(status: string) {
  return String(status).replace(/[_\s]/g, '').toLowerCase() === 'pendingadvisorreview';
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-navy-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-navy-900">{children}</dd>
    </div>
  );
}

export default function AdvisorJobDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const toast = useToast();

  const [job, setJob] = useState<AdvisorServiceJobDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Review additional work sheet
  const [selectedWork, setSelectedWork] = useState<AdditionalWorkRequestDto | null>(null);
  const [reviewApproved, setReviewApproved] = useState<boolean>(true);
  const [reviewRemarks, setReviewRemarks] = useState<string>('');

  const loadJob = useCallback(async () => {
    setErrorMsg(null);
    const res = await apiFetch<AdvisorServiceJobDetailDto>(`/advisor/jobs/${id}`);
    if (res.success && res.data) {
      setJob(res.data);
    } else {
      setErrorMsg(res.message || 'Failed to load service job details.');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (id) {
      setLoading(true);
      loadJob();
    }
  }, [id, loadJob]);

  function openReview(work: AdditionalWorkRequestDto) {
    setSelectedWork(work);
    setReviewApproved(true);
    setReviewRemarks('');
  }

  async function handleReviewAdditionalWork() {
    if (!selectedWork) return;
    setActionLoading(true);
    const payload: ReviewAdditionalWorkRequest = {
      approved: reviewApproved,
      remarks: reviewRemarks,
    };
    const res = await apiFetch(`/advisor/jobs/${id}/additional-work/${selectedWork.id}/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.success) {
      toast.success(reviewApproved ? 'Extra work approved' : 'Extra work declined');
      setSelectedWork(null);
      setReviewRemarks('');
      await loadJob();
    } else {
      toast.error('Could not save your decision', res.message || 'Failed to review additional work request.');
    }
    setActionLoading(false);
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-16 w-2/3 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-5">
        <PageHeader title="Service job" backHref="/advisor/jobs" backLabel="Service jobs" />
        <ErrorState
          title="Could not load this job"
          error={errorMsg}
          onRetry={() => {
            setLoading(true);
            loadJob();
          }}
        />
      </div>
    );
  }

  const extraWork = job.additionalWorkRequests ?? [];
  const pending = extraWork.filter((w) => isPendingReview(w.status));
  const reviewed = extraWork.filter((w) => !isPendingReview(w.status));
  const inspections = job.inspections ?? [];
  const activities = job.activities ?? [];

  const milestones: { label: string; at?: string | null }[] = [
    { label: 'Scheduled start', at: job.scheduledStartAtUtc },
    { label: 'Expected completion', at: job.estimatedCompletionAtUtc },
    { label: 'Car received', at: job.actualVehicleReceivedAtUtc },
    { label: 'Work started', at: job.actualWorkStartedAtUtc },
    { label: 'Work completed', at: job.actualWorkCompletedAtUtc },
    { label: 'Ready for pickup', at: job.vehicleReadyAtUtc },
    { label: 'Handed over', at: job.handedOverAtUtc },
    { label: 'Closed', at: job.closedAtUtc },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        backHref="/advisor/jobs"
        backLabel="Service jobs"
        eyebrow={
          <>
            <span className="font-mono text-xs font-semibold text-navy-500">{job.jobNumber}</span>
            <StatusBadge status={job.status} />
          </>
        }
        title={`${job.vehicleYear} ${job.vehicleMake} ${job.vehicleModel}`}
        description={
          <>
            {job.garageName} · request{' '}
            <Link href={`/advisor/requests/${job.serviceRequestId}`} className="font-mono text-electric-600 hover:underline">
              {job.requestNumber}
            </Link>
          </>
        }
      />

      {/* Extra work waiting for a decision */}
      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-navy-900">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Extra work waiting for you ({pending.length})
          </h2>
          {pending.map((work) => (
            <Card key={work.id} className="border-amber-200 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy-900">{work.description}</p>
                  <p className="mt-1 text-sm text-navy-600">{work.reason}</p>
                  <p className="mt-1 text-xs text-navy-500">Raised {formatRelative(work.createdAtUtc)}</p>
                </div>
                <div className="shrink-0 text-right text-base font-bold tabular-nums text-navy-900">
                  {formatINR(work.estimatedAdditionalAmount)}
                </div>
              </div>
              <Button variant="outline" className="mt-3 w-full sm:w-auto" onClick={() => openReview(work)}>
                Review
              </Button>
            </Card>
          ))}
        </section>
      )}

      {/* Vehicle, customer, garage */}
      <Card className="p-4 sm:p-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Fact label="Number plate">
            <span className="font-mono">{job.vehicleLicensePlate}</span>
          </Fact>
          <Fact label="Odometer at intake">
            {job.currentMileageKm != null ? `${job.currentMileageKm.toLocaleString('en-IN')} km` : 'Not recorded'}
          </Fact>
          <Fact label="Garage">{job.garageName}</Fact>
          <Fact label="Customer">{job.customerName}</Fact>
          <Fact label="Customer quotation">
            <span className="font-mono">{job.quotationNumber}</span>
          </Fact>
        </dl>
        {job.customerPhone && (
          <a
            href={`tel:${job.customerPhone}`}
            className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-surface-300 bg-white px-4 text-sm font-semibold text-navy-800 hover:bg-surface-50 sm:w-auto"
          >
            <Phone className="h-4 w-4" />
            Call {job.customerName.split(' ')[0] || 'customer'}
          </a>
        )}
      </Card>

      {/* Problem */}
      {(job.problemDescription || job.customerComplaintSnapshot) && (
        <Card className="p-4 sm:p-5">
          <h2 className="text-base font-semibold text-navy-900">Customer&apos;s problem</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-navy-700">
            {job.customerComplaintSnapshot || job.problemDescription}
          </p>
        </Card>
      )}

      {/* Progress */}
      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-navy-900">Progress</h2>
        <ol className="mt-3 divide-y divide-surface-200">
          {milestones.map((m) => (
            <li key={m.label} className="flex items-center justify-between gap-3 py-2">
              <span className={`text-sm ${m.at ? 'text-navy-900' : 'text-navy-400'}`}>{m.label}</span>
              <span className={`text-right text-sm tabular-nums ${m.at ? 'font-medium text-navy-900' : 'text-navy-400'}`}>
                {m.at ? formatDateTime(m.at) : '—'}
              </span>
            </li>
          ))}
        </ol>
        {job.cancelledAtUtc && (
          <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            Cancelled {formatDateTime(job.cancelledAtUtc)}
            {job.cancellationReason ? `: ${job.cancellationReason}` : ''}
          </p>
        )}
      </Card>

      {/* Garage notes */}
      {(job.garageInternalNotes || job.customerFacingNotes) && (
        <Card className="p-4 sm:p-5">
          <h2 className="text-base font-semibold text-navy-900">Garage notes</h2>
          {job.garageInternalNotes && (
            <div className="mt-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-navy-500">
                <Lock className="h-3.5 w-3.5" /> Internal
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-navy-700">{job.garageInternalNotes}</p>
            </div>
          )}
          {job.customerFacingNotes && (
            <div className="mt-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <Eye className="h-3.5 w-3.5" /> Shown to customer
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-navy-700">{job.customerFacingNotes}</p>
            </div>
          )}
        </Card>
      )}

      {/* Inspections */}
      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-navy-900">Inspection reports</h2>
        {inspections.length > 0 ? (
          <div className="mt-3 space-y-3">
            {inspections.map((insp) => (
              <div key={insp.id} className="rounded-xl border border-surface-200 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-navy-900">{insp.inspectorName}</span>
                  <span className="text-xs text-navy-500">
                    Severity: <span className="font-semibold text-navy-800">{humanize(String(insp.overallSeverity))}</span>
                  </span>
                </div>
                <p className="text-xs text-navy-500">
                  {formatDateTime(insp.inspectionCompletedAtUtc || insp.inspectionStartedAtUtc)}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg bg-surface-50 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-navy-500">
                      <Lock className="h-3.5 w-3.5" /> Garage findings (not shown to customer)
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-navy-700">{insp.findings || 'No notes'}</p>
                    {insp.recommendations && (
                      <p className="mt-2 text-sm text-navy-700">
                        <span className="font-medium text-navy-900">Recommendations: </span>
                        {insp.recommendations}
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg bg-emerald-50/60 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <Eye className="h-3.5 w-3.5" /> Summary for customer
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-navy-700">{insp.customerVisibleSummary || 'None'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-sm text-navy-500">No inspections recorded yet.</p>
        )}
      </Card>

      {/* Extra work history */}
      {reviewed.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h2 className="text-base font-semibold text-navy-900">Extra work history</h2>
          <ul className="mt-3 divide-y divide-surface-200">
            {reviewed.map((work) => (
              <li key={work.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-sm font-medium text-navy-900">{work.description}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-navy-900">
                    {formatINR(work.estimatedAdditionalAmount)}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-navy-600">{work.reason}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <StatusBadge status={work.status} />
                  {work.reviewedAtUtc && <span className="text-xs text-navy-500">{formatDateTime(work.reviewedAtUtc)}</span>}
                </div>
                {work.advisorRemarks && <p className="mt-1 text-xs text-navy-500">Remarks: {work.advisorRemarks}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Activity */}
      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-navy-900">Activity</h2>
        {activities.length > 0 ? (
          <ol className="relative mt-3 space-y-4 pl-5 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-px before:bg-surface-200">
            {activities.map((act) => (
              <li key={act.id} className="relative">
                <span className="absolute -left-5 top-1.5 h-2.5 w-2.5 rounded-full bg-electric-600 ring-4 ring-white" aria-hidden="true" />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-sm font-medium text-navy-900">{humanize(act.activityType)}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-navy-500">
                    {act.isCustomerVisible ? (
                      <>
                        <Eye className="h-3 w-3" /> Customer can see
                      </>
                    ) : (
                      <>
                        <Lock className="h-3 w-3" /> Internal
                      </>
                    )}
                  </span>
                </div>
                {act.message && <p className="mt-0.5 text-sm text-navy-700">{act.message}</p>}
                <p className="mt-0.5 text-xs text-navy-400">
                  {act.actorName} · {formatDateTime(act.createdAtUtc)}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-1 text-sm text-navy-500">No activity yet.</p>
        )}
      </Card>

      {pending.length > 0 && (
        <>
          <ActionBar
            summary={
              <div className="min-w-0">
                <div className="truncate text-xs text-navy-500">
                  {pending.length} extra work request{pending.length === 1 ? '' : 's'} waiting
                </div>
                <div className="text-base font-bold tabular-nums text-navy-900">
                  {formatINR(pending.reduce((sum, w) => sum + (w.estimatedAdditionalAmount || 0), 0))}
                </div>
              </div>
            }
          >
            <Button onClick={() => openReview(pending[0])}>Review extra work</Button>
          </ActionBar>
          <ActionBarSpacer />
        </>
      )}

      {/* Review sheet */}
      <Modal
        isOpen={!!selectedWork}
        onClose={() => !actionLoading && setSelectedWork(null)}
        title="Review extra work"
        description="Approving does not change the customer's accepted quotation or bill them automatically."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={actionLoading}
              onClick={() => setSelectedWork(null)}
            >
              Cancel
            </Button>
            <Button
              variant={reviewApproved ? 'primary' : 'danger'}
              className="w-full sm:w-auto"
              isLoading={actionLoading}
              onClick={handleReviewAdditionalWork}
            >
              {reviewApproved ? 'Approve' : 'Decline'}
            </Button>
          </div>
        }
      >
        {selectedWork && (
          <div className="space-y-4">
            <div className="rounded-xl border border-surface-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 text-sm font-semibold text-navy-900">{selectedWork.description}</span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-navy-900">
                  {formatINR(selectedWork.estimatedAdditionalAmount)}
                </span>
              </div>
              <p className="mt-1 text-sm text-navy-600">{selectedWork.reason}</p>
            </div>

            <div role="radiogroup" aria-label="Decision" className="grid grid-cols-2 gap-2">
              <button
                type="button"
                role="radio"
                aria-checked={reviewApproved}
                onClick={() => setReviewApproved(true)}
                className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition ${
                  reviewApproved
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-100'
                    : 'border-surface-200 bg-white text-navy-600 hover:border-surface-300'
                }`}
              >
                <Check className="h-4 w-4" /> Approve
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!reviewApproved}
                onClick={() => setReviewApproved(false)}
                className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition ${
                  !reviewApproved
                    ? 'border-red-500 bg-red-50 text-red-700 ring-2 ring-red-100'
                    : 'border-surface-200 bg-white text-navy-600 hover:border-surface-300'
                }`}
              >
                <X className="h-4 w-4" /> Decline
              </button>
            </div>

            <Textarea
              id="review-remarks"
              label="Remarks"
              rows={3}
              value={reviewRemarks}
              onChange={(e) => setReviewRemarks(e.target.value)}
              placeholder={reviewApproved ? 'Optional note for the garage' : 'Tell the garage why'}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
