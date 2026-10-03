'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { AdminDashboardKpis } from '@/types/adminOperations';
import { 
  Users, 
  Building2, 
  UserCheck, 
  FileText, 
  ShieldAlert, 
  ArrowRight,
  Shield,
  Activity,
  AlertTriangle,
  Bell,
  Wrench,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AdminDashboardKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async () => {
    setRefreshing(true);
    const res = await apiFetch<AdminDashboardKpis>('/admin/dashboard');
    if (res.success && res.data) {
      setData(res.data);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-500 border-t-transparent" />
          <p className="text-sm text-neutral-400">Loading operational control center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Operations Control Center</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
              <Shield className="h-3 w-3" /> Live Operations
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-400">
            Platform-wide real-time metrics, garage verification, requests supervision, and health monitoring.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboard}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3.5 py-2 text-sm font-medium text-neutral-200 transition hover:bg-neutral-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/admin/attention"
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
          >
            <AlertTriangle className="h-4 w-4" />
            Attention Queue ({data?.requestsNeedingAttention ?? 0})
          </Link>
        </div>
      </div>

      {/* Operational Attention Alert Banner */}
      {data && (data.requestsNeedingAttention > 0 || data.failedNotificationsCount > 0) && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-amber-200">
                  Operational Items Require Attention
                </p>
                <p className="text-xs text-amber-300/80">
                  {data.requestsNeedingAttention} service request(s) need operational intervention &bull; {data.failedNotificationsCount} notification(s) failed delivery.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {data.requestsNeedingAttention > 0 && (
                <Link
                  href="/admin/attention"
                  className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/30"
                >
                  View Attention Queue
                </Link>
              )}
              {data.failedNotificationsCount > 0 && (
                <Link
                  href="/admin/notifications"
                  className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:bg-neutral-700"
                >
                  Inspect Notifications
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Service Requests */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-400">Service Requests</span>
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{data?.totalServiceRequests ?? 0}</span>
            <span className="text-xs text-neutral-400">Total</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-neutral-400 border-t border-neutral-800 pt-3">
            <span className="text-blue-400 font-medium">{data?.activeServiceRequests ?? 0} Active</span>
            <span className="text-emerald-400">{data?.completedServiceRequests ?? 0} Completed</span>
            <span className="text-neutral-500">{data?.cancelledServiceRequests ?? 0} Cancelled</span>
          </div>
        </div>

        {/* Workshop Network */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-400">Garages Network</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{data?.totalGarages ?? 0}</span>
            <span className="text-xs text-neutral-400">Registered</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-neutral-400 border-t border-neutral-800 pt-3">
            <span className="text-emerald-400 font-medium">{data?.activeGarages ?? 0} Active</span>
            <span className="text-amber-400 font-medium">{data?.pendingVerificationGarages ?? 0} Pending</span>
            <span className="text-rose-400">{data?.suspendedGarages ?? 0} Suspended</span>
          </div>
        </div>

        {/* Technical Advisors */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-400">Technical Advisors</span>
            <div className="rounded-lg bg-purple-500/10 p-2 text-purple-400">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{data?.totalAdvisors ?? 0}</span>
            <span className="text-xs text-neutral-400">Total</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-neutral-400 border-t border-neutral-800 pt-3">
            <span className="text-purple-400 font-medium">{data?.activeAdvisors ?? 0} Active Duty</span>
            <span className="text-neutral-500">{(data?.totalAdvisors ?? 0) - (data?.activeAdvisors ?? 0)} Inactive</span>
          </div>
        </div>

        {/* Service Jobs Execution */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-400">Service Jobs</span>
            <div className="rounded-lg bg-orange-500/10 p-2 text-orange-400">
              <Wrench className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{data?.serviceJobsInProgress ?? 0}</span>
            <span className="text-xs text-orange-400 font-medium">In Progress</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-neutral-400 border-t border-neutral-800 pt-3">
            <span className="text-emerald-400 font-medium">{data?.completedServiceJobs ?? 0} Handed Over</span>
            <span className="text-neutral-500">Live Workshop Execution</span>
          </div>
        </div>
      </div>

      {/* Operations Quick Action Hub */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Link
          href="/admin/garages?status=PendingVerification"
          className="flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-center transition hover:border-neutral-700 hover:bg-neutral-800/60"
        >
          <Building2 className="h-6 w-6 text-amber-400 mb-2" />
          <span className="text-xs font-semibold text-white">Pending Garages</span>
          <span className="mt-1 text-[11px] text-amber-400/90">{data?.pendingVerificationGarages ?? 0} waiting verify</span>
        </Link>
        <Link
          href="/admin/requests"
          className="flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-center transition hover:border-neutral-700 hover:bg-neutral-800/60"
        >
          <FileText className="h-6 w-6 text-blue-400 mb-2" />
          <span className="text-xs font-semibold text-white">All Requests</span>
          <span className="mt-1 text-[11px] text-neutral-400">{data?.activeServiceRequests ?? 0} active</span>
        </Link>
        <Link
          href="/admin/jobs"
          className="flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-center transition hover:border-neutral-700 hover:bg-neutral-800/60"
        >
          <Wrench className="h-6 w-6 text-orange-400 mb-2" />
          <span className="text-xs font-semibold text-white">Workshop Jobs</span>
          <span className="mt-1 text-[11px] text-neutral-400">{data?.serviceJobsInProgress ?? 0} active</span>
        </Link>
        <Link
          href="/admin/customers"
          className="flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-center transition hover:border-neutral-700 hover:bg-neutral-800/60"
        >
          <Users className="h-6 w-6 text-emerald-400 mb-2" />
          <span className="text-xs font-semibold text-white">Customers</span>
          <span className="mt-1 text-[11px] text-neutral-400">{data?.totalCustomers ?? 0} registered</span>
        </Link>
        <Link
          href="/admin/notifications"
          className="flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-center transition hover:border-neutral-700 hover:bg-neutral-800/60"
        >
          <Bell className="h-6 w-6 text-purple-400 mb-2" />
          <span className="text-xs font-semibold text-white">Notifications</span>
          <span className="mt-1 text-[11px] text-neutral-400">{data?.failedNotificationsCount ?? 0} failed</span>
        </Link>
        <Link
          href="/admin/system-health"
          className="flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-center transition hover:border-neutral-700 hover:bg-neutral-800/60"
        >
          <Activity className="h-6 w-6 text-emerald-400 mb-2" />
          <span className="text-xs font-semibold text-white">System Health</span>
          <span className="mt-1 text-[11px] text-emerald-400">PostGIS & Redis</span>
        </Link>
      </div>

      {/* Recent Activity Sections */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Recent Platform Requests */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
            <h2 className="text-base font-semibold text-white">Recent Requests</h2>
            <Link href="/admin/requests" className="flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-300">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-4 divide-y divide-neutral-800">
            {data?.recentRequests && data.recentRequests.length > 0 ? (
              data.recentRequests.slice(0, 5).map((req) => (
                <div key={req.id} className="py-3.5 flex items-center justify-between">
                  <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/requests/${req.id}`} className="text-sm font-semibold text-white hover:text-red-400">
                        {req.requestNumber}
                      </Link>
                      <span className="inline-flex rounded bg-neutral-800 px-2 py-0.5 text-[11px] font-medium text-neutral-300">
                        {req.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-400 truncate">
                      {req.customerName} &bull; {req.vehicleMake} {req.vehicleModel} ({req.vehicleLicensePlate})
                    </p>
                  </div>
                  <div className="text-right text-xs text-neutral-500 whitespace-nowrap">
                    <div>{req.quotesReceivedCount} quotes</div>
                    <div className="mt-0.5">{new Date(req.createdAtUtc).toLocaleDateString()}</div>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-neutral-500">No recent requests recorded.</p>
            )}
          </div>
        </div>

        {/* Security & Operational Audit Log */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-400" />
              <h2 className="text-base font-semibold text-white">Security & Audit Trail</h2>
            </div>
            <Link href="/admin/audit" className="flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-300">
              View explorer <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-4 divide-y divide-neutral-800">
            {data?.recentAuditLogs && data.recentAuditLogs.length > 0 ? (
              data.recentAuditLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-neutral-200">
                      {log.action}
                    </p>
                    <p className="mt-0.5 text-[11px] text-neutral-400 truncate">
                      {log.userEmail || 'System'} &bull; {log.details || log.entityName}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-[11px] text-neutral-500">
                    {new Date(log.timestampUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-neutral-500">No audit logs recorded.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
