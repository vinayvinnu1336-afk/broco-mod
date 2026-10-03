'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PagedResult } from '@/types/adminOperations';
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  FileJson,
  ShieldCheck,
  Calendar,
  Lock
} from 'lucide-react';

interface AuditLogItem {
  id: string;
  action: string;
  userEmail?: string;
  entityName?: string;
  entityId?: string;
  details?: string;
  ipAddress?: string;
  timestampUtc: string;
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  // JSON viewer modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const loadLogs = async (p = page, size = pageSize, action = actionFilter, entity = entityFilter) => {
    setLoading(true);
    let url = `/admin/audit?page=${p}&pageSize=${size}`;
    if (action.trim()) url += `&action=${encodeURIComponent(action.trim())}`;
    if (entity.trim()) url += `&entityName=${encodeURIComponent(entity.trim())}`;

    const res = await apiFetch<PagedResult<AuditLogItem>>(url);
    if (res.success && res.data) {
      setLogs(res.data.items);
      setPage(res.data.pageNumber);
      setTotalPages(res.data.totalPages);
      setTotalCount(res.data.totalCount);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadLogs(1, pageSize, actionFilter, entityFilter);
  }, [pageSize, actionFilter, entityFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Security & Operations Audit Explorer</h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
              <Lock className="h-3 w-3" /> Append-Only Immutable Ledger
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-400">
            Complete operational audit trail of role actions, garage status changes, quote reviews, and security events.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setRefreshing(true); loadLogs(); }}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3.5 py-2 text-sm font-medium text-neutral-200 transition hover:bg-neutral-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Retention Policy Banner */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
          <p className="text-xs text-neutral-300">
            <span className="font-semibold text-white">Data Retention Policy:</span> Audit logs are retained permanently in compliance with platform security standards. Events are cryptographically timestamped and protected from manual modification or deletion.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-neutral-400" />
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs text-neutral-200 focus:border-red-500 focus:outline-none"
            >
              <option value="">All Entities</option>
              <option value="Garage">Garage</option>
              <option value="ServiceRequest">ServiceRequest</option>
              <option value="CustomerQuotation">CustomerQuotation</option>
              <option value="AdvisorProfile">AdvisorProfile</option>
              <option value="User">User</option>
              <option value="Notification">Notification</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Filter by action (e.g. GARAGE_VERIFIED)..."
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:border-red-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">Page size:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-2 text-xs text-neutral-200 focus:border-red-500 focus:outline-none"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/50 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-neutral-800 bg-neutral-900 text-neutral-400 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Action</th>
                <th className="px-5 py-3.5 font-semibold">Actor</th>
                <th className="px-5 py-3.5 font-semibold">Entity</th>
                <th className="px-5 py-3.5 font-semibold">Details</th>
                <th className="px-5 py-3.5 font-semibold">IP Address</th>
                <th className="px-5 py-3.5 font-semibold">Timestamp</th>
                <th className="px-5 py-3.5 font-semibold text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                      Loading audit events...
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    No audit logs match the specified filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="transition hover:bg-neutral-800/40">
                    <td className="px-5 py-4 font-mono font-semibold text-white">
                      {log.action}
                    </td>
                    <td className="px-5 py-4 text-neutral-300">
                      {log.userEmail || <span className="text-neutral-500">System</span>}
                    </td>
                    <td className="px-5 py-4">
                      {log.entityName ? (
                        <span className="rounded bg-neutral-800 px-2 py-0.5 text-[11px] font-medium text-neutral-300">
                          {log.entityName}
                        </span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-neutral-300 max-w-xs truncate">
                      {log.details || <span className="text-neutral-600">—</span>}
                    </td>
                    <td className="px-5 py-4 font-mono text-[11px] text-neutral-400">
                      {log.ipAddress || '—'}
                    </td>
                    <td className="px-5 py-4 text-neutral-500 whitespace-nowrap">
                      {new Date(log.timestampUtc).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="rounded bg-neutral-800 p-1.5 text-neutral-300 hover:bg-neutral-700 hover:text-white"
                        title="View Full Event"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-neutral-800 bg-neutral-900/80 px-5 py-3 sm:flex-row">
          <span className="text-xs text-neutral-400">
            Showing <span className="font-medium text-white">{logs.length}</span> of{' '}
            <span className="font-medium text-white">{totalCount}</span> total audit records
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadLogs(page - 1, pageSize, actionFilter, entityFilter)}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300 transition hover:bg-neutral-700 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <span className="text-xs text-neutral-400">
              Page {page} of {Math.max(1, totalPages)}
            </span>
            <button
              onClick={() => loadLogs(page + 1, pageSize, actionFilter, entityFilter)}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300 transition hover:bg-neutral-700 disabled:opacity-40"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <FileJson className="h-4 w-4 text-red-400" />
                <h3 className="text-sm font-semibold text-white font-mono">
                  {selectedLog.action}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <span className="text-neutral-400 font-semibold">Event ID:</span>
                <p className="font-mono text-neutral-300 mt-0.5">{selectedLog.id}</p>
              </div>
              <div>
                <span className="text-neutral-400 font-semibold">Actor Email:</span>
                <p className="text-neutral-200 mt-0.5">{selectedLog.userEmail || 'System Process'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-neutral-400 font-semibold">Target Entity:</span>
                  <p className="text-neutral-200 mt-0.5">{selectedLog.entityName || 'None'}</p>
                </div>
                <div>
                  <span className="text-neutral-400 font-semibold">Entity ID:</span>
                  <p className="font-mono text-neutral-300 mt-0.5">{selectedLog.entityId || 'None'}</p>
                </div>
              </div>
              <div>
                <span className="text-neutral-400 font-semibold">Event Details:</span>
                <pre className="mt-1 max-h-48 overflow-auto rounded bg-neutral-950 p-3 font-mono text-[11px] text-neutral-300 whitespace-pre-wrap">
                  {selectedLog.details || 'No additional details logged.'}
                </pre>
              </div>
              <div className="flex items-center justify-between text-neutral-500 pt-2 border-t border-neutral-800 text-[11px]">
                <span>Origin IP: {selectedLog.ipAddress || 'Internal'}</span>
                <span>{new Date(selectedLog.timestampUtc).toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-lg bg-neutral-800 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
