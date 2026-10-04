'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { AdminJobListItem, PagedResult } from '@/types/adminOperations';
import {
  Wrench,
  Search,
  Filter,
  Eye,
  Building2,
  Calendar,
  Clock,
  RefreshCw
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<AdminJobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadJobs = async (p = page, size = pageSize, search = searchTerm, status = statusFilter) => {
    setLoading(true);
    let url = `/admin/jobs?page=${p}&pageSize=${size}`;
    if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;

    const res = await apiFetch<PagedResult<AdminJobListItem>>(url);
    if (res.success && res.data) {
      setJobs(res.data.items);
      setPage(res.data.pageNumber);
      setTotalPages(res.data.totalPages);
      setTotalCount(res.data.totalCount);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadJobs(1, pageSize, searchTerm, statusFilter);
  }, [pageSize, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadJobs(1, pageSize, searchTerm, statusFilter);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">Workshop Service Job Operations</h1>
          <p className="mt-1 text-sm text-navy-600">
            Supervise live service execution across partner workshops, vehicle reception, inspections, and completion.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setRefreshing(true); loadJobs(); }}
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
            placeholder="Search by job #, garage, customer..."
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
              <option value="">All Job Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="VehicleReceived">Vehicle Received</option>
              <option value="Inspection">Inspection</option>
              <option value="WorkStarted">Work Started</option>
              <option value="WorkInProgress">Work In Progress</option>
              <option value="HandedOver">Handed Over</option>
              <option value="Closed">Closed</option>
              <option value="Cancelled">Cancelled</option>
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

      {/* Jobs Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-surface-200 bg-surface-50 text-navy-500 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5 font-bold">Job Number</th>
                <th className="px-5 py-3.5 font-bold">Workshop</th>
                <th className="px-5 py-3.5 font-bold">Customer & Vehicle</th>
                <th className="px-5 py-3.5 font-bold">Status</th>
                <th className="px-5 py-3.5 font-bold">Scheduled</th>
                <th className="px-5 py-3.5 font-bold">Received</th>
                <th className="px-5 py-3.5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-navy-500">
                    <LoadingState message="Loading service jobs..." />
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-navy-500">
                    <EmptyState
                      icon={Wrench}
                      title="No service jobs found"
                      description="No jobs match the current filter or search criteria."
                    />
                  </td>
                </tr>
              ) : (
                jobs.map((j) => (
                  <tr key={j.id} className="transition hover:bg-surface-50/50">
                    <td className="px-5 py-4 font-mono font-bold text-navy-900">
                      <div>{j.jobNumber}</div>
                      <div className="text-[10px] text-navy-500 font-normal">Req: {j.requestNumber}</div>
                    </td>
                    <td className="px-5 py-4 font-bold text-navy-900">
                      {j.garageName}
                    </td>
                    <td className="px-5 py-4 text-navy-700">
                      <div className="font-semibold text-navy-900">{j.customerName}</div>
                      <div className="text-[11px] text-navy-500">{j.vehicleSummary}</div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={j.status} />
                    </td>
                    <td className="px-5 py-4 text-navy-500 whitespace-nowrap text-xs">
                      {j.scheduledStartAtUtc ? new Date(j.scheduledStartAtUtc).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-4 text-navy-500 whitespace-nowrap text-xs">
                      {j.vehicleReceivedAtUtc ? new Date(j.vehicleReceivedAtUtc).toLocaleDateString() : 'Pending'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/admin/requests/${j.serviceRequestId}`}>
                        <Button size="sm" variant="secondary" leftIcon={<Eye className="h-3.5 w-3.5" />}>
                          Timeline
                        </Button>
                      </Link>
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
              onPageChange={(p) => loadJobs(p, pageSize, searchTerm, statusFilter)}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
