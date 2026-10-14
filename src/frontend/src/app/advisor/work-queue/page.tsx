'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { formatINRWhole, formatRelative } from '@/lib/format';
import { AlertTriangle, Calculator, CheckCircle2, FileText, Inbox, Package, RefreshCw, Send, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Skeleton } from '@/components/ui/Skeleton';
import { inDateRange, matchesSearch, useUrlFilters } from '@/lib/useUrlFilters';

// Shapes returned by GET /advisor/work-queue (AdvisorWorkQueueDto on the API).
interface QueueRequest {
  id: string;
  requestNumber: string;
  customerName: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleLicensePlate?: string;
  vehicleSummary?: string;
  locationSummary?: string;
  status: string;
  dispatchedGaragesCount?: number;
  quotesReceivedCount?: number;
  assignedGarageName?: string | null;
  createdAtUtc: string;
}

interface QueueJob {
  id: string;
  jobNumber: string;
  serviceRequestId: string;
  requestNumber: string;
  garageName: string;
  customerName: string;
  vehicleSummary: string;
  status: string;
  scheduledStartAtUtc?: string | null;
  createdAtUtc: string;
}

interface QueueExtraWork {
  id: string;
  serviceJobId: string;
  description: string;
  estimatedAdditionalAmount: number;
  reason: string;
  status: string;
  createdAtUtc: string;
}

/** A paid fixed-price package booking that needs a garage (packages are never sent out for quotes). */
interface QueuePackageBooking {
  id: string;
  requestNumber: string;
  customerName: string;
  vehicleSummary: string;
  locationSummary?: string;
  packageName: string;
  packagePrice: number;
  advancePaidAmount: number;
  advancePaidAtUtc?: string | null;
  createdAtUtc: string;
}

interface AdvisorWorkQueueResponse {
  newRequests?: QueueRequest[];
  quotesToReview?: QueueRequest[];
  customerQuotationsPending?: QueueRequest[];
  activeJobs?: QueueJob[];
  additionalWorkPending?: QueueExtraWork[];
  packageBookingsToAssign?: QueuePackageBooking[] | null;
}

type Stage =
  | 'all'
  | 'packages'
  | 'new-requests'
  | 'pending-quotes'
  | 'ready-to-send'
  | 'awaiting-customer'
  | 'additional-work'
  | 'active-jobs';

const STAGES: Stage[] = ['all', 'packages', 'new-requests', 'pending-quotes', 'ready-to-send', 'awaiting-customer', 'additional-work', 'active-jobs'];

// `stage` is the chip row; dashboard links open the page with ?stage=... already set.
const FILTER_DEFAULTS = { stage: 'all', q: '', range: '', from: '', to: '' };

/** A customer quotation is with the customer once the request moved to "quotation sent". */
function isSentToCustomer(status: string) {
  return status.replace(/[_\s]/g, '').toLowerCase() === 'customerquotationsent';
}

