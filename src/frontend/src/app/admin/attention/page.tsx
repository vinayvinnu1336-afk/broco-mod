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
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';

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
          <Badge variant="red" icon={AlertOctagon}>
            CRITICAL
          </Badge>
        );
      case 'WARNING':
        return (
          <Badge variant="amber" icon={AlertTriangle}>
            WARNING
          </Badge>
        );
      default:
        return (
          <Badge variant="blue" icon={Info}>
            INFO
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
            <h1 className="text-2xl font-bold tracking-tight text-navy-900">Operational Attention Queue</h1>
            <Badge variant="amber" icon={ShieldAlert}>
              Query-Driven Supervised Alerts
            </Badge>
          </div>
          <p className="mt-1 text-sm text-navy-600">
            Automated detection of SLA risks, expiring quotations, stale dispatches, and failed deliveries.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAttentionQueue}
            isLoading={refreshing}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-navy-600">
            <Filter className="h-3.5 w-3.5" /> Filter Severity:
          </div>
          {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                severityFilter === sev
                  ? 'bg-navy-900 text-white shadow-sm'
                  : 'bg-surface-100 text-navy-600 hover:bg-surface-200 hover:text-navy-900'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-navy-600">Category:</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs font-medium text-navy-900 focus:border-navy-900 focus:outline-none"
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
        <LoadingState message="Analyzing operational state..." />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Queue Clear"
          description="No service requests, dispatches, quotations, or notifications currently require intervention."
        />
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item, idx) => (
            <Card
              key={`${item.referenceId}-${idx}`}
              className="p-5 flex flex-col gap-4 transition hover:border-surface-300 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-3 flex-wrap">
                  {getSeverityBadge(item.severity)}
                  <span className="rounded-lg bg-surface-100 px-2 py-0.5 text-xs font-mono font-bold text-navy-800 border border-surface-200">
                    {item.referenceNumber}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-navy-500">
                    {item.category}
                  </span>
                </div>
                <h3 className="text-base font-bold text-navy-900">{item.title}</h3>
                <p className="text-sm text-navy-600">{item.description}</p>
                <div className="flex items-center gap-2 pt-1 text-xs text-navy-400">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Detected: {new Date(item.createdAtUtc).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center">
                <Link href={item.actionUrl}>
                  <Button size="sm" variant="secondary" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                    Investigate
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
