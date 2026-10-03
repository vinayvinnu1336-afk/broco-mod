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
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

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
          <h1 className="text-2xl font-bold tracking-tight text-white">Customer Account Directory</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Platform registered customer profiles, linked vehicle fleets, and complete service histories.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setRefreshing(true); loadCustomers(); }}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3.5 py-2 text-sm font-medium text-neutral-200 transition hover:bg-neutral-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="flex flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search customer by name, email, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:border-red-500 focus:outline-none"
          />
        </form>

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

      {/* Customers Table */}
      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/50 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-neutral-800 bg-neutral-900 text-neutral-400 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Customer</th>
                <th className="px-5 py-3.5 font-semibold">Phone</th>
                <th className="px-5 py-3.5 font-semibold">Vehicles</th>
                <th className="px-5 py-3.5 font-semibold">Requests</th>
                <th className="px-5 py-3.5 font-semibold">Registered</th>
                <th className="px-5 py-3.5 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                      Loading customers...
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-500">
                    No customers found matching the search criteria.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="transition hover:bg-neutral-800/40">
                    <td className="px-5 py-4">
                      <Link href={`/admin/customers/${c.id}`} className="font-semibold text-white hover:text-red-400">
                        {c.fullName}
                      </Link>
                      <div className="text-[11px] text-neutral-500">{c.email}</div>
                    </td>
                    <td className="px-5 py-4 text-neutral-300">
                      {c.phoneNumber || <span className="text-neutral-600">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 font-semibold text-neutral-200">
                        <CarFront className="h-3.5 w-3.5 text-emerald-400" /> {c.vehiclesCount}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 font-semibold text-neutral-200">
                        <FileText className="h-3.5 w-3.5 text-blue-400" /> {c.requestsCount}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-neutral-500 whitespace-nowrap">
                      {new Date(c.createdAtUtc).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="inline-flex items-center gap-1 rounded bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-200 hover:bg-neutral-700 hover:text-white"
                      >
                        <Eye className="h-3.5 w-3.5" /> Details
                      </Link>
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
            Showing <span className="font-medium text-white">{customers.length}</span> of{' '}
            <span className="font-medium text-white">{totalCount}</span> total accounts
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadCustomers(page - 1, pageSize, searchTerm)}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300 transition hover:bg-neutral-700 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <span className="text-xs text-neutral-400">
              Page {page} of {Math.max(1, totalPages)}
            </span>
            <button
              onClick={() => loadCustomers(page + 1, pageSize, searchTerm)}
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
