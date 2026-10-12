'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatINRWhole, formatRelative } from '@/lib/format';
import { AlertTriangle, Calculator, CheckCircle2, FileText, Inbox, RefreshCw, Send, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterChips } from '@/components/ui/FilterChips';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Skeleton } from '@/components/ui/Skeleton';

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

interface AdvisorWorkQueueResponse {
  newRequests?: QueueRequest[];
  quotesToReview?: QueueRequest[];
  customerQuotationsPending?: QueueRequest[];
  activeJobs?: QueueJob[];
  additionalWorkPending?: QueueExtraWork[];
}

type Stage = 'all' | 'new-requests' | 'pending-quotes' | 'ready-to-send' | 'awaiting-customer' | 'additional-work' | 'active-jobs';

const STAGES: Stage[] = ['all', 'new-requests', 'pending-quotes', 'ready-to-send', 'awaiting-customer', 'additional-work', 'active-jobs'];

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
  const searchParams = useSearchParams();
  const initialStage = searchParams.get('stage') || 'all';

  const [queue, setQueue] = useState<AdvisorWorkQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Stage>(
    (STAGES as string[]).includes(initialStage) ? (initialStage as Stage) : 'all'
  );

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

  const groups = useMemo(() => {
    const quotations = queue?.customerQuotationsPending ?? [];
    return {
      newRequests: queue?.newRequests ?? [],
      quotesToReview: queue?.quotesToReview ?? [],
      readyToSend: quotations.filter((q) => !isSentToCustomer(q.status)),
      awaitingCustomer: quotations.filter((q) => isSentToCustomer(q.status)),
      additionalWork: queue?.additionalWorkPending ?? [],
      activeJobs: queue?.activeJobs ?? [],
    };
  }, [queue]);

  const counts: Record<Stage, number> = {
    'new-requests': groups.newRequests.length,
    'pending-quotes': groups.quotesToReview.length,
    'ready-to-send': groups.readyToSend.length,
    'awaiting-customer': groups.awaitingCustomer.length,
    'additional-work': groups.additionalWork.length,
    'active-jobs': groups.activeJobs.length,
    all: 0,
  };
  counts.all =
    counts['new-requests'] +
    counts['pending-quotes'] +
    counts['ready-to-send'] +
    counts['awaiting-customer'] +
    counts['additional-work'] +
    counts['active-jobs'];

  const chipOptions = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'additional-work', label: 'Extra work', count: counts['additional-work'] },
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

      <FilterChips
        ariaLabel="Queue stage"
        options={chipOptions}
        value={activeTab}
        onChange={(v) => setActiveTab(v as Stage)}
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
          description={activeTab === 'all' ? 'You are all caught up.' : 'Nothing in this stage right now.'}
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
