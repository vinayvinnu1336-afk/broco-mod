'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { AdminDashboardKpis } from '@/types/adminOperations';
import {
  AlertTriangle,
  BellOff,
  Building2,
  CheckCircle2,
  FileText,
  History,
  RefreshCw,
  Users,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatRelative, humanize } from '@/lib/format';
import { CommissionSummaryCard } from '@/components/admin/CommissionSummaryCard';

const viewAllLink =
  'inline-flex min-h-[32px] items-center rounded-lg px-1.5 text-sm font-medium text-electric-600 hover:text-electric-700';

function DashboardSkeleton() {
  return (
    <div className="space-y-5 sm:space-y-6" aria-busy="true" aria-label="Loading overview">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setRefreshing(true);
    const res = await apiFetch<AdminDashboardKpis>('/admin/dashboard');
    if (res.success && res.data) {
      setData(res.data);
      setError(null);
    } else {
      setError(res.message || 'Could not load the overview.');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!data) {
    return (
      <div>
        <PageHeader title="Overview" />
        <ErrorState title="Could not load the overview" error={error} onRetry={loadDashboard} />
      </div>
    );
  }

  const attentionCount = data.requestsNeedingAttention ?? 0;
  const failedNotifications = data.failedNotificationsCount ?? 0;
  const garagesToVerify = data.pendingVerificationGarages ?? 0;
  const nothingNeedsAttention = attentionCount === 0 && failedNotifications === 0 && garagesToVerify === 0;

  const recentRequests = (data.recentRequests ?? []).slice(0, 5);
  const recentAuditLogs = (data.recentAuditLogs ?? []).slice(0, 5);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Overview"
        description="Requests, jobs and garages across the platform, and what needs a decision."
        actions={
          <Button
            variant="outline"
            onClick={loadDashboard}
            isLoading={refreshing}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
        }
      />

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not refresh: {error} Showing the last loaded figures.
        </p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Open requests"
          value={data.activeServiceRequests ?? 0}
          hint={`of ${data.totalServiceRequests ?? 0} total`}
          icon={FileText}
          tone="blue"
          href="/admin/requests"
        />
        <StatCard
          label="Jobs in progress"
          value={data.serviceJobsInProgress ?? 0}
          hint={`${data.completedServiceJobs ?? 0} completed`}
          icon={Wrench}
          tone="amber"
          href="/admin/jobs"
        />
        <StatCard
          label="Active garages"
          value={data.activeGarages ?? 0}
          hint={`of ${data.totalGarages ?? 0} registered`}
          icon={Building2}
          tone="green"
          href="/admin/garages"
        />
        <StatCard
          label="Customers"
          value={data.totalCustomers ?? 0}
          hint={`${data.activeAdvisors ?? 0} advisors active`}
          icon={Users}
          tone="neutral"
          href="/admin/customers"
        />
      </div>

      {/* Needs attention summary */}
      <ListGroup
        title="Needs attention"
        action={
          <Link href="/admin/attention" className={viewAllLink}>
            Open queue
          </Link>
        }
      >
        {nothingNeedsAttention ? (
          <ListItem
            leading={<IconTile icon={CheckCircle2} tone="green" />}
            title="Nothing needs attention"
            subtitle="The attention queue is empty and no garages are waiting for verification."
          />
        ) : (
          <>
            <ListItem
              href="/admin/attention"
              leading={<IconTile icon={AlertTriangle} tone={attentionCount > 0 ? 'red' : 'neutral'} />}
              title="Attention queue"
              subtitle={attentionCount > 0 ? 'Stalled quotes, expiring quotations, late vehicles and more' : 'Empty right now'}
              trailing={<span className="text-lg font-bold tabular-nums text-navy-900">{attentionCount}</span>}
            />
            <ListItem
              href="/admin/notifications"
              leading={<IconTile icon={BellOff} tone={failedNotifications > 0 ? 'amber' : 'neutral'} />}
              title="Failed notifications"
              subtitle={failedNotifications > 0 ? 'Messages that could not be delivered' : 'None right now'}
              trailing={<span className="text-lg font-bold tabular-nums text-navy-900">{failedNotifications}</span>}
            />
            <ListItem
              href="/admin/garages?status=PendingVerification"
              leading={<IconTile icon={Building2} tone={garagesToVerify > 0 ? 'amber' : 'neutral'} />}
              title="Garages to verify"
              subtitle={
                (data.suspendedGarages ?? 0) > 0
                  ? `${data.suspendedGarages} suspended`
                  : 'New garage sign-ups waiting for review'
              }
              trailing={<span className="text-lg font-bold tabular-nums text-navy-900">{garagesToVerify}</span>}
            />
          </>
        )}
      </ListGroup>

      <CommissionSummaryCard portal="admin" title="Garage dues" />

      {/* Recent activity */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ListGroup
          title="Recent requests"
          action={
            <Link href="/admin/requests" className={viewAllLink}>
              View all
            </Link>
          }
        >
          {recentRequests.length > 0 ? (
            recentRequests.map((req) => (
              <ListItem
                key={req.id}
                href={`/admin/requests/${req.id}`}
                title={req.customerName}
                subtitle={`${req.vehicleMake} ${req.vehicleModel} · ${req.vehicleLicensePlate}`}
                meta={`${req.requestNumber} · ${req.quotesReceivedCount} ${
                  req.quotesReceivedCount === 1 ? 'quote' : 'quotes'
                } · ${formatRelative(req.createdAtUtc)}`}
                trailing={<StatusBadge status={req.status} />}
              />
            ))
          ) : (
            <ListItem
              leading={<IconTile icon={FileText} tone="neutral" />}
              title="No requests yet"
              subtitle="New service requests will appear here."
            />
          )}
        </ListGroup>

        <ListGroup
          title="Recent activity"
          action={
            <Link href="/admin/audit" className={viewAllLink}>
              Audit trail
            </Link>
          }
        >
          {recentAuditLogs.length > 0 ? (
            recentAuditLogs.map((log) => (
              <ListItem
                key={log.id}
                title={humanize(log.action)}
                subtitle={log.details || log.entityName || undefined}
                meta={`${log.userEmail || 'System'} · ${formatRelative(log.timestampUtc)}`}
              />
            ))
          ) : (
            <ListItem
              leading={<IconTile icon={History} tone="neutral" />}
              title="No activity recorded yet"
            />
          )}
        </ListGroup>
      </div>
    </div>
  );
}
