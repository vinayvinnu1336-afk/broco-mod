'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminNotificationList, PagedResult } from '@/types/adminOperations';
import { Bell, ChevronLeft, ChevronRight, RefreshCw, RotateCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterChips } from '@/components/ui/FilterChips';
import { ListGroup, ListItem } from '@/components/ui/ListItem';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { formatDateTime, formatRelative, humanize } from '@/lib/format';

// Values are the API's status filter values; labels are what operators read.
const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'Failed', label: 'Failed' },
  { value: 'Pending', label: 'Waiting to send' },
  { value: 'Sent', label: 'Sent' },
];

export default function AdminNotificationsPage() {
  const toast = useToast();
  const [notifications, setNotifications] = useState<AdminNotificationList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  // The search the current results were loaded with (paging keeps it even if the box is edited).
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadNotifications = useCallback(async (p: number, size: number, search: string, status: string) => {
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
      setError(null);
    } else {
      setError(res.message || 'Could not load notifications.');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadNotifications(1, pageSize, appliedSearch, statusFilter);
  }, [loadNotifications, pageSize, statusFilter, appliedSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm === appliedSearch) {
      loadNotifications(1, pageSize, searchTerm, statusFilter);
    } else {
      setAppliedSearch(searchTerm);
    }
  };

  const goToPage = (p: number) => {
    loadNotifications(p, pageSize, appliedSearch, statusFilter);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const refresh = () => {
    setRefreshing(true);
    loadNotifications(page, pageSize, appliedSearch, statusFilter);
  };

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    const res = await apiFetch(`/admin/notifications/${id}/retry`, {
      method: 'POST',
    });
    setRetryingId(null);

    if (res.success) {
      toast.success('Notification queued to send again');
      loadNotifications(page, pageSize, appliedSearch, statusFilter);
    } else {
      toast.error('Retry failed', res.message || 'The notification could not be re-sent.');
    }
  };

  const safeTotalPages = Math.max(1, totalPages);
  const lastActivity = (n: AdminNotificationList) => n.lastAttemptAtUtc || n.createdAtUtc;

  const retryButton = (n: AdminNotificationList, fullWidth = false) =>
    n.status === 'Failed' ? (
      <Button
        variant="outline"
        size="sm"
        className={fullWidth ? 'w-full' : ''}
        onClick={() => handleRetry(n.id)}
        isLoading={retryingId === n.id}
        disabled={retryingId !== null && retryingId !== n.id}
        leftIcon={<RotateCw className="h-3.5 w-3.5" />}
      >
        Retry
      </Button>
    ) : null;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Notifications"
        description="Messages sent to customers, garages and staff. Failed ones can be sent again."
        actions={
          <Button variant="outline" onClick={refresh} isLoading={refreshing} leftIcon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
        }
      />

      {/* Search and filters */}
      <div className="space-y-3">
        <form onSubmit={handleSearchSubmit} role="search" className="flex gap-2">
          <div className="min-w-0 flex-1 sm:max-w-md">
            <Input
              type="search"
              aria-label="Search notifications"
              enterKeyHint="search"
              placeholder="Recipient, title or type"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <Button type="submit" variant="outline" className="hidden shrink-0 sm:inline-flex">
            Search
          </Button>
        </form>

        <FilterChips options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} ariaLabel="Filter by delivery status" />

        <div className="flex items-center justify-between gap-3 text-xs text-navy-500">
          <span>
            {loading ? 'Loading…' : `${totalCount} ${totalCount === 1 ? 'notification' : 'notifications'}`}
            {appliedSearch.trim() && !loading && <> matching “{appliedSearch.trim()}”</>}
          </span>
          <label className="flex items-center gap-2">
            Per page
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="min-h-[36px] rounded-lg border border-surface-200 bg-white px-2 text-sm text-navy-900 focus:border-electric-600 focus:outline-none focus:ring-2 focus:ring-electric-600/20"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading notifications..." />
      ) : error ? (
        <ErrorState title="Could not load notifications" error={error} onRetry={refresh} />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications found"
          description={
            appliedSearch.trim() || statusFilter
              ? 'No notifications match this search or filter.'
              : 'Notifications appear here as the platform sends them.'
          }
        />
      ) : (
        <>
          {/* Phones */}
          <div className="md:hidden">
            <ListGroup>
              {notifications.map((n) => (
                <ListItem
                  key={n.id}
                  title={n.title}
                  subtitle={n.userEmail}
                  meta={
                    <>
                      {humanize(n.type)} · {formatRelative(lastActivity(n))}
                      {n.retryCount > 0 && ` · ${n.retryCount} ${n.retryCount === 1 ? 'retry' : 'retries'}`}
                      {n.errorSummary && (
                        <span className="mt-1 block whitespace-normal break-words text-red-600">{n.errorSummary}</span>
                      )}
                      {n.status === 'Failed' && <span className="mt-2 block">{retryButton(n, true)}</span>}
                    </>
                  }
                  trailing={<StatusBadge status={n.status} />}
                />
              ))}
            </ListGroup>
          </div>

          {/* Tablets and laptops */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Notification</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Retries</TableHead>
                  <TableHead className="hidden lg:table-cell">Error</TableHead>
                  <TableHead>Last attempt</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="max-w-[14rem] truncate font-medium text-navy-900">{n.userEmail}</TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate font-medium text-navy-900">{n.title}</div>
                      <div className="text-xs text-navy-500">{humanize(n.type)}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={n.status} />
                    </TableCell>
                    <TableCell className="hidden tabular-nums lg:table-cell">{n.retryCount}</TableCell>
                    <TableCell className="hidden max-w-xs lg:table-cell">
                      {n.errorSummary ? (
                        <span className="line-clamp-2 text-xs text-red-600" title={n.errorSummary}>
                          {n.errorSummary}
                        </span>
                      ) : (
                        <span className="text-navy-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-navy-500">{formatDateTime(lastActivity(n))}</TableCell>
                    <TableCell className="text-right">{retryButton(n)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Pagination */}
      {totalCount > 0 && !error && (
        <>
          {safeTotalPages > 1 && (
            <div className="flex items-center gap-3 md:hidden">
              <Button
                variant="outline"
                className="flex-1"
                disabled={page <= 1 || loading}
                onClick={() => goToPage(page - 1)}
                leftIcon={<ChevronLeft className="h-4 w-4" />}
              >
                Previous
              </Button>
              <span className="shrink-0 text-sm tabular-nums text-navy-500">
                {page} / {safeTotalPages}
              </span>
              <Button
                variant="outline"
                className="flex-1"
                disabled={page >= safeTotalPages || loading}
                onClick={() => goToPage(page + 1)}
                rightIcon={<ChevronRight className="h-4 w-4" />}
              >
                Next
              </Button>
            </div>
          )}
          <div className="hidden md:block">
            <Pagination
              currentPage={page}
              totalPages={safeTotalPages}
              totalItems={totalCount}
              pageSize={pageSize}
              onPageChange={goToPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
