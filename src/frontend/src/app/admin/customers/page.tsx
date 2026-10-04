'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { AdminCustomerList, PagedResult } from '@/types/adminOperations';
import {
  Users,
  Search,
  Eye,
  CarFront,
  FileText,
  RefreshCw
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomerList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  const loadCustomers = async (p = page, size = pageSize, search = searchTerm) => {
    setLoading(true);
    let url = `/admin/customers?page=${p}&pageSize=${size}`;
    if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

    const res = await apiFetch<PagedResult<AdminCustomerList>>(url);
    if (res.success && res.data) {
      setCustomers(res.data.items);
      setPage(res.data.pageNumber);
      setTotalPages(res.data.totalPages);
      setTotalCount(res.data.totalCount);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadCustomers(1, pageSize, searchTerm);
  }, [pageSize]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadCustomers(1, pageSize, searchTerm);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">Customer Account Directory</h1>
          <p className="mt-1 text-sm text-navy-600">
            Platform registered customer profiles, linked vehicle fleets, and complete service histories.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setRefreshing(true); loadCustomers(); }}
            isLoading={refreshing}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-surface-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-navy-400" />
          <input
            type="text"
            placeholder="Search customer by name, email, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-surface-200 bg-surface-50 pl-9 pr-4 py-2 text-xs text-navy-900 placeholder-navy-400 focus:border-navy-900 focus:outline-none"
          />
        </form>

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

      {/* Customers Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-surface-200 bg-surface-50 text-navy-500 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5 font-bold">Customer</th>
                <th className="px-5 py-3.5 font-bold">Phone</th>
                <th className="px-5 py-3.5 font-bold">Vehicles Registered</th>
                <th className="px-5 py-3.5 font-bold">Service Requests</th>
                <th className="px-5 py-3.5 font-bold">Joined</th>
                <th className="px-5 py-3.5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-navy-500">
                    <LoadingState message="Loading customers..." />
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-navy-500">
                    <EmptyState
                      icon={Users}
                      title="No customers found"
                      description="No customer accounts match your search query."
                    />
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="transition hover:bg-surface-50/50">
                    <td className="px-5 py-4">
                      <Link href={`/admin/customers/${c.id}`} className="font-bold text-navy-900 hover:text-electric-600">
                        {c.fullName}
                      </Link>
                      <div className="text-[11px] text-navy-500">{c.email}</div>
                    </td>
                    <td className="px-5 py-4 text-navy-700 font-medium">
                      {c.phoneNumber || <span className="text-navy-400 font-normal">—</span>}
                    </td>
                    <td className="px-5 py-4 text-navy-700">
                      <span className="inline-flex items-center gap-1 font-bold text-navy-900">
                        <CarFront className="h-3.5 w-3.5 text-navy-400" />
                        {c.vehiclesCount}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-navy-700">
                      <span className="inline-flex items-center gap-1 font-bold text-navy-900">
                        <FileText className="h-3.5 w-3.5 text-navy-400" />
                        {c.requestsCount}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-navy-500 whitespace-nowrap">
                      {new Date(c.createdAtUtc).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/admin/customers/${c.id}`}>
                        <Button size="sm" variant="secondary" leftIcon={<Eye className="h-3.5 w-3.5" />}>
                          Profile
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
              onPageChange={(p) => loadCustomers(p, pageSize, searchTerm)}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
