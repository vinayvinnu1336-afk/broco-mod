'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { AttentionItem } from '@/types/adminOperations';
import { 
  Inbox, 
  Calculator, 
  CheckSquare, 
  ShieldCheck, 
  Clock, 
  ArrowRight, 
  Wrench,
  AlertTriangle,
  UserCheck,
  CheckCircle2,
  ListTodo,
  RefreshCw
} from 'lucide-react';

interface AdvisorDashboardData {
  assignedRequestsCount: number;
  pendingQuoteReviewsCount: number;
  awaitingCustomerDecisionCount: number;
  activeServiceJobsCount: number;
  additionalWorkPendingReviewCount: number;
  completedJobsThisMonth: number;
  priorityAttentionItems: AttentionItem[];
}

export default function AdvisorDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AdvisorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async () => {
    setRefreshing(true);
    const res = await apiFetch<AdvisorDashboardData>('/advisor/dashboard');
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
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
          <p className="text-sm text-neutral-400">Loading technical advisor console...</p>
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
            <h1 className="text-2xl font-bold tracking-tight text-white">Advisor Operational Console</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-medium text-purple-300">
              <UserCheck className="h-3 w-3" /> Technical Review Duty
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-400">
            Welcome, <span className="font-semibold text-white">{user?.fullName}</span>. Oversee quotations, margin structures, and garage execution.
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
            href="/advisor/work-queue"
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500"
          >
            <ListTodo className="h-4 w-4" />
            Open Work Queue
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Pending Quote Reviews */}
        <Link
          href="/advisor/work-queue?stage=pending-quotes"
          className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 shadow-sm transition hover:border-neutral-700 hover:bg-neutral-800/60"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-400">Quotes Needing Review</span>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-400">
              <Calculator className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{data?.pendingQuoteReviewsCount ?? 0}</span>
            <span className="text-xs text-amber-400 font-medium">Action Required</span>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Workshop quotes awaiting margin adjustment & approval.
          </p>
        </Link>

        {/* Awaiting Customer Decision */}
        <Link
          href="/advisor/work-queue?stage=awaiting-customer"
          className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 shadow-sm transition hover:border-neutral-700 hover:bg-neutral-800/60"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-400">Awaiting Customer Decision</span>
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{data?.awaitingCustomerDecisionCount ?? 0}</span>
            <span className="text-xs text-blue-400 font-medium">Pending Response</span>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Proposals sent to customers awaiting acceptance or rejection.
          </p>
        </Link>

        {/* Additional Work Requests */}
        <Link
          href="/advisor/work-queue?stage=additional-work"
          className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 shadow-sm transition hover:border-neutral-700 hover:bg-neutral-800/60"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-400">Additional Work Pending</span>
            <div className="rounded-lg bg-rose-500/10 p-2 text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{data?.additionalWorkPendingReviewCount ?? 0}</span>
            <span className="text-xs text-rose-400 font-medium">Workshop Escalation</span>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Unplanned parts and labor requested by garages during inspection.
          </p>
        </Link>

        {/* Active Service Jobs */}
        <Link
          href="/advisor/jobs"
          className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 shadow-sm transition hover:border-neutral-700 hover:bg-neutral-800/60"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-400">Active Service Jobs</span>
            <div className="rounded-lg bg-orange-500/10 p-2 text-orange-400">
              <Wrench className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{data?.activeServiceJobsCount ?? 0}</span>
            <span className="text-xs text-orange-400 font-medium">Live Execution</span>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Vehicles in workshop inspection, work in progress, or ready.
          </p>
        </Link>

        {/* Assigned Requests Total */}
        <Link
          href="/advisor/requests"
          className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 shadow-sm transition hover:border-neutral-700 hover:bg-neutral-800/60"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-400">Total Assigned Requests</span>
            <div className="rounded-lg bg-purple-500/10 p-2 text-purple-400">
              <Inbox className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{data?.assignedRequestsCount ?? 0}</span>
            <span className="text-xs text-neutral-400 font-medium">Portfolio</span>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            All service requests assigned to your advisor profile.
          </p>
        </Link>

        {/* Completed Jobs This Month */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-400">Completed This Month</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{data?.completedJobsThisMonth ?? 0}</span>
            <span className="text-xs text-emerald-400 font-medium">Delivered</span>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Handed over and closed repair jobs with verified quality.
          </p>
        </div>
      </div>

      {/* Priority Attention Items */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-semibold text-white">Priority Operational Attention Items</h2>
          </div>
          <Link
            href="/advisor/work-queue"
            className="flex items-center gap-1 text-xs font-semibold text-purple-400 hover:text-purple-300"
          >
            Open Full Work Queue <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-4 divide-y divide-neutral-800">
          {!data?.priorityAttentionItems || data.priorityAttentionItems.length === 0 ? (
            <p className="py-6 text-center text-xs text-neutral-500">
              No priority attention items currently pending. All quotes and jobs are on schedule!
            </p>
          ) : (
            data.priorityAttentionItems.map((item, idx) => (
              <div key={`${item.referenceId}-${idx}`} className="py-3 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white">{item.referenceNumber}</span>
                    <span className="rounded bg-neutral-800 px-2 py-0.5 text-[10px] uppercase font-semibold text-neutral-300">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-neutral-200">{item.title}</p>
                  <p className="text-xs text-neutral-400">{item.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={item.actionUrl}
                    className="inline-flex items-center gap-1 rounded bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-700 hover:text-purple-300 transition"
                  >
                    Action <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
