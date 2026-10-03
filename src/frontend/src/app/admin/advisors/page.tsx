'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminAdvisorList, PagedResult } from '@/types/adminOperations';
import {
  UserCheck,
  Search,
  Filter,
  CheckCircle2,
  Ban,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Briefcase,
  FileCheck,
  Wrench
} from 'lucide-react';

export default function AdminAdvisorsPage() {
  const [advisors, setAdvisors] = useState<AdminAdvisorList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('');

  // Deactivate modal state
  const [deactivateModal, setDeactivateModal] = useState<{ id: string; name: string } | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const loadAdvisors = async (p = page, size = pageSize, search = searchTerm, active = activeFilter) => {
    setLoading(true);
    let url = `/admin/advisors?page=${p}&pageSize=${size}`;
    if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
    if (active !== '') url += `&isActive=${active === 'true'}`;

    const res = await apiFetch<PagedResult<AdminAdvisorList>>(url);
    if (res.success && res.data) {
      setAdvisors(res.data.items);
      setPage(res.data.pageNumber);
      setTotalPages(res.data.totalPages);
      setTotalCount(res.data.totalCount);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadAdvisors(1, pageSize, searchTerm, activeFilter);
  }, [pageSize, activeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadAdvisors(1, pageSize, searchTerm, activeFilter);
  };

  const handleActivate = async (id: string) => {
    if (!confirm('Are you sure you want to activate this technical advisor?')) return;
    const res = await apiFetch(`/admin/advisors/${id}/activate`, {
      method: 'POST',
    });
    if (res.success) {
      loadAdvisors();
    } else {
      alert(res.message || 'Failed to activate advisor');
    }
  };

  const submitDeactivate = async () => {
    if (!deactivateModal) return;
    if (!deactivateReason.trim()) {
      setDeactivateError('Reason is required.');
      return;
    }

    setDeactivateLoading(true);
    setDeactivateError(null);

    const res = await apiFetch(`/admin/advisors/${deactivateModal.id}/deactivate`, {
      method: 'POST',
      body: JSON.stringify({ reason: deactivateReason.trim() }),
    });

    setDeactivateLoading(false);
    if (res.success) {
      setDeactivateModal(null);
      setDeactivateReason('');
      loadAdvisors();
    } else {
      setDeactivateError(res.message || 'Failed to deactivate advisor');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Technical Advisors Management</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Supervise platform advisors, workloads, quote review activity, and account status.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setRefreshing(true); loadAdvisors(); }}
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
            placeholder="Search advisor by name, email, employee code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:border-red-500 focus:outline-none"
          />
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-neutral-400" />
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs text-neutral-200 focus:border-red-500 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="true">Active Duty</option>
              <option value="false">Inactive</option>
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

      {/* Advisors Table */}
      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/50 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-neutral-800 bg-neutral-900 text-neutral-400 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Advisor</th>
                <th className="px-5 py-3.5 font-semibold">Employee Code</th>
                <th className="px-5 py-3.5 font-semibold">Specialization</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
                <th className="px-5 py-3.5 font-semibold">Assigned Requests</th>
                <th className="px-5 py-3.5 font-semibold">Quotes Reviewed</th>
                <th className="px-5 py-3.5 font-semibold">Active Jobs</th>
                <th className="px-5 py-3.5 font-semibold">Registered</th>
                <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                      Loading advisors...
                    </div>
                  </td>
                </tr>
              ) : advisors.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-500">
                    No technical advisors match the specified filters.
                  </td>
                </tr>
              ) : (
                advisors.map((adv) => (
                  <tr key={adv.id} className="transition hover:bg-neutral-800/40">
                    <td className="px-5 py-4">
                      <span className="font-semibold text-white">{adv.fullName}</span>
                      <div className="text-[11px] text-neutral-500">{adv.email}</div>
                    </td>
                    <td className="px-5 py-4 font-mono text-neutral-300">
                      {adv.employeeCode || <span className="text-neutral-600">—</span>}
                    </td>
                    <td className="px-5 py-4 text-neutral-300">
                      {adv.specialization || <span className="text-neutral-600">General</span>}
                    </td>
                    <td className="px-5 py-4">
                      {adv.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-800 px-2.5 py-0.5 text-[11px] font-medium text-neutral-400">
                          <Ban className="h-3 w-3" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-semibold text-white">
                      {adv.activeAssignedRequestsCount}
                    </td>
                    <td className="px-5 py-4 text-neutral-300">
                      {adv.totalQuotesReviewedCount}
                    </td>
                    <td className="px-5 py-4 font-semibold text-orange-400">
                      {adv.activeJobsOverseeingCount}
                    </td>
                    <td className="px-5 py-4 text-neutral-500 whitespace-nowrap">
                      {new Date(adv.createdAtUtc).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {adv.isActive ? (
                        <button
                          onClick={() => setDeactivateModal({ id: adv.id, name: adv.fullName })}
                          className="rounded bg-rose-500/10 border border-rose-500/30 px-2.5 py-1 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(adv.id)}
                          className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition"
                        >
                          Activate
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
            Showing <span className="font-medium text-white">{advisors.length}</span> of{' '}
            <span className="font-medium text-white">{totalCount}</span> total advisors
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadAdvisors(page - 1, pageSize, searchTerm, activeFilter)}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300 transition hover:bg-neutral-700 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <span className="text-xs text-neutral-400">
              Page {page} of {Math.max(1, totalPages)}
            </span>
            <button
              onClick={() => loadAdvisors(page + 1, pageSize, searchTerm, activeFilter)}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300 transition hover:bg-neutral-700 disabled:opacity-40"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Deactivate Modal */}
      {deactivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base font-semibold text-white">
                Deactivate Advisor: {deactivateModal.name}
              </h3>
              <button
                onClick={() => setDeactivateModal(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-xs text-neutral-400">
              Deactivating this advisor account will prevent them from reviewing quotations and assigning garages.
            </p>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-semibold text-neutral-300">
                Reason for deactivation: <span className="text-red-400">*</span>
              </label>
              <textarea
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                placeholder="Enter administrative rationale (e.g., leave of absence, transfer)..."
                rows={3}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 p-2.5 text-xs text-white focus:border-red-500 focus:outline-none"
              />
              {deactivateError && <p className="text-xs text-rose-400">{deactivateError}</p>}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeactivateModal(null)}
                className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-700"
              >
                Cancel
              </button>
              <button
                onClick={submitDeactivate}
                disabled={deactivateLoading}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {deactivateLoading ? 'Processing...' : 'Confirm Deactivation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
