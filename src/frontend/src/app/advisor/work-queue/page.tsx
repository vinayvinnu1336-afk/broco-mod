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
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';

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
          <Badge variant="amber" icon={Calculator}>
            Quote Review Needed
          </Badge>
        );
      case 'ReadyToSendQuotes':
        return (
          <Badge variant="blue" icon={FileText}>
            Proposal Ready to Send
          </Badge>
        );
      case 'PendingCustomerDecision':
        return (
          <Badge variant="neutral" icon={Clock}>
            Awaiting Customer Decision
          </Badge>
        );
      case 'AdditionalWorkReview':
        return (
          <Badge variant="red" icon={AlertTriangle}>
            Additional Work Pending
          </Badge>
        );
      default:
        return (
          <Badge variant="navy" icon={Wrench}>
            Live Workshop Execution
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-navy-900">Advisor Operational Work Queue</h1>
            <Badge variant="blue" icon={ListTodo}>
              Actionable Task Hub
            </Badge>
          </div>
          <p className="mt-1 text-sm text-navy-600">
            Organized queues of quotation reviews, proposal dispatches, customer responses, and workshop execution oversight.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadWorkQueue}
            isLoading={refreshing}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-surface-200 pb-3">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            activeTab === 'all'
              ? 'bg-navy-900 text-white shadow-sm'
              : 'bg-white text-navy-600 border border-surface-200 hover:bg-surface-100 hover:text-navy-900'
          }`}
        >
          All Items ({items.length})
        </button>

        <button
          onClick={() => setActiveTab('pending-quotes')}
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            activeTab === 'pending-quotes'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white text-navy-600 border border-surface-200 hover:bg-surface-100 hover:text-navy-900'
          }`}
        >
          <Calculator className="h-3.5 w-3.5" />
          Pending Quotes ({queue?.pendingQuotesReviewCount ?? 0})
        </button>

        <button
          onClick={() => setActiveTab('ready-to-send')}
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            activeTab === 'ready-to-send'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-navy-600 border border-surface-200 hover:bg-surface-100 hover:text-navy-900'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Ready to Send ({queue?.readyToSendQuotesCount ?? 0})
        </button>

        <button
          onClick={() => setActiveTab('awaiting-customer')}
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            activeTab === 'awaiting-customer'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white text-navy-600 border border-surface-200 hover:bg-surface-100 hover:text-navy-900'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          Awaiting Decision ({queue?.pendingCustomerDecisionCount ?? 0})
        </button>

        <button
          onClick={() => setActiveTab('additional-work')}
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            activeTab === 'additional-work'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-white text-navy-600 border border-surface-200 hover:bg-surface-100 hover:text-navy-900'
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Additional Work ({queue?.additionalWorkReviewCount ?? 0})
        </button>

        <button
          onClick={() => setActiveTab('active-jobs')}
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            activeTab === 'active-jobs'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-navy-600 border border-surface-200 hover:bg-surface-100 hover:text-navy-900'
          }`}
        >
          <Wrench className="h-3.5 w-3.5" />
          Execution ({queue?.activeJobsMonitoringCount ?? 0})
        </button>
      </div>

      {/* Work Queue Items List */}
      {loading ? (
        <LoadingState message="Loading work queue items..." />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Queue Empty"
          description="No active operational tasks pending in this stage. Great job!"
        />
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <Card
              key={item.id}
              className="p-5 flex flex-col gap-4 transition hover:border-surface-300 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-sm font-bold text-navy-900 bg-surface-100 px-2 py-0.5 rounded-lg border border-surface-200">
                    {item.requestNumber}
                  </span>
                  {getStageBadge(item.queueStage)}
                  <span className="text-xs text-navy-500">
                    Status: <StatusBadge status={item.status} />
                  </span>
                </div>
                <p className="text-sm font-bold text-navy-900">
                  {item.customerName} &bull; <span className="text-navy-600 font-normal">{item.vehicleSummary}</span>
                </p>
                <div className="flex items-center gap-4 text-xs text-navy-500 flex-wrap">
                  <span>Quotes received: <strong className="text-navy-800">{item.quotesReceivedCount}</strong></span>
                  {item.waitingSinceUtc && (
                    <span>Waiting since: {new Date(item.waitingSinceUtc).toLocaleDateString()}</span>
                  )}
                  {item.hasAdditionalWorkPending && (
                    <span className="font-bold text-rose-600">Extra parts/labor pending review</span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center">
                <Link href={item.actionUrl}>
                  <Button size="sm" variant="primary" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                    Action Task
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdvisorWorkQueuePage() {
  return (
    <Suspense fallback={<LoadingState message="Loading advisor work queue..." />}>
      <AdvisorWorkQueueContent />
    </Suspense>
  );
}
