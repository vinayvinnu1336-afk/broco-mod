'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { AdvisorWorkQueue, AdvisorWorkQueueItem } from '@/types/adminOperations';
import {
  ListTodo,
  Calculator,
  FileText,
  Clock,
  Wrench,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  Filter
} from 'lucide-react';

function AdvisorWorkQueueContent() {
  const searchParams = useSearchParams();
  const initialStage = searchParams.get('stage') || 'all';

  const [queue, setQueue] = useState<AdvisorWorkQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(initialStage);

  const loadWorkQueue = async () => {
    setRefreshing(true);
    const res = await apiFetch<AdvisorWorkQueue>('/advisor/work-queue');
    if (res.success && res.data) {
      setQueue(res.data);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadWorkQueue();
  }, []);

  const items = queue?.items ?? [];

  const filteredItems = items.filter((item) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending-quotes' && item.queueStage === 'PendingQuotesReview') return true;
    if (activeTab === 'ready-to-send' && item.queueStage === 'ReadyToSendQuotes') return true;
    if (activeTab === 'awaiting-customer' && item.queueStage === 'PendingCustomerDecision') return true;
    if (activeTab === 'additional-work' && (item.queueStage === 'AdditionalWorkReview' || item.hasAdditionalWorkPending)) return true;
    if (activeTab === 'active-jobs' && item.queueStage === 'ActiveJobsMonitoring') return true;
    return false;
  });

  const getStageBadge = (stage: string) => {
    switch (stage) {
      case 'PendingQuotesReview':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[11px] font-medium text-amber-400">
            <Calculator className="h-3 w-3" /> Quote Review Needed
          </span>
        );
      case 'ReadyToSendQuotes':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 text-[11px] font-medium text-blue-400">
            <FileText className="h-3 w-3" /> Proposal Ready to Send
          </span>
        );
      case 'PendingCustomerDecision':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 text-[11px] font-medium text-purple-300">
            <Clock className="h-3 w-3" /> Awaiting Customer Decision
          </span>
        );
      case 'AdditionalWorkReview':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 text-[11px] font-medium text-rose-400">
            <AlertTriangle className="h-3 w-3" /> Additional Work Pending
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-neutral-800 border border-neutral-700 px-2 py-0.5 text-[11px] font-medium text-neutral-300">
            <Wrench className="h-3 w-3" /> Live Workshop Execution
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Advisor Operational Work Queue</h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-medium text-purple-300">
              <ListTodo className="h-3 w-3" /> Actionable Task Hub
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-400">
            Organized queues of quotation reviews, proposal dispatches, customer responses, and workshop execution oversight.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadWorkQueue}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3.5 py-2 text-sm font-medium text-neutral-200 transition hover:bg-neutral-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Queue
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-neutral-800 pb-3">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === 'all'
              ? 'bg-purple-600 text-white shadow'
              : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white'
          }`}
        >
          All Items ({items.length})
        </button>

        <button
          onClick={() => setActiveTab('pending-quotes')}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === 'pending-quotes'
              ? 'bg-amber-600 text-white shadow'
              : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white'
          }`}
        >
          <Calculator className="h-3.5 w-3.5" />
          Pending Quotes ({queue?.pendingQuotesReviewCount ?? 0})
        </button>

        <button
          onClick={() => setActiveTab('ready-to-send')}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === 'ready-to-send'
              ? 'bg-blue-600 text-white shadow'
              : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Ready to Send ({queue?.readyToSendQuotesCount ?? 0})
        </button>

        <button
          onClick={() => setActiveTab('awaiting-customer')}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === 'awaiting-customer'
              ? 'bg-purple-600 text-white shadow'
              : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          Awaiting Decision ({queue?.pendingCustomerDecisionCount ?? 0})
        </button>

        <button
          onClick={() => setActiveTab('additional-work')}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === 'additional-work'
              ? 'bg-rose-600 text-white shadow'
              : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white'
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Additional Work ({queue?.additionalWorkReviewCount ?? 0})
        </button>

        <button
          onClick={() => setActiveTab('active-jobs')}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === 'active-jobs'
              ? 'bg-orange-600 text-white shadow'
              : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white'
          }`}
        >
          <Wrench className="h-3.5 w-3.5" />
          Execution ({queue?.activeJobsMonitoringCount ?? 0})
        </button>
      </div>

      {/* Work Queue Items List */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
            <p className="text-sm text-neutral-400">Loading work queue items...</p>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-12 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400 mb-3" />
          <h3 className="text-base font-semibold text-white">Queue Empty</h3>
          <p className="mt-1 text-sm text-neutral-400">
            No active operational tasks pending in this stage. Great job!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 transition hover:border-neutral-700 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-sm font-bold text-white">
                    {item.requestNumber}
                  </span>
                  {getStageBadge(item.queueStage)}
                  <span className="text-xs text-neutral-400">
                    Status: <span className="font-medium text-neutral-300">{item.status}</span>
                  </span>
                </div>
                <p className="text-sm font-medium text-neutral-200">
                  {item.customerName} &bull; <span className="text-neutral-400">{item.vehicleSummary}</span>
                </p>
                <div className="flex items-center gap-4 text-xs text-neutral-500">
                  <span>Quotes received: {item.quotesReceivedCount}</span>
                  {item.waitingSinceUtc && (
                    <span>Waiting since: {new Date(item.waitingSinceUtc).toLocaleDateString()}</span>
                  )}
                  {item.hasAdditionalWorkPending && (
                    <span className="font-semibold text-rose-400">Extra parts/labor pending review</span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center">
                <Link
                  href={item.actionUrl}
                  className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-purple-500"
                >
                  Action Task <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdvisorWorkQueuePage() {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
      </div>
    }>
      <AdvisorWorkQueueContent />
    </Suspense>
  );
}
