'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { AdminAttentionQueue, AttentionItem } from '@/types/adminOperations';
import { 
  AlertTriangle, 
  AlertOctagon, 
  Info, 
  RefreshCw, 
  ArrowRight,
  Filter,
  CheckCircle2,
  Clock,
  ShieldAlert
} from 'lucide-react';

export default function AdminAttentionQueuePage() {
  const [data, setData] = useState<AdminAttentionQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const loadAttentionQueue = async () => {
    setRefreshing(true);
    const res = await apiFetch<AdminAttentionQueue>('/admin/attention');
    if (res.success && res.data) {
      setData(res.data);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadAttentionQueue();
  }, []);

  const items = data?.items ?? [];
  const filteredItems = items.filter((item) => {
    if (severityFilter !== 'ALL' && item.severity !== severityFilter) return false;
    if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
    return true;
  });

  const categories = Array.from(new Set(items.map((i) => i.category)));

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-400">
            <AlertOctagon className="h-3.5 w-3.5" /> CRITICAL
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" /> WARNING
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400">
            <Info className="h-3.5 w-3.5" /> INFO
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
            <h1 className="text-2xl font-bold tracking-tight text-white">Operational Attention Queue</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
              <ShieldAlert className="h-3 w-3" /> Query-Driven Supervised Alerts
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-400">
            Automated detection of SLA risks, expiring quotations, stale dispatches, and failed deliveries.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadAttentionQueue}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3.5 py-2 text-sm font-medium text-neutral-200 transition hover:bg-neutral-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Queue
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-400">
            <Filter className="h-3.5 w-3.5" /> Filter Severity:
          </div>
          {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                severityFilter === sev
                  ? 'bg-neutral-700 text-white font-semibold'
                  : 'bg-neutral-800/60 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-neutral-400">Category:</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 focus:border-red-500 focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Attention Items List */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
            <p className="text-sm text-neutral-400">Analyzing operational state...</p>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-12 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400 mb-3" />
          <h3 className="text-base font-semibold text-white">Queue Clear</h3>
          <p className="mt-1 text-sm text-neutral-400">
            No service requests, dispatches, quotations, or notifications currently require intervention.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item, idx) => (
            <div
              key={`${item.referenceId}-${idx}`}
              className="flex flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 transition hover:border-neutral-700 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-3 flex-wrap">
                  {getSeverityBadge(item.severity)}
                  <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-mono font-medium text-neutral-300">
                    {item.referenceNumber}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    {item.category}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white">{item.title}</h3>
                <p className="text-sm text-neutral-300">{item.description}</p>
                <div className="flex items-center gap-2 pt-1 text-xs text-neutral-500">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Detected: {new Date(item.createdAtUtc).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center">
                <Link
                  href={item.actionUrl}
                  className="inline-flex items-center gap-2 rounded-lg bg-neutral-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-neutral-700 hover:text-red-400"
                >
                  Investigate <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