function vehicleLabel(r: QueueRequest) {
  const summary = r.vehicleSummary?.trim();
  if (summary) return summary;
  return [r.vehicleMake, r.vehicleModel].filter(Boolean).join(' ') || r.requestNumber;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function RequestRow({ r, href, icon, tone, extra }: {
  r: QueueRequest;
  href: string;
  icon: React.ElementType;
  tone: 'blue' | 'amber' | 'green' | 'red' | 'neutral';
  extra?: string;
}) {
  return (
    <ListItem
      href={href}
      leading={<IconTile icon={icon} tone={tone} />}
      title={vehicleLabel(r)}
      subtitle={[r.customerName, r.locationSummary].filter(Boolean).join(' · ')}
      meta={
        <>
          <span className="font-mono">{r.requestNumber}</span> · {formatRelative(r.createdAtUtc)}
          {extra ? ` · ${extra}` : ''}
        </>
      }
      trailing={<StatusBadge status={r.status} />}
    />
  );
}

function AdvisorWorkQueueContent() {
  const filters = useUrlFilters(FILTER_DEFAULTS);
  const { values: f } = filters;
  const activeTab: Stage = (STAGES as string[]).includes(f.stage) ? (f.stage as Stage) : 'all';

  const [queue, setQueue] = useState<AdvisorWorkQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorkQueue = useCallback(async () => {
    setRefreshing(true);
    const res = await apiFetch<AdvisorWorkQueueResponse>('/advisor/work-queue');
    if (res.success && res.data) {
      setQueue(res.data);
      setError(null);
    } else {
      setError(res.message || 'Could not load the work queue.');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadWorkQueue();
  }, [loadWorkQueue]);

  // Search and date narrow every stage, so the chip counts show what is left in each.
  const groups = useMemo(() => {
    const requestMatches = (r: QueueRequest) =>
      inDateRange(r.createdAtUtc, f) &&
      matchesSearch(
        f.q,
        r.requestNumber,
        r.customerName,
        vehicleLabel(r),
        r.vehicleMake,
        r.vehicleModel,
        r.vehicleLicensePlate,
        r.locationSummary,
        r.assignedGarageName
      );
    const quotations = (queue?.customerQuotationsPending ?? []).filter(requestMatches);
    return {
      packages: (queue?.packageBookingsToAssign ?? []).filter(
        (p) =>
          inDateRange(p.createdAtUtc, f) &&
          matchesSearch(f.q, p.requestNumber, p.customerName, p.vehicleSummary, p.locationSummary, p.packageName)
      ),
      newRequests: (queue?.newRequests ?? []).filter(requestMatches),
      quotesToReview: (queue?.quotesToReview ?? []).filter(requestMatches),
      readyToSend: quotations.filter((q) => !isSentToCustomer(q.status)),
      awaitingCustomer: quotations.filter((q) => isSentToCustomer(q.status)),
      additionalWork: (queue?.additionalWorkPending ?? []).filter(
        (w) => inDateRange(w.createdAtUtc, f) && matchesSearch(f.q, w.description, w.reason)
      ),
      activeJobs: (queue?.activeJobs ?? []).filter(
        (j) =>
          inDateRange(j.createdAtUtc, f) &&
          matchesSearch(f.q, j.jobNumber, j.requestNumber, j.garageName, j.customerName, j.vehicleSummary)
      ),
    };
  }, [queue, f]);

  const counts: Record<Stage, number> = {
    packages: groups.packages.length,
    'new-requests': groups.newRequests.length,
    'pending-quotes': groups.quotesToReview.length,
    'ready-to-send': groups.readyToSend.length,
    'awaiting-customer': groups.awaitingCustomer.length,
    'additional-work': groups.additionalWork.length,
    'active-jobs': groups.activeJobs.length,
    all: 0,
  };
  counts.all =
    counts.packages +
    counts['new-requests'] +
    counts['pending-quotes'] +
    counts['ready-to-send'] +
    counts['awaiting-customer'] +
    counts['additional-work'] +
    counts['active-jobs'];

  const chipOptions = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'additional-work', label: 'Extra work', count: counts['additional-work'] },
    { value: 'packages', label: 'Packages to assign', count: counts.packages },
    { value: 'pending-quotes', label: 'Quotes to review', count: counts['pending-quotes'] },
    { value: 'ready-to-send', label: 'Quotation to send', count: counts['ready-to-send'] },
    { value: 'new-requests', label: 'New requests', count: counts['new-requests'] },
    { value: 'awaiting-customer', label: 'With customer', count: counts['awaiting-customer'] },
    { value: 'active-jobs', label: 'Active jobs', count: counts['active-jobs'] },
  ];

  const show = (stage: Stage) => activeTab === 'all' || activeTab === stage;

  const sections: React.ReactNode[] = [];

  if (show('additional-work') && groups.additionalWork.length > 0) {
    sections.push(
      <ListGroup key="additional-work" title="Extra work waiting for approval">
        {groups.additionalWork.map((w) => (
          <ListItem
            key={w.id}
            href={`/advisor/jobs/${w.serviceJobId}`}
            leading={<IconTile icon={AlertTriangle} tone="red" />}
            title={w.description}
            subtitle={w.reason}
            meta={`Raised ${formatRelative(w.createdAtUtc)}`}
            trailing={
              <span className="text-sm font-semibold tabular-nums text-navy-900">
                {formatINRWhole(w.estimatedAdditionalAmount)}
              </span>
            }
          />
        ))}
      </ListGroup>
    );
  }

  if (show('packages') && groups.packages.length > 0) {
    sections.push(
      <ListGroup key="packages" title="Package bookings: assign a garage">
        {groups.packages.map((p) => (
          <ListItem
            key={p.id}
            href={`/advisor/requests/${p.id}`}
            leading={<IconTile icon={Package} tone="blue" />}
            title={p.vehicleSummary || p.requestNumber}
            subtitle={[p.packageName, p.customerName, p.locationSummary].filter(Boolean).join(' · ')}
            meta={
              <>
                <span className="font-mono">{p.requestNumber}</span> · advance {formatINRWhole(p.advancePaidAmount)} paid{' '}
                {formatRelative(p.advancePaidAtUtc || p.createdAtUtc)}
              </>
            }
            trailing={
              <span className="text-sm font-semibold tabular-nums text-navy-900">{formatINRWhole(p.packagePrice)}</span>
            }
          />
        ))}
      </ListGroup>
    );
  }

  if (show('pending-quotes') && groups.quotesToReview.length > 0) {
    sections.push(
      <ListGroup key="pending-quotes" title="Garage quotes to compare">
        {groups.quotesToReview.map((r) => (
          <RequestRow
            key={r.id}
            r={r}
            href={`/advisor/requests/${r.id}`}
            icon={Calculator}
            tone="amber"
            extra={typeof r.quotesReceivedCount === 'number' ? plural(r.quotesReceivedCount, 'quote') : undefined}
          />
        ))}
      </ListGroup>
    );
  }

  if (show('ready-to-send') && groups.readyToSend.length > 0) {
    sections.push(
      <ListGroup key="ready-to-send" title="Customer quotations to finish and send">
        {groups.readyToSend.map((r) => (
          <RequestRow
            key={`${r.id}-${r.createdAtUtc}`}
            r={r}
            href={`/advisor/requests/${r.id}/customer-quotation`}
            icon={Send}
            tone="blue"
            extra={r.assignedGarageName ?? undefined}
          />
        ))}
      </ListGroup>
    );
  }

  if (show('new-requests') && groups.newRequests.length > 0) {
    sections.push(
      <ListGroup key="new-requests" title="New requests, no quotes yet">
        {groups.newRequests.map((r) => (
          <RequestRow
            key={r.id}
            r={r}
            href={`/advisor/requests/${r.id}`}
            icon={Inbox}
            tone="neutral"
            extra={
              typeof r.dispatchedGaragesCount === 'number'
                ? `${plural(r.dispatchedGaragesCount, 'garage')} notified`
                : undefined
            }
          />
        ))}
      </ListGroup>
    );
  }

  if (show('awaiting-customer') && groups.awaitingCustomer.length > 0) {
    sections.push(
      <ListGroup key="awaiting-customer" title="Waiting for the customer to decide">
        {groups.awaitingCustomer.map((r) => (
          <RequestRow
            key={`${r.id}-${r.createdAtUtc}`}
            r={r}
            href={`/advisor/requests/${r.id}`}
            icon={FileText}
            tone="neutral"
            extra={r.assignedGarageName ?? undefined}
          />
        ))}
      </ListGroup>
    );
  }

  if (show('active-jobs') && groups.activeJobs.length > 0) {
    sections.push(
      <ListGroup key="active-jobs" title="Jobs at garages">
        {groups.activeJobs.map((j) => (
          <ListItem
            key={j.id}
            href={`/advisor/jobs/${j.id}`}
            leading={<IconTile icon={Wrench} tone="green" />}
            title={j.vehicleSummary || j.jobNumber}
            subtitle={[j.garageName, j.customerName].filter(Boolean).join(' · ')}
            meta={
              <>
                <span className="font-mono">{j.jobNumber}</span> · started {formatRelative(j.createdAtUtc)}
              </>
            }
            trailing={<StatusBadge status={j.status} />}
          />
        ))}
      </ListGroup>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Work queue"
        description="Everything waiting on you, most urgent first."
        actions={
          <Button
            variant="outline"
            onClick={loadWorkQueue}
            isLoading={refreshing && !loading}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
        }
      />

      <FilterBar
        filters={filters}
        searchKey="q"
        searchPlaceholder="Name, number or car"
        searchLabel="Search the work queue"
        status={{ key: 'stage', options: chipOptions, ariaLabel: 'Queue stage' }}
        fields={[{ type: 'dateRange', label: 'Created' }]}
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-2xl" />
          ))}
        </div>
      ) : error && !queue ? (
        <ErrorState title="Could not load the work queue" error={error} onRetry={loadWorkQueue} />
      ) : sections.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nothing waiting here"
          description={
            f.q || f.range
              ? 'Nothing in the queue matches these filters.'
              : activeTab === 'all'
              ? 'You are all caught up.'
              : 'Nothing in this stage right now.'
          }
        />
      ) : (
        <div className="space-y-5 sm:space-y-6">{sections}</div>
      )}
    </div>
  );
}

export default function AdvisorWorkQueuePage() {
  return (
    <Suspense fallback={<LoadingState message="Loading work queue..." />}>
      <AdvisorWorkQueueContent />
    </Suspense>
  );
}
