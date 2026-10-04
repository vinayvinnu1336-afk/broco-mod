'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminNotificationList, PagedResult } from '@/types/adminOperations';
import {
  Bell,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCw,
  Mail,
  AlertOctagon
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">Notification Delivery & Health</h1>
          <p className="mt-1 text-sm text-navy-600">
            Monitor automated transactional notifications, delivery attempts, error logs, and trigger controlled retries.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setRefreshing(true); loadNotifications(); }}
            isLoading={refreshing}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-surface-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-navy-400" />
          <input
            type="text"
            placeholder="Search notifications by recipient, subject, event..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-surface-200 bg-surface-50 pl-9 pr-4 py-2 text-xs text-navy-900 placeholder-navy-400 focus:border-navy-900 focus:outline-none"
          />
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-navy-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-xs text-navy-900 focus:border-navy-900 focus:outline-none"
            >
              <option value="">All Delivery Statuses</option>
              <option value="Sent">Sent Successfully</option>
              <option value="Failed">Failed Delivery</option>
              <option value="Pending">Pending / In Queue</option>
            </select>
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
      </div>

      {/* Notifications Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-surface-200 bg-surface-50 text-navy-500 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5 font-bold">Recipient</th>
                <th className="px-5 py-3.5 font-bold">Title / Type</th>
                <th className="px-5 py-3.5 font-bold">Status</th>
                <th className="px-5 py-3.5 font-bold">Retries</th>
                <th className="px-5 py-3.5 font-bold">Error Summary</th>
                <th className="px-5 py-3.5 font-bold">Timestamp</th>
                <th className="px-5 py-3.5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-navy-500">
                    <LoadingState message="Loading platform notifications..." />
                  </td>
                </tr>
              ) : notifications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-navy-500">
                    <EmptyState
                      icon={Bell}
                      title="No notifications found"
                      description="No notification deliveries match the current filters."
                    />
                  </td>
                </tr>
              ) : (
                notifications.map((n) => (
                  <tr key={n.id} className="transition hover:bg-surface-50/50">
                    <td className="px-5 py-4 font-medium text-navy-900">
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-navy-400" />
                        <span>{n.userEmail}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-navy-700 max-w-xs">
                      <div className="font-semibold text-navy-900 truncate">{n.title}</div>
                      <span className="font-mono text-[10px] text-navy-500 uppercase">{n.type}</span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={n.status} />
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-navy-800">
                      {n.retryCount}
                    </td>
                    <td className="px-5 py-4 text-rose-600 text-[11px] max-w-xs truncate">
                      {n.errorSummary || <span className="text-navy-400 font-normal">—</span>}
                    </td>
                    <td className="px-5 py-4 text-navy-500 whitespace-nowrap text-xs">
                      {n.lastAttemptAtUtc
                        ? new Date(n.lastAttemptAtUtc).toLocaleString()
                        : new Date(n.createdAtUtc).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {n.status === 'Failed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetry(n.id)}
                          isLoading={retryingId === n.id}
                          leftIcon={<RotateCw className="h-3 w-3" />}
                        >
                          Retry
                        </Button>
                      )}
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
              onPageChange={(p) => loadNotifications(p, pageSize, searchTerm, statusFilter)}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
