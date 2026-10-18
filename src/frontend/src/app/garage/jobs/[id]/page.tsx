'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  GarageServiceJobDetailDto,
  InspectionSeverity,
  ScheduleJobRequest,
  ReceiveVehicleRequest,
  CompleteInspectionRequest,
  UpdateJobProgressRequest,
  CompleteWorkRequest,
  CreateAdditionalWorkRequest,
} from '@/types/serviceJob';
import {
  Calendar,
  CarFront,
  Clock,
  IndianRupee,
  Check,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileText,
  Flag,
  KeyRound,
  Lock,
  MessageSquarePlus,
  Package,
  Phone,
  PlusCircle,
  Wrench,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Checkbox } from '@/components/ui/Checkbox';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { ActionBar, ActionBarSpacer } from '@/components/ui/ActionBar';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, formatINR, humanize } from '@/lib/format';
import { GarageCommission } from '@/components/garage/commission';
import { ServiceMediaSection } from '@/components/media/ServiceMediaSection';
import { PickupSummary } from '@/components/booking/PickupSummary';
import type { MediaStage } from '@/types/media';

/** Payment fields the API adds to the garage job detail (not yet in the shared type). */
type GarageJob = GarageServiceJobDetailDto & {
  servicePackageName?: string | null;
  serviceValue?: number;
  advancePaidAmount?: number;
  isAdvancePaid?: boolean;
  balanceToCollect?: number;
};

/** Before the car arrives the garage waits for the customer's 10% advance. */
const PRE_RECEIPT_STATUSES = ['BookingConfirmed', 'Scheduled'];
/** Work finished: remind the workshop to collect the balance at handover. */
const COLLECT_STATUSES = ['WorkCompleted', 'VehicleReady'];
const AFTER_HANDOVER_STATUSES = ['HandedOver', 'Closed'];

type ModalKey =
  | 'schedule'
  | 'receive'
  | 'startInspection'
  | 'completeInspection'
  | 'startWork'
  | 'progress'
  | 'completeWork'
  | 'vehicleReady'
  | 'handover'
  | 'close'
  | 'cancel'
  | 'additionalWork';

interface StepAction {
  modal: ModalKey;
  label: string;
  icon: ReactNode;
}

/** The job lifecycle as the workshop sees it. WorkStarted/WorkInProgress are one step. */
const STAGES: { label: string; statuses: string[]; at?: (j: GarageServiceJobDetailDto) => string | null | undefined }[] = [
  { label: 'Booked', statuses: ['BookingConfirmed'] },
  { label: 'Scheduled', statuses: ['Scheduled'], at: (j) => j.scheduledStartAtUtc },
  { label: 'Car received', statuses: ['VehicleReceived'], at: (j) => j.actualVehicleReceivedAtUtc },
  { label: 'Inspection', statuses: ['Inspection'], at: (j) => j.inspections?.[0]?.inspectionStartedAtUtc },
  { label: 'Work in progress', statuses: ['WorkStarted', 'WorkInProgress'], at: (j) => j.actualWorkStartedAtUtc },
  { label: 'Work done', statuses: ['WorkCompleted'], at: (j) => j.actualWorkCompletedAtUtc },
  { label: 'Ready for pickup', statuses: ['VehicleReady'], at: (j) => j.vehicleReadyAtUtc },
  { label: 'Handed over', statuses: ['HandedOver'], at: (j) => j.handedOverAtUtc },
  { label: 'Closed', statuses: ['Closed'], at: (j) => j.closedAtUtc },
];

const NEXT_STEP: Record<string, { hint: string; primary?: StepAction; secondary?: StepAction }> = {
  BookingConfirmed: {
    hint: 'Agree a drop-off time with the customer, then set the schedule.',
    primary: { modal: 'schedule', label: 'Schedule', icon: <Calendar className="h-4 w-4" /> },
    secondary: { modal: 'cancel', label: 'Cancel booking', icon: <X className="h-4 w-4" /> },
  },
  Scheduled: {
    hint: 'When the car arrives, record it with the odometer reading.',
    primary: { modal: 'receive', label: 'Car received', icon: <CarFront className="h-4 w-4" /> },
    secondary: { modal: 'cancel', label: 'Cancel booking', icon: <X className="h-4 w-4" /> },
  },
  VehicleReceived: {
    hint: 'Inspect the car, or start work straight away if no inspection is needed.',
    primary: { modal: 'startInspection', label: 'Start inspection', icon: <ClipboardList className="h-4 w-4" /> },
    secondary: { modal: 'startWork', label: 'Skip to work', icon: <Wrench className="h-4 w-4" /> },
  },
  Inspection: {
    hint: 'Record what you found. The summary you write is shared with the customer.',
    primary: { modal: 'completeInspection', label: 'Finish inspection', icon: <CheckCircle2 className="h-4 w-4" /> },
    secondary: { modal: 'startWork', label: 'Start work', icon: <Wrench className="h-4 w-4" /> },
  },
  WorkStarted: {
    hint: 'Post updates as you go. Ask for approval before doing extra work.',
    primary: { modal: 'completeWork', label: 'Work done', icon: <Check className="h-4 w-4" /> },
    secondary: { modal: 'progress', label: 'Add update', icon: <MessageSquarePlus className="h-4 w-4" /> },
  },
  WorkInProgress: {
    hint: 'Post updates as you go. Ask for approval before doing extra work.',
    primary: { modal: 'completeWork', label: 'Work done', icon: <Check className="h-4 w-4" /> },
    secondary: { modal: 'progress', label: 'Add update', icon: <MessageSquarePlus className="h-4 w-4" /> },
  },
  WorkCompleted: {
    hint: 'Let the customer know the car is ready to collect.',
    primary: { modal: 'vehicleReady', label: 'Ready for pickup', icon: <CheckCircle2 className="h-4 w-4" /> },
  },
  VehicleReady: {
    hint: 'Record the handover when the customer collects the car and keys.',
    primary: { modal: 'handover', label: 'Hand over car', icon: <KeyRound className="h-4 w-4" /> },
  },
  HandedOver: {
    hint: 'Close the job to finish it.',
    primary: { modal: 'close', label: 'Close job', icon: <Flag className="h-4 w-4" /> },
  },
  Closed: { hint: 'This job is finished. Nothing more to do.' },
  Cancelled: { hint: 'This booking was cancelled.' },
};

