'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { AdminRequestOperationalDetail } from '@/types/adminOperations';
import { PickupSummary } from '@/components/booking/PickupSummary';
import { CarFront, CheckCircle2, ClipboardList, Tag, Wrench, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { ListGroup, ListItem } from '@/components/ui/ListItem';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ServiceMediaSection } from '@/components/media/ServiceMediaSection';
import { formatDate, formatDateTime, formatINR, formatRelative, humanize } from '@/lib/format';

const outlineLink =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-surface-300 bg-white px-4 text-sm font-semibold text-navy-800 transition hover:bg-surface-50';

const Section: React.FC<{
  title: string;
  icon: React.ElementType;
  aside?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon: Icon, aside, children }) => (
  <Card className="p-4 sm:p-5">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold text-navy-900">
        <Icon className="h-4 w-4 shrink-0 text-navy-400" aria-hidden="true" />
        <span className="truncate">{title}</span>
      </h2>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
    {children}
  </Card>
);

const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
  <div className={`min-w-0 ${className}`}>
    <dt className="text-xs text-navy-500">{label}</dt>
    <dd className="mt-0.5 break-words text-sm font-medium text-navy-900">{children}</dd>
  </div>
);

// ListItem truncates its lines; some rows need the full text.
const Wrap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="block whitespace-normal break-words">{children}</span>
);

const Muted: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="text-sm text-navy-500">{children}</p>;

