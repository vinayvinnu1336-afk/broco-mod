'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminNotificationList, PagedResult } from '@/types/adminOperations';
import {
  Bell,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCw,
  Mail,
  AlertOctagon
} from 'lucide-react';

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<AdminNotificationList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadNotifications = async (p = page, size = pageSize, search = searchTerm, status = statusFilter) => {
    setLoading(true);
    let url = `/admin/notifications?page=${p}&pageSize=${size}`;
    if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;

    const res = await apiFetch<PagedResult<AdminNotificationList>>(url);
    if (res.success && res.data) {
      setNotifications(res.data.items);
      setPage(res.data.pageNumber);
      setTotalPages(res.data.totalPages);
      setTotalCount(res.data.totalCount);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadNotifications(1, pageSize, searchTerm, statusFilter);
  }, [pageSize, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadNotifications(1, pageSize, searchTerm, statusFilter);
  };

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    const res = await apiFetch(`/admin/notifications/${id}/retry`, {
      method: 'POST',
    });
    setRetryingId(null);

    if (res.success) {
      loadNotifications();
    } else {
      alert(res.message || 'Retry failed');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Sent':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
      case 'Failed':
        return 'border-rose-500/30 bg-rose-500/10 text-rose-400';
      case 'Pending':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
      default:
        return 'border-neutral-700 bg-neutral-800 text-neutral-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Notification Delivery & Health</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Monitor automated transactional notifications, delivery attempts, error logs, and trigger controlled retries.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setRefreshing(true); loadNotifications(); }}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3.5 py-2 text-sm font-medium text-neutral-200 transition hover:bg-neutral-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search notifications by recipient email, title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:border-red-500 focus:outline-none"
          />
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-neutral-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs text-neutral-200 focus:border-red-500 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="Failed">Failed Only</option>
              <option value="Sent">Sent Successfully</option>
              <option value="Pending">Pending</option>
            </select>
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
      </div>

      {/* Notifications Table */}
      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/50 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-neutral-800 bg-neutral-900 text-neutral-400 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Recipient</th>
                <th className="px-5 py-3.5 font-semibold">Title & Type</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
                <th className="px-5 py-3.5 font-semibold">Retries</th>
                <th className="px-5 py-3.5 font-semibold">Last Attempt / Created</th>
                <th className="px-5 py-3.5 font-semibold">Error Summary</th>
                <th className="px-5 py-3.5 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                      Loading notifications...
                    </div>
                  </td>
                </tr>
              ) : notifications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    No notifications match the specified filters.
                  </td>
                </tr>
              ) : (
                notifications.map((notif) => (
                  <tr key={notif.id} className="transition hover:bg-neutral-800/40">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 font-medium text-white">
                        <Mail className="h-3.5 w-3.5 text-neutral-400" />
                        {notif.userEmail}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-neutral-200">{notif.title}</div>
                      <span className="font-mono text-[10px] text-neutral-500 uppercase">{notif.type}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${getStatusBadge(notif.status)}`}>
                        {notif.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-neutral-300">
                      {notif.retryCount}
                    </td>
                    <td className="px-5 py-4 text-neutral-400 whitespace-nowrap text-[11px]">
                      {notif.lastAttemptAtUtc
                        ? new Date(notif.lastAttemptAtUtc).toLocaleString()
                        : new Date(notif.createdAtUtc).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-neutral-400 max-w-xs truncate">
                      {notif.errorSummary ? (
                        <span className="text-rose-400 font-mono text-[11px]">{notif.errorSummary}</span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {notif.status === 'Failed' && (
                        <button
                          onClick={() => handleRetry(notif.id)}
                          disabled={retryingId === notif.id}
                          className="inline-flex items-center gap-1.5 rounded bg-neutral-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-neutral-700 hover:text-emerald-400 disabled:opacity-50 transition"
                        >
                          <RotateCw className={`h-3 w-3 ${retryingId === notif.id ? 'animate-spin' : ''}`} />
                          Retry
                        </button>
                      )}
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
            Showing <span className="font-medium text-white">{notifications.length}</span> of{' '}
            <span className="font-medium text-white">{totalCount}</span> total notification events
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadNotifications(page - 1, pageSize, searchTerm, statusFilter)}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300 transition hover:bg-neutral-700 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <span className="text-xs text-neutral-400">
              Page {page} of {Math.max(1, totalPages)}
            </span>
            <button
              onClick={() => loadNotifications(page + 1, pageSize, searchTerm, statusFilter)}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300 transition hover:bg-neutral-700 disabled:opacity-40"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
