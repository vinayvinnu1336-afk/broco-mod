'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { AdminRequestSummary, PagedResult } from '@/types/adminOperations';
import {
  FileText,
  Search,
  Filter,
  Eye,
  Calendar,
  Building2,
  Clock,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<AdminRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadRequests = async (p = page, size = pageSize, search = searchTerm, status = statusFilter) => {
    setLoading(true);
    let url = `/admin/requests?page=${p}&pageSize=${size}`;
    if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;

    const res = await apiFetch<PagedResult<AdminRequestSummary>>(url);
    if (res.success && res.data) {
      setRequests(res.data.items);
      setPage(res.data.pageNumber);
      setTotalPages(res.data.totalPages);
      setTotalCount(res.data.totalCount);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadRequests(1, pageSize, searchTerm, statusFilter);
  }, [pageSize, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadRequests(1, pageSize, searchTerm, statusFilter);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">Platform Service Requests</h1>
          <p className="mt-1 text-sm text-navy-600">
            Supervise end-to-end lifecycle, customer complaints, dispatched workshops, and quotation progress.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setRefreshing(true); loadRequests(); }}
            isLoading={refreshing}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-surface-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-navy-400" />
          <input
            type="text"
            placeholder="Search by request #, customer, vehicle plate..."
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
              <option value="">All Statuses</option>
              <option value="Submitted">Submitted</option>
              <option value="Dispatched">Dispatched</option>
              <option value="QuotesReceived">Quotes Received</option>
              <option value="AdvisorReview">Advisor Review</option>
              <option value="QuotationAccepted">Quotation Accepted</option>
              <option value="Confirmed">Booking Confirmed</option>
              <option value="Completed">Completed</option>
              <option value="QuotationRejected">Declined</option>
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

      {/* Requests Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-surface-200 bg-surface-50 text-navy-500 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5 font-bold">Request</th>
                <th className="px-5 py-3.5 font-bold">Customer</th>
                <th className="px-5 py-3.5 font-bold">Vehicle</th>
                <th className="px-5 py-3.5 font-bold">Status</th>
                <th className="px-5 py-3.5 font-bold">Advisor</th>
                <th className="px-5 py-3.5 font-bold">Quotes</th>
                <th className="px-5 py-3.5 font-bold">Assigned Garage</th>
                <th className="px-5 py-3.5 font-bold">Created</th>
                <th className="px-5 py-3.5 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-navy-500">
                    <LoadingState message="Loading platform requests..." />
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-navy-500">
                    <EmptyState
                      icon={FileText}
                      title="No requests found"
                      description="No service requests match the specified search or filter criteria."
                    />
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="transition hover:bg-surface-50/50">
                    <td className="px-5 py-4 font-mono font-bold text-navy-900">
                      <Link href={`/admin/requests/${req.id}`} className="hover:text-electric-600">
                        {req.requestNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-navy-900">
                      <div className="font-semibold">{req.customerName}</div>
                      <div className="text-[11px] text-navy-500">{req.customerEmail}</div>
                    </td>
                    <td className="px-5 py-4 text-navy-700">
                      <div className="font-medium">{req.vehicleMake} {req.vehicleModel}</div>
                      <div className="text-[11px] text-navy-500 font-mono">{req.vehicleLicensePlate}</div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="px-5 py-4 text-navy-600">
                      {req.assignedAdvisorName ? (
                        <span className="font-medium text-navy-800">{req.assignedAdvisorName}</span>
                      ) : (
                        <span className="text-navy-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-navy-700">
                      <span className="font-bold text-navy-900">{req.quotesReceivedCount}</span> / {req.dispatchedGaragesCount} dispatched
                    </td>
                    <td className="px-5 py-4 text-navy-700">
                      {req.assignedGarageName ? (
                        <span className="text-emerald-700 font-bold">{req.assignedGarageName}</span>
                      ) : (
                        <span className="text-navy-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-navy-500 whitespace-nowrap">
                      {new Date(req.createdAtUtc).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/admin/requests/${req.id}`}>
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
              onPageChange={(p) => loadRequests(p, pageSize, searchTerm, statusFilter)}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