export default function AdminRequestTimelinePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [data, setData] = useState<AdminRequestOperationalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRequestDetail = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<AdminRequestOperationalDetail>(`/admin/requests/${id}`);
    if (res.success && res.data) {
      setData(res.data);
      setError(null);
    } else {
      setError(res.message || 'Failed to load request timeline.');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadRequestDetail();
  }, [loadRequestDetail]);

  if (loading) {
    return <LoadingState message="Loading request..." />;
  }

  if (error || !data) {
    return (
      <div>
        <PageHeader title="Service request" backHref="/admin/requests" backLabel="Service requests" />
        <ErrorState
          title="Could not load this request"
          error={error || 'Request not found.'}
          onRetry={loadRequestDetail}
          action={
            <Link href="/admin/requests" className="text-sm font-medium text-electric-600 hover:text-electric-700">
              Back to requests
            </Link>
          }
        />
      </div>
    );
  }

  const assignment = data.currentAssignment;
  const quotation = data.customerQuotation;
  const decision = data.customerDecision;
  const job = data.serviceJob;
  const accepted = decision ? String(decision.decision).toUpperCase() === 'ACCEPTED' : false;
  const hasCoordinates = typeof data.customerLatitude === 'number' && typeof data.customerLongitude === 'number';

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        backHref="/admin/requests"
        backLabel="Service requests"
        eyebrow={
          <>
            <span className="font-mono text-xs font-semibold text-navy-500">{data.requestNumber}</span>
            <StatusBadge status={data.status} />
          </>
        }
        title={`${data.vehicleMake} ${data.vehicleModel}`}
        description={`${data.customerName} · created ${formatDateTime(data.createdAtUtc)}`}
        actions={
          <Link href={`/admin/customers/${data.customerId}`} className={outlineLink}>
            Customer profile
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
        {/* Who, what, where — first on phones, right-hand column on laptops */}
        <div className="space-y-5 lg:order-2">
          <Section title="Problem" icon={ClipboardList}>
            <p className="whitespace-pre-line break-words text-sm leading-relaxed text-navy-800">
              {data.problemDescription || 'No description given.'}
            </p>
            {data.serviceCategory && (
              <p className="mt-2 break-words text-xs text-navy-500">Services: {data.serviceCategory}</p>
            )}
            <PickupSummary className="mt-3" needsPickup={data.needsPickup} pickupNotes={data.pickupNotes} pickupSlot={data.pickupSlot} />
          </Section>

          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 text-base font-semibold text-navy-900">Customer</h2>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <Field label="Name">{data.customerName}</Field>
              <Field label="Phone">
                {data.customerPhone ? (
                  <a href={`tel:${data.customerPhone}`} className="text-electric-600 hover:underline">
                    {data.customerPhone}
                  </a>
                ) : (
                  '—'
                )}
              </Field>
              <Field label="Email" className="sm:col-span-2 lg:col-span-1">
                {data.customerEmail ? (
                  <a href={`mailto:${data.customerEmail}`} className="text-electric-600 hover:underline">
                    {data.customerEmail}
                  </a>
                ) : (
                  '—'
                )}
              </Field>
            </dl>

            <h2 className="mb-3 mt-5 border-t border-surface-200 pt-4 text-base font-semibold text-navy-900">Vehicle</h2>
            <dl className="grid grid-cols-2 gap-3">
              <Field label="Make and model">
                {data.vehicleMake} {data.vehicleModel}
              </Field>
              <Field label="Number plate">
                <span className="font-mono">{data.vehicleLicensePlate}</span>
              </Field>
            </dl>

            <h2 className="mb-3 mt-5 border-t border-surface-200 pt-4 text-base font-semibold text-navy-900">Location</h2>
            <dl className="grid grid-cols-1 gap-3">
              <Field label="Address">{data.customerAddress || 'No address saved'}</Field>
              {hasCoordinates && (
                <Field label="Coordinates">
                  <span className="font-mono text-xs">
                    {data.customerLatitude.toFixed(4)}, {data.customerLongitude.toFixed(4)}
                  </span>
                </Field>
              )}
            </dl>

            <h2 className="mb-3 mt-5 border-t border-surface-200 pt-4 text-base font-semibold text-navy-900">Advisor</h2>
            {data.assignedAdvisorName ? (
              <dl className="grid grid-cols-1 gap-3">
                <Field label="Name">{data.assignedAdvisorName}</Field>
                {data.assignedAdvisorEmail && (
                  <Field label="Email">
                    <a href={`mailto:${data.assignedAdvisorEmail}`} className="text-electric-600 hover:underline">
                      {data.assignedAdvisorEmail}
                    </a>
                  </Field>
                )}
              </dl>
            ) : (
              <Muted>No advisor assigned yet.</Muted>
            )}
          </Card>
        </div>

        {/* Progress */}
        <div className="space-y-5 lg:order-1 lg:col-span-2">
          {/* Garages notified */}
          <ListGroup title={`Garages notified (${data.dispatchedGarages.length})`}>
            {data.dispatchedGarages.length === 0 ? (
              <ListItem title="No garages notified yet" />
            ) : (
              data.dispatchedGarages.map((g) => (
                <ListItem
                  key={g.garageId}
                  href={`/admin/garages/${g.garageId}`}
                  title={g.garageName}
                  subtitle={`${g.distanceKm} km away${g.garagePhone ? ` · ${g.garagePhone}` : ''}`}
                  meta={
                    g.declineReason ? (
                      <Wrap>Declined: {g.declineReason}</Wrap>
                    ) : g.respondedAtUtc ? (
                      `Responded ${formatRelative(g.respondedAtUtc)}`
                    ) : (
                      `Notified ${formatRelative(g.createdAtUtc)}`
                    )
                  }
                  trailing={<StatusBadge status={g.status} />}
                />
              ))
            )}
          </ListGroup>

          {/* Garage quotes */}
          <ListGroup title={`Garage quotes (${data.quotesReceived.length})`}>
            {data.quotesReceived.length === 0 ? (
              <ListItem title="No quotes received yet" />
            ) : (
              data.quotesReceived.map((q) => (
                <ListItem
                  key={q.quoteId}
                  title={q.garageName}
                  subtitle={
                    <>
                      <span className="font-mono">{q.quoteNumber}</span> · {q.lineItems.length}{' '}
                      {q.lineItems.length === 1 ? 'item' : 'items'}
                    </>
                  }
                  meta={`Valid until ${formatDate(q.validUntil)} · sent ${formatRelative(q.submittedAtUtc)}`}
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums text-navy-900">{formatINR(q.totalAmount, q.currency)}</span>
                      <StatusBadge status={q.status} />
                    </div>
                  }
                />
              ))
            )}
          </ListGroup>

          {/* Assignment */}
          <Section
            title="Garage assignment"
            icon={CarFront}
            aside={assignment ? <StatusBadge status={assignment.status} /> : undefined}
          >
            {assignment ? (
              <dl className="grid grid-cols-2 gap-3">
                <Field label="Garage" className="col-span-2 sm:col-span-1">
                  <Link href={`/admin/garages/${assignment.garageId}`} className="text-electric-600 hover:underline">
                    {assignment.garageName}
                  </Link>
                </Field>
                <Field label="Based on quote">
                  <span className="font-mono">{assignment.selectedQuoteNumber}</span>
                </Field>
                <Field label="Assigned">{formatDateTime(assignment.assignedAtUtc)}</Field>
                <Field label="Confirmed">{assignment.confirmedAtUtc ? formatDateTime(assignment.confirmedAtUtc) : 'Not yet'}</Field>
                {assignment.assignmentReason && (
                  <Field label="Reason" className="col-span-2">
                    {assignment.assignmentReason}
                  </Field>
                )}
              </dl>
            ) : (
              <Muted>No garage has been assigned yet.</Muted>
            )}

            {data.advisorNotes.length > 0 && (
              <div className="mt-4 border-t border-surface-200 pt-4">
                <h3 className="mb-2 text-sm font-semibold text-navy-900">Advisor notes</h3>
                <ul className="space-y-2">
                  {data.advisorNotes.map((note) => (
                    <li key={note.id} className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs text-navy-500">
                        <span className="font-semibold text-navy-800">{note.advisorName}</span>
                        <span>{formatDateTime(note.createdAtUtc)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-line break-words text-sm text-navy-800">{note.note}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          {/* Customer quotation and decision */}
          <Section
            title="Customer quotation"
            icon={Tag}
            aside={quotation ? <StatusBadge status={quotation.status} /> : undefined}
          >
            {quotation ? (
              <dl className="grid grid-cols-2 gap-3">
                <Field label="Customer total">
                  <span className="text-base font-bold tabular-nums">{formatINR(quotation.totalAmount)}</span>
                </Field>
                {/* A rupee amount (quotes made before markup was removed); new quotes carry none. */}
                {quotation.platformMarginPercentage > 0 && (
                  <Field label="Advisor markup (legacy)">{formatINR(quotation.platformMarginPercentage)}</Field>
                )}
                <Field label="Quotation">
                  <span className="font-mono">{quotation.quotationNumber}</span> · v{quotation.currentVersionNumber}
                </Field>
                <Field label="Valid until">{formatDate(quotation.expiresAtUtc)}</Field>
                <Field label="Sent to customer">
                  {quotation.sentToCustomerAtUtc ? formatDateTime(quotation.sentToCustomerAtUtc) : 'Not sent yet'}
                </Field>
              </dl>
            ) : (
              <Muted>No quotation has been prepared for the customer yet.</Muted>
            )}

            {decision && (
              <div
                className={`mt-4 rounded-xl border p-3 ${
                  accepted ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                    {accepted ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" aria-hidden="true" />
                    )}
                    Customer {accepted ? 'accepted' : 'declined'}
                  </span>
                  <span className="text-xs text-navy-500">{formatDateTime(decision.decidedAtUtc)}</span>
                </div>
                {(decision.decisionCategory || decision.decisionReason) && (
                  <p className="mt-1.5 break-words text-sm text-navy-700">
                    {decision.decisionCategory && <>{humanize(decision.decisionCategory)}</>}
                    {decision.decisionCategory && decision.decisionReason && ': '}
                    {decision.decisionReason}
                  </p>
                )}
              </div>
            )}
          </Section>

          {/* Service job */}
          <Section title="Service job" icon={Wrench} aside={job ? <StatusBadge status={job.status} /> : undefined}>
            {job ? (
              <>
                <p className="mb-3 text-sm text-navy-600">
                  <span className="font-mono font-semibold text-navy-900">{job.jobNumber}</span> ·{' '}
                  {job.activitiesCount} {job.activitiesCount === 1 ? 'update' : 'updates'} ·{' '}
                  {job.additionalWorkRequestsCount} extra work{' '}
                  {job.additionalWorkRequestsCount === 1 ? 'request' : 'requests'}
                  {job.overallSeverity && <> · inspection: {humanize(job.overallSeverity)}</>}
                </p>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Scheduled">{job.scheduledStartAtUtc ? formatDateTime(job.scheduledStartAtUtc) : 'Not yet'}</Field>
                  <Field label="Car received">{job.vehicleReceivedAtUtc ? formatDateTime(job.vehicleReceivedAtUtc) : 'Not yet'}</Field>
                  <Field label="Work started">{job.workStartedAtUtc ? formatDateTime(job.workStartedAtUtc) : 'Not yet'}</Field>
                  <Field label="Work completed">{job.workCompletedAtUtc ? formatDateTime(job.workCompletedAtUtc) : 'Not yet'}</Field>
                  <Field label="Handed over">{job.vehicleHandedOverAtUtc ? formatDateTime(job.vehicleHandedOverAtUtc) : 'Not yet'}</Field>
                  <Field label="Closed">{job.closedAtUtc ? formatDateTime(job.closedAtUtc) : 'Not yet'}</Field>
                </dl>
              </>
            ) : (
              <Muted>No job yet. A job is created once the customer confirms the booking.</Muted>
            )}
          </Section>

          {/* Photos & videos */}
          <ServiceMediaSection requestId={id} audience="staff" />

          {/* Activity log */}
          <ListGroup title={`Activity (${data.timelineEvents.length})`}>
            {data.timelineEvents.length === 0 ? (
              <ListItem title="No activity recorded yet" />
            ) : (
              data.timelineEvents.map((evt) => (
                <ListItem
                  key={evt.id}
                  title={humanize(evt.action)}
                  subtitle={evt.details ? <Wrap>{evt.details}</Wrap> : undefined}
                  meta={`${evt.userEmail || 'System'} · ${formatDateTime(evt.timestampUtc)}`}
                />
              ))
            )}
          </ListGroup>
        </div>
      </div>
    </div>
  );
}
