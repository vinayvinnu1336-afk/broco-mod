'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PagedResult } from '@/types/adminOperations';
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Eye,
  X,
  FileJson,
  ShieldCheck,
  Calendar,
  Lock
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';

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
            <h1 className="text-2xl font-bold tracking-tight text-navy-900">Security & Operations Audit Explorer</h1>
            <Badge variant="red" icon={Lock}>
              Append-Only Immutable Ledger
            </Badge>
          </div>
          <p className="mt-1 text-sm text-navy-600">
            Complete operational audit trail of role actions, garage status changes, quote reviews, and security events.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setRefreshing(true); loadLogs(); }}
            isLoading={refreshing}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Retention Policy Banner */}
      <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
          <p className="text-xs text-navy-700">
            <strong className="text-navy-900 font-bold">Data Retention Policy:</strong> Audit logs are retained permanently in compliance with platform security standards. Events are cryptographically timestamped and protected from manual modification or deletion.
          </p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-surface-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col sm:flex-row items-center gap-3 max-w-xl">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-navy-400" />
            <input
              type="text"
              placeholder="Filter by action name (e.g. GarageStatusUpdated)..."
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full rounded-xl border border-surface-200 bg-surface-50 pl-9 pr-4 py-2 text-xs text-navy-900 placeholder-navy-400 focus:border-navy-900 focus:outline-none"
            />
          </div>
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Filter by entity (e.g. ServiceRequest)..."
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2 text-xs text-navy-900 placeholder-navy-400 focus:border-navy-900 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-navy-500">Page size:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-xl border border-surface-200 bg-surface-50 px-2.5 py-2 text-xs text-navy-900 focus:border-navy-900 focus:outline-none"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-surface-200 bg-surface-50 text-navy-500 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5 font-bold">Action</th>
                <th className="px-5 py-3.5 font-bold">Actor / User</th>
                <th className="px-5 py-3.5 font-bold">Target Entity</th>
                <th className="px-5 py-3.5 font-bold">Summary / Details</th>
                <th className="px-5 py-3.5 font-bold">IP Address</th>
                <th className="px-5 py-3.5 font-bold">Timestamp (UTC)</th>
                <th className="px-5 py-3.5 font-bold text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-navy-500">
                    <LoadingState message="Loading immutable audit logs..." />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-navy-500">
                    <EmptyState
                      icon={ShieldAlert}
                      title="No audit logs found"
                      description="No recorded platform actions match the specified filters."
                    />
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="transition hover:bg-surface-50/50">
                    <td className="px-5 py-4 font-mono font-bold text-navy-900">
                      {l.action}
                    </td>
                    <td className="px-5 py-4 text-navy-900 font-medium">
                      {l.userEmail || <span className="text-navy-400 italic font-normal">System / Job</span>}
                    </td>
                    <td className="px-5 py-4 text-navy-700">
                      {l.entityName ? (
                        <div>
                          <span className="font-semibold text-navy-900">{l.entityName}</span>
                          {l.entityId && (
                            <span className="block font-mono text-[10px] text-navy-400">
                              ID: {l.entityId.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-navy-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-navy-600 max-w-sm truncate" title={l.details}>
                      {l.details || '—'}
                    </td>
                    <td className="px-5 py-4 font-mono text-[11px] text-navy-500">
                      {l.ipAddress || '—'}
                    </td>
                    <td className="px-5 py-4 text-navy-500 whitespace-nowrap font-mono text-[11px]">
                      {new Date(l.timestampUtc).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedLog(l)}
                        leftIcon={<FileJson className="h-3.5 w-3.5" />}
                      >
                        JSON
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalCount > 0 && (
          <div className="p-4 border-t border-surface-200">
            <Pagination
              currentPage={page}
              totalPages={Math.max(1, totalPages)}
              totalItems={totalCount}
              pageSize={pageSize}
              onPageChange={(p) => loadLogs(p, pageSize, actionFilter, entityFilter)}
            />
          </div>
        )}
      </Card>

      {/* JSON Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-surface-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-surface-100 pb-3">
              <div className="flex items-center gap-2">
                <FileJson className="h-5 w-5 text-electric-600" />
                <h3 className="text-base font-bold text-navy-900 font-mono">
                  Audit Record: {selectedLog.action}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-navy-400 hover:text-navy-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Raw Event Payload:</span>
              <pre className="max-h-96 overflow-auto rounded-xl border border-surface-200 bg-surface-50 p-4 text-[11px] font-mono text-navy-900">
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedLog(null)}
              >
                Close Payload
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