const SEVERITY_OPTIONS = [
  { value: 'Info', label: 'Info only' },
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
  { value: 'Critical', label: 'Critical' },
];

function severityVariant(severity: string): BadgeVariant {
  switch (String(severity).toLowerCase()) {
    case 'critical':
    case 'high':
      return 'red';
    case 'medium':
      return 'amber';
    case 'low':
      return 'green';
    default:
      return 'blue';
  }
}

// API routes (GarageController) for actions whose route differs from the action key.
const JOB_ACTION_ROUTES: Record<string, string> = {
  'receive-vehicle': 'receive',
  'start-inspection': 'inspection/start',
  'complete-inspection': 'inspection/complete',
  'start-work': 'work/start',
  progress: 'work/progress',
  'complete-work': 'work/complete',
};

const SUCCESS_MESSAGES: Record<string, string> = {
  schedule: 'Job scheduled',
  'receive-vehicle': 'Car marked as received',
  'start-inspection': 'Inspection started',
  'complete-inspection': 'Inspection saved',
  'start-work': 'Work started',
  progress: 'Update posted',
  'complete-work': 'Work marked as done',
  'vehicle-ready': 'Customer told the car is ready',
  handover: 'Handover recorded',
  close: 'Job closed',
  cancel: 'Booking cancelled',
  'additional-work': 'Extra work sent to the advisor',
};

