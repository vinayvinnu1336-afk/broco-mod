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
  RefreshCw,
  Server,
  Database,
  Cpu,
  HardDrive,
  CreditCard
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';

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
    return <LoadingState message="Loading operational control center..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-navy-900">Operations Control Center</h1>
            <Badge variant="red" icon={Shield}>
              Live Operations
            </Badge>
          </div>
          <p className="mt-1 text-sm text-navy-600">
            Platform-wide real-time metrics, workshop verification, requests supervision, and health monitoring.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboard}
            isLoading={refreshing}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
          <Link href="/admin/attention">
            <Button
              variant="danger"
              size="sm"
              leftIcon={<AlertTriangle className="h-4 w-4" />}
            >
              Attention Queue ({data?.requestsNeedingAttention ?? 0})
            </Button>
          </Link>
        </div>
      </div>

      {/* Global System Health Bar */}
      <div className="bg-white rounded-2xl border border-surface-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-navy-900">
            <Activity className="w-4 h-4 text-emerald-600" />
            <span>Infrastructure Health Status</span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-navy-700">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <Server className="w-3.5 h-3.5 text-navy-400" />
              <span className="font-semibold">Core API:</span>
              <span className="text-emerald-700 font-bold">Operational</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <Database className="w-3.5 h-3.5 text-navy-400" />
              <span className="font-semibold">PostgreSQL / PostGIS:</span>
              <span className="text-emerald-700 font-bold">Healthy (3.4)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <Cpu className="w-3.5 h-3.5 text-navy-400" />
              <span className="font-semibold">Redis Cache:</span>
              <span className="text-emerald-700 font-bold">Connected</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <HardDrive className="w-3.5 h-3.5 text-navy-400" />
              <span className="font-semibold">Job Worker:</span>
              <span className="text-emerald-700 font-bold">Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Attention Alert Banner */}
      {data && (data.requestsNeedingAttention > 0 || data.failedNotificationsCount > 0) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-900">
                  Operational Items Require Attention
                </p>
                <p className="text-xs text-amber-700">
                  {data.requestsNeedingAttention} service request(s) need operational intervention &bull; {data.failedNotificationsCount} notification(s) failed delivery.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {data.requestsNeedingAttention > 0 && (
                <Link href="/admin/attention">
                  <Button variant="secondary" size="sm">
                    View Attention Queue
                  </Button>
                </Link>
              )}
              {data.failedNotificationsCount > 0 && (
                <Link href="/admin/notifications">
                  <Button variant="outline" size="sm">
                    Inspect Notifications
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Primary 4-Column KPI Strip */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Service Requests */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Platform Volume</span>
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 border border-blue-100">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-navy-900">{data?.totalServiceRequests ?? 0}</span>
            <span className="text-xs text-navy-500 font-medium">Total Requests</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-navy-600 border-t border-surface-100 pt-3">
            <span className="text-blue-700 font-bold">{data?.activeServiceRequests ?? 0} Active</span>
            <span className="text-emerald-700 font-bold">{data?.completedServiceRequests ?? 0} Done</span>
            <span className="text-navy-400">{data?.cancelledServiceRequests ?? 0} Cancelled</span>
          </div>
        </Card>

        {/* Workshop Network */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Active Workshops</span>
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600 border border-emerald-100">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-navy-900">{data?.activeGarages ?? 0}</span>
            <span className="text-xs text-navy-500 font-medium">of {data?.totalGarages ?? 0} Registered</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-navy-600 border-t border-surface-100 pt-3">
            <span className="text-amber-700 font-bold">{data?.pendingVerificationGarages ?? 0} Pending</span>
            <span className="text-rose-600 font-bold">{data?.suspendedGarages ?? 0} Suspended</span>
          </div>
        </Card>

        {/* Technical Advisors */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">In-Progress Jobs</span>
            <div className="rounded-xl bg-orange-50 p-2.5 text-orange-600 border border-orange-100">
              <Wrench className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-navy-900">{data?.serviceJobsInProgress ?? 0}</span>
            <span className="text-xs text-orange-600 font-bold">On Lift / Execution</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-navy-600 border-t border-surface-100 pt-3">
            <span className="text-emerald-700 font-bold">{data?.completedServiceJobs ?? 0} Handed Over</span>
            <span className="text-navy-400">Live Execution</span>
          </div>
        </Card>

        {/* Customer Accounts / Platform Scale */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Customer Base</span>
            <div className="rounded-xl bg-purple-50 p-2.5 text-purple-600 border border-purple-100">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-navy-900">{data?.totalCustomers ?? 0}</span>
            <span className="text-xs text-navy-500 font-medium">Registered Owners</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-navy-600 border-t border-surface-100 pt-3">
            <span className="text-purple-700 font-bold">{data?.activeAdvisors ?? 0} Advisors Active</span>
            <span className="text-navy-400">{data?.totalAdvisors ?? 0} Total Staff</span>
          </div>
        </Card>
      </div>

      {/* Operations Quick Action Hub */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Link
          href="/admin/garages?status=PendingVerification"
          className="flex flex-col items-center justify-center rounded-2xl border border-surface-200 bg-white p-4 text-center transition hover:border-amber-400 hover:shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-navy-900">Pending Garages</span>
          <span className="mt-1 text-[11px] font-semibold text-amber-700">{data?.pendingVerificationGarages ?? 0} to verify</span>
        </Link>
        <Link
          href="/admin/requests"
          className="flex flex-col items-center justify-center rounded-2xl border border-surface-200 bg-white p-4 text-center transition hover:border-blue-400 hover:shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
            <FileText className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-navy-900">All Requests</span>
          <span className="mt-1 text-[11px] text-navy-600">{data?.activeServiceRequests ?? 0} active</span>
        </Link>
        <Link
          href="/admin/jobs"
          className="flex flex-col items-center justify-center rounded-2xl border border-surface-200 bg-white p-4 text-center transition hover:border-orange-400 hover:shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center mb-2">
            <Wrench className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-navy-900">Workshop Jobs</span>
          <span className="mt-1 text-[11px] text-navy-600">{data?.serviceJobsInProgress ?? 0} active</span>
        </Link>
        <Link
          href="/admin/finance"
          className="flex flex-col items-center justify-center rounded-2xl border border-surface-200 bg-white p-4 text-center transition hover:border-emerald-400 hover:shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
            <CreditCard className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-navy-900">Finance Control</span>
          <span className="mt-1 text-[11px] text-emerald-700 font-semibold">Ledger & Escrow</span>
        </Link>
        <Link
          href="/admin/notifications"
          className="flex flex-col items-center justify-center rounded-2xl border border-surface-200 bg-white p-4 text-center transition hover:border-purple-400 hover:shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2">
            <Bell className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-navy-900">Notifications</span>
          <span className="mt-1 text-[11px] text-navy-600">{data?.failedNotificationsCount ?? 0} failed</span>
        </Link>
        <Link
          href="/admin/system-health"
          className="flex flex-col items-center justify-center rounded-2xl border border-surface-200 bg-white p-4 text-center transition hover:border-emerald-400 hover:shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
            <Activity className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-navy-900">System Health</span>
          <span className="mt-1 text-[11px] text-emerald-700 font-semibold">PostGIS & Redis</span>
        </Link>
      </div>

      {/* Recent Activity Sections */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Platform Requests */}
        <Card className="p-6">
          <div className="flex items-center justify-between pb-4 border-b border-surface-100">
            <div>
              <h2 className="text-base font-bold text-navy-900">Recent Service Requests</h2>
              <p className="text-xs text-navy-500">Latest customer submissions across all zones</p>
            </div>
            <Link href="/admin/requests" className="flex items-center gap-1 text-xs font-bold text-electric-600 hover:text-electric-700">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-4 divide-y divide-surface-100">
            {data?.recentRequests && data.recentRequests.length > 0 ? (
              data.recentRequests.slice(0, 5).map((req) => (
                <div key={req.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/requests/${req.id}`} className="font-mono text-xs font-bold text-navy-900 hover:text-electric-600">
                        {req.requestNumber}
                      </Link>
                      <StatusBadge status={req.status} />
                    </div>
                    <p className="mt-1 text-xs text-navy-600 truncate">
                      <strong className="text-navy-900">{req.customerName}</strong> &bull; {req.vehicleMake} {req.vehicleModel} ({req.vehicleLicensePlate})
                    </p>
                  </div>
                  <div className="text-right text-xs text-navy-500 whitespace-nowrap">
                    <div className="font-bold text-navy-800">{req.quotesReceivedCount} quotes</div>
                    <div className="mt-0.5 text-[11px]">{new Date(req.createdAtUtc).toLocaleDateString()}</div>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-xs text-navy-500">No recent requests recorded.</p>
            )}
          </div>
        </Card>

        {/* Security & Operational Audit Log */}
        <Card className="p-6">
          <div className="flex items-center justify-between pb-4 border-b border-surface-100">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-600" />
              <div>
                <h2 className="text-base font-bold text-navy-900">Security & Audit Trail</h2>
                <p className="text-xs text-navy-500">Immutable ledger of platform-wide operational changes</p>
              </div>
            </div>
            <Link href="/admin/audit" className="flex items-center gap-1 text-xs font-bold text-electric-600 hover:text-electric-700">
              View explorer <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-4 divide-y divide-surface-100">
            {data?.recentAuditLogs && data.recentAuditLogs.length > 0 ? (
              data.recentAuditLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-navy-900">
                      {log.action}
                    </p>
                    <p className="mt-0.5 text-[11px] text-navy-600 truncate">
                      {log.userEmail || 'System'} &bull; {log.details || log.entityName}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-[11px] font-mono text-navy-500">
                    {new Date(log.timestampUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-xs text-navy-500">No audit logs recorded.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
