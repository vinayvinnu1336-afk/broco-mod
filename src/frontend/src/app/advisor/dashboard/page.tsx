'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { Calculator, Clock, Inbox, ListTodo, RefreshCw, Wrench, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';

// Shape returned by GET /advisor/dashboard (AdvisorDashboardKpiDto on the API).
interface AdvisorDashboardRequest {
  id: string;
  requestNumber: string;
  customerName: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleLicensePlate?: string;
  vehicleSummary?: string;
  locationSummary?: string;
  status: string;
  quotesReceivedCount?: number;
  assignedGarageName?: string | null;
  createdAtUtc: string;
}

interface AdvisorDashboardData {
  assignedRequestsCount?: number;
  quotesAwaitingReviewCount?: number;
  customerQuotationsPendingCount?: number;
  activeJobsOverseeingCount?: number;
  additionalWorkPendingCount?: number;
  recentAssignedRequests?: AdvisorDashboardRequest[];
}

const linkButtonPrimary =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-electric-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-electric-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-600 focus-visible:ring-offset-2';

function vehicleLabel(r: AdvisorDashboardRequest) {
  const summary = r.vehicleSummary?.trim();
  if (summary) return summary;
  return [r.vehicleMake, r.vehicleModel].filter(Boolean).join(' ') || r.requestNumber;
}

export default function AdvisorDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AdvisorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setRefreshing(true);
    const res = await apiFetch<AdvisorDashboardData>('/advisor/dashboard');
    if (res.success && res.data) {
      setData(res.data);
      setError(null);
    } else {
      setError(res.message || 'Could not load your overview.');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const firstName = user?.fullName?.split(' ')[0];
  const extraWork = data?.additionalWorkPendingCount ?? 0;
  const recent = data?.recentAssignedRequests ?? [];

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title={firstName ? `Hi, ${firstName}` : 'Overview'}
        description={
          data
            ? `You have ${data.assignedRequestsCount ?? 0} open request${(data.assignedRequestsCount ?? 0) === 1 ? '' : 's'}. Here is what needs you now.`
            : 'What needs your attention today.'
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={loadDashboard}
              isLoading={refreshing && !loading}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </Button>
            <Link href="/advisor/work-queue" className={linkButtonPrimary}>
              <ListTodo className="h-4 w-4" />
              Open work queue
            </Link>
          </>
        }
      />

      {loading ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[104px] rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </>
      ) : error && !data ? (
        <ErrorState title="Could not load your overview" error={error} onRetry={loadDashboard} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Quotes to review"
              value={data?.quotesAwaitingReviewCount ?? 0}
              icon={Calculator}
              tone="amber"
              hint="Pick a garage"
              href="/advisor/work-queue?stage=pending-quotes"
            />
            <StatCard
              label="Awaiting customer"
              value={data?.customerQuotationsPendingCount ?? 0}
              icon={Clock}
              tone="blue"
              hint="Quotations sent"
              href="/advisor/work-queue?stage=awaiting-customer"
            />
            <StatCard
              label="Extra work to approve"
              value={extraWork}
              icon={AlertTriangle}
              tone={extraWork > 0 ? 'red' : 'neutral'}
              hint="Raised by garages"
              href="/advisor/work-queue?stage=additional-work"
            />
            <StatCard
              label="Active jobs"
              value={data?.activeJobsOverseeingCount ?? 0}
              icon={Wrench}
              tone="green"
              hint="At garages now"
              href="/advisor/work-queue?stage=active-jobs"
            />
          </div>

          {extraWork > 0 && (
            <ListGroup>
              <ListItem
                href="/advisor/work-queue?stage=additional-work"
                leading={<IconTile icon={AlertTriangle} tone="red" />}
                title={`${extraWork} extra work request${extraWork === 1 ? '' : 's'} waiting for you`}
                subtitle="Garages are waiting for your approval before they continue."
              />
            </ListGroup>
          )}

          {recent.length > 0 ? (
            <ListGroup
              title="Your latest requests"
              action={
                <Link
                  href="/advisor/requests"
                  className="inline-flex min-h-[36px] items-center text-sm font-medium text-electric-600 hover:text-electric-700"
                >
                  See all
                </Link>
              }
            >
              {recent.map((r) => (
                <ListItem
                  key={r.id}
                  href={`/advisor/requests/${r.id}`}
                  leading={<IconTile icon={Inbox} tone="blue" />}
                  title={vehicleLabel(r)}
                  subtitle={[r.customerName, r.locationSummary].filter(Boolean).join(' · ')}
                  meta={
                    <>
                      <span className="font-mono">{r.requestNumber}</span>
                      {' · '}
                      {formatRelative(r.createdAtUtc)}
                      {typeof r.quotesReceivedCount === 'number' && r.quotesReceivedCount > 0 && (
                        <> · {r.quotesReceivedCount} quote{r.quotesReceivedCount === 1 ? '' : 's'}</>
                      )}
                    </>
                  }
                  trailing={<StatusBadge status={r.status} />}
                />
              ))}
            </ListGroup>
          ) : (
            <EmptyState
              icon={Inbox}
              title="No requests assigned yet"
              description="New service requests assigned to you will show up here."
            />
          )}
        </>
      )}
    </div>
  );
}