/** `<input type="datetime-local">` gives local wall-clock time; the API expects UTC. */
function localInputToUtcIso(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

/** What a new photo most likely shows at this point of the job. */
function mediaStageFor(status: string): MediaStage {
  if (['BookingConfirmed', 'Scheduled', 'VehicleReceived'].includes(status)) return 'Before';
  if (status === 'Inspection') return 'Inspection';
  if (status === 'WorkStarted' || status === 'WorkInProgress') return 'During';
  return 'After';
}

function Section({ title, action, children }: { title: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-base font-semibold text-navy-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function GarageJobDetailPage() {
  const params = useParams();
  const toast = useToast();
  const id = params?.id as string;

  const [job, setJob] = useState<GarageJob | null>(null);
  const [commission, setCommission] = useState<GarageCommission | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [activeModal, setActiveModal] = useState<ModalKey | null>(null);

  // Form states
  const [scheduleForm, setScheduleForm] = useState<ScheduleJobRequest>({
    scheduledStartAtUtc: '',
    estimatedCompletionAtUtc: '',
    notes: '',
  });

  const [receiveForm, setReceiveForm] = useState<ReceiveVehicleRequest>({
    currentMileageKm: undefined,
    notes: '',
  });

  const [startInspectionSeverity, setStartInspectionSeverity] = useState<InspectionSeverity>('Medium');

  const [completeInspectionForm, setCompleteInspectionForm] = useState<CompleteInspectionRequest>({
    findings: '',
    recommendations: '',
    customerVisibleSummary: '',
    severity: 'Medium',
  });

  const [startWorkNotes, setStartWorkNotes] = useState('');

  const [progressForm, setProgressForm] = useState<UpdateJobProgressRequest>({
    progressNotes: '',
    isCustomerVisible: true,
  });

  const [completeWorkForm, setCompleteWorkForm] = useState<CompleteWorkRequest>({
    notes: '',
    customerFacingNotes: '',
  });

  const [vehicleReadyNotes, setVehicleReadyNotes] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [closingRemarks, setClosingRemarks] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const [additionalWorkForm, setAdditionalWorkForm] = useState<CreateAdditionalWorkRequest>({
    description: '',
    estimatedAdditionalAmount: 0,
    reason: '',
  });

  async function loadJob() {
    setLoading(true);
    setErrorMsg(null);
    const res = await apiFetch<GarageJob>(`/garage/jobs/${id}`);
    if (res.success && res.data) {
      const loaded = res.data;
      setJob(loaded);
      if (AFTER_HANDOVER_STATUSES.includes(String(loaded.status))) {
        // The commission BroCo bills for this job once the car is handed back.
        const dues = await apiFetch<GarageCommission[]>('/garage/commission');
        setCommission(
          dues.success && Array.isArray(dues.data) ? dues.data.find((c) => c.serviceJobId === loaded.id) ?? null : null
        );
      } else {
        setCommission(null);
      }
    } else {
      setErrorMsg(res.message || 'Could not load this job.');
    }
    setLoading(false);
  }

  useEffect(() => {
    if (id) loadJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function openModal(key: ModalKey) {
    setErrorMsg(null);
    setActiveModal(key);
  }

  function closeModal() {
    if (actionLoading) return;
    setErrorMsg(null);
    setActiveModal(null);
  }

  async function handleAction(endpoint: string, payload: any) {
    setActionLoading(true);
    setErrorMsg(null);
    const res = await apiFetch(`/garage/jobs/${id}/${JOB_ACTION_ROUTES[endpoint] ?? endpoint}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.success) {
      setActiveModal(null);
      toast.success(SUCCESS_MESSAGES[endpoint] ?? 'Saved');
      await loadJob();
    } else {
      setErrorMsg(res.message || 'That did not work. Please try again.');
    }
    setActionLoading(false);
  }

  if (loading && !job) {
    return (
      <div>
        <PageHeader title="Service job" backHref="/garage/jobs" backLabel="Jobs" />
        <div className="space-y-3">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div>
        <PageHeader title="Service job" backHref="/garage/jobs" backLabel="Jobs" />
        <ErrorState title="Couldn’t load this job" error={errorMsg} onRetry={loadJob} />
      </div>
    );
  }

  const status = String(job.status);
  const isCancelled = status === 'Cancelled';
  const stageIndex = STAGES.findIndex((s) => s.statuses.includes(status));
  const currentStage = stageIndex >= 0 ? STAGES[stageIndex] : null;
  const next = NEXT_STEP[status];
  const canRequestExtraWork = status === 'WorkStarted' || status === 'WorkInProgress';
  const vehicleName = `${job.vehicleYear ?? ''} ${job.vehicleMake ?? ''} ${job.vehicleModel ?? ''}`.trim();

  const serviceValue = Number(job.serviceValue ?? 0);
  const advancePaid = Number(job.advancePaidAmount ?? 0);
  const balanceToCollect = Number(job.balanceToCollect ?? Math.max(0, serviceValue - advancePaid));
  const advancePct = serviceValue > 0 && advancePaid > 0 ? Math.round((advancePaid / serviceValue) * 100) : 10;
  const awaitingAdvance = job.isAdvancePaid === false && PRE_RECEIPT_STATUSES.includes(status);
  // The API refuses "Car received" until the advance is paid, so hold the button back.
  const receiveBlocked = awaitingAdvance && next?.primary?.modal === 'receive';
  const showPaymentCard = serviceValue > 0 || !!job.servicePackageName || job.isAdvancePaid !== undefined;

  /** Error shown inside the open sheet, so the mechanic sees why an action failed. */
  const modalError = errorMsg ? (
    <Alert type="error" className="mb-4">
      {errorMsg}
    </Alert>
  ) : null;

  const modalFooter = (confirm: ReactNode) => (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="outline" className="w-full sm:w-auto" disabled={actionLoading} onClick={closeModal}>
        Back
      </Button>
      {confirm}
    </div>
  );

  const scheduleInvalid =
    !scheduleForm.scheduledStartAtUtc ||
    !scheduleForm.estimatedCompletionAtUtc ||
    new Date(scheduleForm.estimatedCompletionAtUtc) <= new Date(scheduleForm.scheduledStartAtUtc);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        backHref="/garage/jobs"
        backLabel="Jobs"
        eyebrow={
          <>
            <StatusBadge status={job.status} />
            <span className="text-xs font-medium text-navy-500">{job.jobNumber}</span>
          </>
        }
        title={vehicleName || job.jobNumber}
        description={`Request ${job.requestNumber}${job.quotationNumber ? ` · Quote ${job.quotationNumber}` : ''}`}
      />

      <div className="space-y-5 sm:space-y-6">
        {/* Current stage */}
        <section
          className={`rounded-2xl border bg-white p-4 shadow-card sm:p-5 ${isCancelled ? 'border-red-200' : 'border-surface-200'}`}
          aria-label="Job progress"
        >
          {isCancelled ? (
            <>
              <div className="text-xs font-medium text-red-700">Cancelled{job.cancelledAtUtc ? ` · ${formatDateTime(job.cancelledAtUtc)}` : ''}</div>
              <div className="mt-1 text-lg font-bold text-navy-900">This booking was cancelled</div>
              {job.cancellationReason && <p className="mt-1 text-sm text-navy-600">{job.cancellationReason}</p>}
            </>
          ) : (
            <>
              <div className="text-xs font-medium text-navy-500">
                {stageIndex >= 0 ? `Step ${stageIndex + 1} of ${STAGES.length}` : 'Current stage'}
              </div>
              <div className="mt-1 text-lg font-bold text-navy-900">{currentStage?.label ?? humanize(status)}</div>
              <div className="mt-3 flex gap-1" aria-hidden="true">
                {STAGES.map((s, i) => (
                  <span
                    key={s.label}
                    className={`h-1.5 flex-1 rounded-full ${
                      i < stageIndex ? 'bg-electric-600' : i === stageIndex ? 'bg-electric-400' : 'bg-surface-200'
                    }`}
                  />
                ))}
              </div>
              {next && (
                <p className="mt-3 text-sm text-navy-600">
                  {receiveBlocked
                    ? 'Waiting for the customer to pay the 10% BroCo booking advance. You can receive the car once it’s paid.'
                    : next.hint}
                </p>
              )}

              <details className="group mt-3 border-t border-surface-200 pt-3">
                <summary className="flex min-h-[36px] cursor-pointer list-none items-center text-sm font-medium text-electric-700 [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">Show all steps</span>
                  <span className="hidden group-open:inline">Hide steps</span>
                </summary>
                <ol className="mt-2 space-y-2">
                  {STAGES.map((s, i) => {
                    const done = i < stageIndex;
                    const current = i === stageIndex;
                    const at = s.at?.(job);
                    return (
                      <li key={s.label} className="flex items-center gap-3 text-sm">
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                            done
                              ? 'bg-electric-600 text-white'
                              : current
                              ? 'border-2 border-electric-600 text-electric-700'
                              : 'border border-surface-300 text-navy-400'
                          }`}
                        >
                          {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                        </span>
                        <span className={`flex-1 ${current ? 'font-semibold text-navy-900' : done ? 'text-navy-700' : 'text-navy-400'}`}>
                          {s.label}
                        </span>
                        {at && (done || current) && <span className="text-xs text-navy-400">{formatDateTime(at)}</span>}
                      </li>
                    );
                  })}
                </ol>
              </details>
            </>
          )}
        </section>

        {/* Vehicle and customer */}
        <section className="rounded-2xl border border-surface-200 bg-white p-4 shadow-card sm:p-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-navy-500">Number plate</dt>
              <dd className="font-semibold text-navy-900">{job.vehicleLicensePlate || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-navy-500">Odometer at drop-off</dt>
              <dd className="font-medium text-navy-900">
                {job.currentMileageKm != null ? `${job.currentMileageKm.toLocaleString('en-IN')} km` : 'Not recorded'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-navy-500">Drop-off</dt>
              <dd className="font-medium text-navy-900">
                {job.scheduledStartAtUtc ? formatDateTime(job.scheduledStartAtUtc) : 'Not scheduled'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-navy-500">Ready by</dt>
              <dd className="font-medium text-navy-900">
                {job.estimatedCompletionAtUtc ? formatDateTime(job.estimatedCompletionAtUtc) : '—'}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-surface-200 pt-3">
            <div className="min-w-0">
              <div className="text-xs text-navy-500">Customer</div>
              <div className="truncate text-sm font-semibold text-navy-900">{job.customerName || '—'}</div>
            </div>
            {job.customerPhone && (
              <a
                href={`tel:${job.customerPhone.replace(/\s+/g, '')}`}
                className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border border-surface-300 bg-white px-4 text-sm font-semibold text-navy-800 transition hover:bg-surface-50"
              >
                <Phone className="h-4 w-4" />
                Call
              </a>
            )}
          </div>
        </section>

        {/* Payment */}
        {showPaymentCard && !isCancelled && (
          <Section title="Payment">
            <div className="space-y-3 rounded-2xl border border-surface-200 bg-white p-4 text-sm shadow-card sm:p-5">
              {job.servicePackageName && (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="blue" pill icon={Package}>
                    Package
                  </Badge>
                  <span className="font-semibold text-navy-900">{job.servicePackageName}</span>
                </div>
              )}
              <dl className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-navy-500">Service value</dt>
                  <dd className="font-semibold tabular-nums text-navy-900">{formatINR(serviceValue)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-navy-500">Customer pays you at handover</dt>
                  <dd className="font-medium tabular-nums text-navy-900">{formatINR(balanceToCollect)}</dd>
                </div>
              </dl>

              {job.isAdvancePaid ? (
                <p className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-emerald-900">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    Customer paid BroCo {formatINR(advancePaid)} ({advancePct}%) online.
                  </span>
                </p>
              ) : awaitingAdvance ? (
                <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-amber-900">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    Waiting for the customer’s 10% advance. You can’t receive the car until it’s paid.
                  </span>
                </p>
              ) : (
                <p className="text-xs text-navy-500">No online BroCo advance was recorded for this job.</p>
              )}

              {COLLECT_STATUSES.includes(status) && balanceToCollect > 0 && (
                <p className="flex items-start gap-2 rounded-xl bg-electric-50 p-3 font-medium text-electric-900">
                  <IndianRupee className="mt-0.5 h-4 w-4 shrink-0 text-electric-600" />
                  <span>Collect {formatINR(balanceToCollect)} from the customer at handover.</span>
                </p>
              )}

              {AFTER_HANDOVER_STATUSES.includes(status) &&
                (commission ? (
                  commission.status === 'Due' ? (
                    <div
                      className={`flex flex-col gap-2 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between ${
                        commission.isOverdue ? 'bg-red-50 text-red-900' : 'bg-amber-50 text-amber-900'
                      }`}
                    >
                      <span>
                        BroCo commission <strong className="tabular-nums">{formatINR(commission.totalDue)}</strong> is {commission.isOverdue ? 'overdue' : 'now due'} — pay from Commission.
                      </span>
                      <Link
                        href="/garage/commission"
                        className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl bg-white px-4 font-semibold text-navy-900 shadow-sm ring-1 ring-surface-200 hover:bg-surface-50"
                      >
                        Pay commission
                      </Link>
                    </div>
                  ) : (
                    <p className="text-xs text-navy-500">
                      BroCo commission {formatINR(commission.totalDue)}{' '}
                      {commission.status === 'Paid'
                        ? `paid${commission.paidAtUtc ? ` on ${formatDateTime(commission.paidAtUtc)}` : ''}.`
                        : 'waived.'}
                    </p>
                  )
                ) : (
                  status === 'HandedOver' && (
                    <p className="text-sm text-navy-600">
                      BroCo commission for this job is now due —{' '}
                      <Link href="/garage/commission" className="font-semibold text-electric-700 hover:underline">
                        pay from Commission
                      </Link>
                      .
                    </p>
                  )
                ))}
            </div>
          </Section>
        )}

        {/* Customer's problem */}
        <Section title="Customer’s problem">
          <div className="space-y-3 rounded-2xl border border-surface-200 bg-white p-4 text-sm shadow-card sm:p-5">
            <PickupSummary needsPickup={job.needsPickup} pickupNotes={job.pickupNotes} pickupSlot={job.pickupSlot} />
            <p className="whitespace-pre-wrap text-navy-800">{job.problemDescription || 'Not described.'}</p>
            {job.customerComplaintSnapshot && job.customerComplaintSnapshot !== job.problemDescription && (
              <div className="border-t border-surface-200 pt-3">
                <div className="text-xs text-navy-500">Complaint when booked</div>
                <p className="mt-0.5 whitespace-pre-wrap text-navy-800">{job.customerComplaintSnapshot}</p>
              </div>
            )}
            {job.customerFacingNotes && (
              <div className="rounded-xl bg-emerald-50 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-800">
                  <Eye className="h-3.5 w-3.5" /> Latest note to the customer
                </div>
                <p className="mt-0.5 text-emerald-900">{job.customerFacingNotes}</p>
              </div>
            )}
            {job.garageInternalNotes && (
              <div className="rounded-xl bg-surface-50 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-navy-600">
                  <Lock className="h-3.5 w-3.5" /> Workshop notes (internal)
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-navy-800">{job.garageInternalNotes}</p>
              </div>
            )}
          </div>
        </Section>

        {/* Inspection */}
        <Section title="Inspection">
          {job.inspections && job.inspections.length > 0 ? (
            <div className="space-y-3">
              {job.inspections.map((insp) => (
                <div key={insp.id} className="space-y-3 rounded-2xl border border-surface-200 bg-white p-4 text-sm shadow-card sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-xs text-navy-500">
                      <div className="font-medium text-navy-800">{insp.inspectorName}</div>
                      {insp.inspectionCompletedAtUtc
                        ? `Finished ${formatDateTime(insp.inspectionCompletedAtUtc)}`
                        : `Started ${formatDateTime(insp.inspectionStartedAtUtc)} · in progress`}
                    </div>
                    <Badge variant={severityVariant(String(insp.overallSeverity))} pill className="whitespace-nowrap">
                      {humanize(String(insp.overallSeverity))} severity
                    </Badge>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-navy-600">
                      <Lock className="h-3.5 w-3.5" /> Findings (workshop and advisor only)
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-navy-800">{insp.findings || 'None recorded.'}</p>
                  </div>
                  {insp.recommendations && (
                    <div>
                      <div className="text-xs font-medium text-navy-600">Recommendations</div>
                      <p className="mt-0.5 whitespace-pre-wrap text-navy-800">{insp.recommendations}</p>
                    </div>
                  )}
                  <div className="rounded-xl bg-emerald-50 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-800">
                      <Eye className="h-3.5 w-3.5" /> Summary for the customer
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-emerald-900">
                      {insp.customerVisibleSummary || 'Not written yet.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-surface-300 bg-white p-4 text-sm text-navy-500">
              No inspection recorded yet.
            </p>
          )}
        </Section>

        {/* Photos & videos */}
        <ServiceMediaSection jobId={job.id} audience="garage" variant="section" defaultStage={mediaStageFor(status)} />

        {/* Additional work */}
        <Section
          title="Extra work"
          action={
            canRequestExtraWork ? (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<PlusCircle className="h-4 w-4" />}
                onClick={() => openModal('additionalWork')}
              >
                Request
              </Button>
            ) : undefined
          }
        >
          {job.additionalWorkRequests && job.additionalWorkRequests.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-card divide-y divide-surface-200/80">
              {job.additionalWorkRequests.map((work) => (
                <div key={work.id} className="space-y-1 px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-[15px] font-semibold text-navy-900 break-words">{work.description}</div>
                    <div className="shrink-0 font-semibold tabular-nums text-navy-900">
                      {formatINR(work.estimatedAdditionalAmount)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={work.status} />
                    <span className="text-xs text-navy-400">Asked {formatDateTime(work.createdAtUtc)}</span>
                  </div>
                  {work.reason && <p className="text-navy-600">{work.reason}</p>}
                  {work.advisorRemarks && (
                    <p className="text-xs text-navy-500">
                      <span className="font-medium text-navy-700">Advisor:</span> {work.advisorRemarks}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-surface-300 bg-white p-4 text-sm text-navy-500">
              {canRequestExtraWork
                ? 'Found something else that needs fixing? Request it here. The advisor approves it before you do the work; the quote is not changed automatically.'
                : 'No extra work requested.'}
            </p>
          )}
        </Section>

        {/* Activity */}
        <Section title="Activity">
          {job.activities && job.activities.length > 0 ? (
            <ol className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-card divide-y divide-surface-200/80">
              {job.activities.map((act) => (
                <li key={act.id} className="px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-navy-900">{humanize(act.activityType)}</span>
                    <span className="shrink-0 text-xs text-navy-400">{formatDateTime(act.createdAtUtc)}</span>
                  </div>
                  <p className="mt-0.5 text-navy-700 break-words">{act.message}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-navy-400">
                    <span>{act.actorName}</span>
                    {act.isCustomerVisible ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <Eye className="h-3 w-3" /> Customer can see
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Internal
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-2xl border border-dashed border-surface-300 bg-white p-4 text-sm text-navy-500">No activity yet.</p>
          )}
        </Section>
      </div>

      {/* Next action */}
      {next?.primary && (
        <>
          <ActionBar>
            {next.secondary && (
              <Button
                variant="outline"
                onClick={() => openModal(next.secondary!.modal)}
                disabled={actionLoading}
                className={next.secondary.modal === 'cancel' ? '!text-red-700' : ''}
              >
                {next.secondary.label}
              </Button>
            )}
            <Button
              onClick={() => openModal(next.primary!.modal)}
              disabled={actionLoading || receiveBlocked}
              title={receiveBlocked ? 'Waiting for the customer’s 10% advance' : undefined}
              // Icon only when the button has the bar to itself; two labelled buttons fit 375px without them.
              leftIcon={next.secondary ? undefined : next.primary.icon}
            >
              {next.primary.label}
            </Button>
          </ActionBar>
          <ActionBarSpacer />
        </>
      )}

      {/* ===== Sheets ===== */}

      <Modal
        isOpen={activeModal === 'schedule'}
        onClose={closeModal}
        title="Schedule the job"
        description={`When will ${job.vehicleLicensePlate || 'the car'} come in, and when will it be ready?`}
        footer={modalFooter(
          <Button
            className="w-full sm:w-auto"
            isLoading={actionLoading}
            disabled={scheduleInvalid}
            onClick={() =>
              handleAction('schedule', {
                ...scheduleForm,
                scheduledStartAtUtc: localInputToUtcIso(scheduleForm.scheduledStartAtUtc),
                estimatedCompletionAtUtc: localInputToUtcIso(scheduleForm.estimatedCompletionAtUtc),
              })
            }
          >
            Save schedule
          </Button>
        )}
      >
        {modalError}
        <div className="space-y-4">
          <Input
            id="schedule-start"
            type="datetime-local"
            label="Drop-off"
            required
            value={scheduleForm.scheduledStartAtUtc}
            onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledStartAtUtc: e.target.value })}
          />
          <Input
            id="schedule-ready"
            type="datetime-local"
            label="Ready by"
            required
            value={scheduleForm.estimatedCompletionAtUtc}
            onChange={(e) => setScheduleForm({ ...scheduleForm, estimatedCompletionAtUtc: e.target.value })}
            error={
              scheduleForm.scheduledStartAtUtc &&
              scheduleForm.estimatedCompletionAtUtc &&
              new Date(scheduleForm.estimatedCompletionAtUtc) <= new Date(scheduleForm.scheduledStartAtUtc)
                ? 'Must be after drop-off.'
                : undefined
            }
          />
          <Textarea
            id="schedule-notes"
            label="Notes (optional)"
            rows={2}
            value={scheduleForm.notes}
            onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
            placeholder="e.g. Customer drops the car before 10 am"
          />
        </div>
      </Modal>

      <Modal
        isOpen={activeModal === 'receive'}
        onClose={closeModal}
        title="Car received"
        description="Confirm the car is at the workshop. After this the customer can no longer cancel."
        footer={modalFooter(
          <Button
            className="w-full sm:w-auto"
            isLoading={actionLoading}
            onClick={() => handleAction('receive-vehicle', receiveForm)}
          >
            Confirm received
          </Button>
        )}
      >
        {modalError}
        <div className="space-y-4">
          <Input
            id="receive-odometer"
            type="number"
            inputMode="numeric"
            min="0"
            label="Odometer (km)"
            value={receiveForm.currentMileageKm ?? ''}
            onChange={(e) =>
              setReceiveForm({
                ...receiveForm,
                currentMileageKm: e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
            placeholder="e.g. 45200"
          />
          <Textarea
            id="receive-notes"
            label="Condition notes"
            rows={3}
            value={receiveForm.notes}
            onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })}
            placeholder="Dents, fuel level, items left in the car…"
          />
        </div>
      </Modal>

      <Modal
        isOpen={activeModal === 'startInspection'}
        onClose={closeModal}
        title="Start inspection"
        description={`Begin checking ${job.vehicleLicensePlate || 'the car'}. You can change the severity when you finish.`}
        footer={modalFooter(
          <Button
            className="w-full sm:w-auto"
            isLoading={actionLoading}
            onClick={() => handleAction('start-inspection', { severity: startInspectionSeverity })}
          >
            Start inspection
          </Button>
        )}
      >
        {modalError}
        <Select
          id="start-inspection-severity"
          label="First impression of severity"
          options={SEVERITY_OPTIONS}
          value={startInspectionSeverity}
          onChange={(e) => setStartInspectionSeverity(e.target.value as InspectionSeverity)}
        />
      </Modal>

      <Modal
        isOpen={activeModal === 'completeInspection'}
        onClose={closeModal}
        title="Inspection findings"
        description="Findings and recommendations stay between you and the advisor. The summary is shown to the customer."
        footer={modalFooter(
          <Button
            className="w-full sm:w-auto"
            isLoading={actionLoading}
            onClick={() => handleAction('complete-inspection', completeInspectionForm)}
          >
            Save and finish
          </Button>
        )}
      >
        {modalError}
        <div className="space-y-4">
          <Select
            id="complete-inspection-severity"
            label="Overall severity"
            options={SEVERITY_OPTIONS}
            value={completeInspectionForm.severity}
            onChange={(e) =>
              setCompleteInspectionForm({ ...completeInspectionForm, severity: e.target.value as InspectionSeverity })
            }
          />
          <Textarea
            id="complete-inspection-findings"
            label="Findings (internal)"
            rows={3}
            value={completeInspectionForm.findings}
            onChange={(e) => setCompleteInspectionForm({ ...completeInspectionForm, findings: e.target.value })}
            placeholder="What you checked and what you found"
          />
          <Textarea
            id="complete-inspection-recommendations"
            label="Recommendations (internal)"
            rows={2}
            value={completeInspectionForm.recommendations}
            onChange={(e) => setCompleteInspectionForm({ ...completeInspectionForm, recommendations: e.target.value })}
            placeholder="Repairs or parts needed"
          />
          <Textarea
            id="complete-inspection-summary"
            label="Summary for the customer"
            rows={2}
            value={completeInspectionForm.customerVisibleSummary}
            onChange={(e) =>
              setCompleteInspectionForm({ ...completeInspectionForm, customerVisibleSummary: e.target.value })
            }
            placeholder="Plain words, no jargon"
          />
        </div>
      </Modal>

      <Modal
        isOpen={activeModal === 'startWork'}
        onClose={closeModal}
        title="Start work"
        description="Mark that repairs or servicing have begun on the car."
        footer={modalFooter(
          <Button
            className="w-full sm:w-auto"
            isLoading={actionLoading}
            onClick={() => handleAction('start-work', { notes: startWorkNotes })}
          >
            Start work
          </Button>
        )}
      >
        {modalError}
        <Textarea
          id="start-work-notes"
          label="Notes (optional)"
          rows={2}
          value={startWorkNotes}
          onChange={(e) => setStartWorkNotes(e.target.value)}
          placeholder="Mechanic, bay number…"
        />
      </Modal>

      <Modal
        isOpen={activeModal === 'progress'}
        onClose={closeModal}
        title="Add an update"
        footer={modalFooter(
          <Button
            className="w-full sm:w-auto"
            isLoading={actionLoading}
            disabled={!progressForm.progressNotes.trim()}
            onClick={() => handleAction('progress', progressForm)}
          >
            Post update
          </Button>
        )}
      >
        {modalError}
        <div className="space-y-4">
          <Textarea
            id="progress-notes"
            label="What’s been done"
            required
            rows={3}
            value={progressForm.progressNotes}
            onChange={(e) => setProgressForm({ ...progressForm, progressNotes: e.target.value })}
            placeholder="e.g. Oil drained, new filter fitted"
          />
          <Checkbox
            id="progress-customer-visible"
            label="Show this update to the customer"
            checked={progressForm.isCustomerVisible}
            onChange={(e) => setProgressForm({ ...progressForm, isCustomerVisible: e.target.checked })}
          />
        </div>
      </Modal>

      <Modal
        isOpen={activeModal === 'completeWork'}
        onClose={closeModal}
        title="Work done"
        description="Confirm all agreed and approved work is finished."
        footer={modalFooter(
          <Button
            className="w-full sm:w-auto"
            isLoading={actionLoading}
            onClick={() => handleAction('complete-work', completeWorkForm)}
          >
            Mark work done
          </Button>
        )}
      >
        {modalError}
        <div className="space-y-4">
          <Textarea
            id="complete-work-notes"
            label="Workshop notes (internal)"
            rows={2}
            value={completeWorkForm.notes}
            onChange={(e) => setCompleteWorkForm({ ...completeWorkForm, notes: e.target.value })}
            placeholder="Test drive done, torque checked…"
          />
          <Textarea
            id="complete-work-customer-notes"
            label="Note for the customer"
            rows={2}
            value={completeWorkForm.customerFacingNotes}
            onChange={(e) => setCompleteWorkForm({ ...completeWorkForm, customerFacingNotes: e.target.value })}
            placeholder="e.g. All work finished, car being washed"
          />
        </div>
      </Modal>

      <Modal
        isOpen={activeModal === 'vehicleReady'}
        onClose={closeModal}
        title="Ready for pickup"
        description="The customer and advisor are told the car can be collected."
        footer={modalFooter(
          <Button
            className="w-full sm:w-auto"
            isLoading={actionLoading}
            onClick={() => handleAction('vehicle-ready', { customerFacingNotes: vehicleReadyNotes })}
          >
            Notify customer
          </Button>
        )}
      >
        {modalError}
        <Textarea
          id="vehicle-ready-notes"
          label="Note for the customer"
          rows={2}
          value={vehicleReadyNotes}
          onChange={(e) => setVehicleReadyNotes(e.target.value)}
          placeholder="e.g. Ready to collect until 7 pm"
        />
      </Modal>

      <Modal
        isOpen={activeModal === 'handover'}
        onClose={closeModal}
        title="Hand over the car"
        description={
          balanceToCollect > 0
            ? `Collect ${formatINR(balanceToCollect)} from the customer, then confirm the car and keys are back with them. BroCo’s commission for this job becomes due after handover.`
            : 'Confirm the car and keys are back with the customer.'
        }
        footer={modalFooter(
          <Button className="w-full sm:w-auto" isLoading={actionLoading} onClick={() => handleAction('handover', { handoverNotes })}>
            Confirm handover
          </Button>
        )}
      >
        {modalError}
        <Textarea
          id="handover-notes"
          label="Notes (optional)"
          rows={2}
          value={handoverNotes}
          onChange={(e) => setHandoverNotes(e.target.value)}
          placeholder="e.g. Keys handed to the owner"
        />
      </Modal>

      <Modal
        isOpen={activeModal === 'close'}
        onClose={closeModal}
        title="Close the job"
        description="This is the last step. The job can’t be changed after closing."
        footer={modalFooter(
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            isLoading={actionLoading}
            onClick={() => handleAction('close', { closingRemarks })}
          >
            Close job
          </Button>
        )}
      >
        {modalError}
        <Textarea
          id="close-remarks"
          label="Closing notes (optional)"
          rows={2}
          value={closingRemarks}
          onChange={(e) => setClosingRemarks(e.target.value)}
        />
      </Modal>

      <Modal
        isOpen={activeModal === 'cancel'}
        onClose={closeModal}
        title="Cancel this booking?"
        description="You can only cancel before the car arrives. The customer and advisor will be told."
        footer={modalFooter(
          <Button
            variant="danger"
            className="w-full sm:w-auto"
            isLoading={actionLoading}
            disabled={!cancelReason.trim()}
            onClick={() => handleAction('cancel', { reason: cancelReason })}
          >
            Cancel booking
          </Button>
        )}
      >
        {modalError}
        <Textarea
          id="cancel-reason"
          label="Reason"
          required
          rows={3}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Why can’t you do this job?"
        />
      </Modal>

      <Modal
        isOpen={activeModal === 'additionalWork'}
        onClose={closeModal}
        title="Request extra work"
        description="Sent to the advisor for approval. Don’t start it until it’s approved."
        footer={modalFooter(
          <Button
            className="w-full sm:w-auto"
            isLoading={actionLoading}
            disabled={!additionalWorkForm.description.trim() || additionalWorkForm.estimatedAdditionalAmount <= 0}
            onClick={() => handleAction('additional-work', additionalWorkForm)}
          >
            Send to advisor
          </Button>
        )}
      >
        {modalError}
        <div className="space-y-4">
          <Input
            id="extra-work-description"
            label="What needs doing"
            required
            value={additionalWorkForm.description}
            onChange={(e) => setAdditionalWorkForm({ ...additionalWorkForm, description: e.target.value })}
            placeholder="e.g. Replace front brake pads"
          />
          <Input
            id="extra-work-amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            label="Estimated cost (₹)"
            required
            value={additionalWorkForm.estimatedAdditionalAmount || ''}
            onChange={(e) =>
              setAdditionalWorkForm({ ...additionalWorkForm, estimatedAdditionalAmount: parseFloat(e.target.value) || 0 })
            }
            placeholder="e.g. 1800"
            helperText={
              additionalWorkForm.estimatedAdditionalAmount > 0
                ? formatINR(additionalWorkForm.estimatedAdditionalAmount)
                : undefined
            }
          />
          <Textarea
            id="extra-work-reason"
            label="Why it’s needed"
            rows={2}
            value={additionalWorkForm.reason}
            onChange={(e) => setAdditionalWorkForm({ ...additionalWorkForm, reason: e.target.value })}
            placeholder="e.g. Pads down to 2 mm, rotor worn unevenly"
          />
        </div>
      </Modal>
    </div>
  );
}
