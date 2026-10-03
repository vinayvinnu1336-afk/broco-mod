'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { AdminGarageList, PagedResult } from '@/types/adminOperations';
import {
  Building2,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Shield,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Check,
  X
} from 'lucide-react';

export default function AdminGaragesPage() {
  const [garages, setGarages] = useState<AdminGarageList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal State for Suspend / Deactivate
  const [actionModal, setActionModal] = useState<{
    type: 'suspend' | 'deactivate';
    garageId: string;
    garageName: string;
  } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadGarages = async (p = page, size = pageSize, search = searchTerm, status = statusFilter) => {
    setLoading(true);
    let url = `/admin/garages?page=${p}&pageSize=${size}`;
    if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;

    const res = await apiFetch<PagedResult<AdminGarageList>>(url);
    if (res.success && res.data) {
      setGarages(res.data.items);
      setPage(res.data.pageNumber);
      setTotalPages(res.data.totalPages);
      setTotalCount(res.data.totalCount);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadGarages(1, pageSize, searchTerm, statusFilter);
  }, [pageSize, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadGarages(1, pageSize, searchTerm, statusFilter);
  };

  const handleVerify = async (garageId: string) => {
    if (!confirm('Are you sure you want to verify this partner workshop?')) return;
    const res = await apiFetch(`/admin/garages/${garageId}/verify`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (res.success) {
      loadGarages();
    } else {
      alert(res.message || 'Failed to verify garage');
    }
  };

  const handleActivate = async (garageId: string) => {
    if (!confirm('Are you sure you want to reactivate this workshop?')) return;
    const res = await apiFetch(`/admin/garages/${garageId}/activate`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (res.success) {
      loadGarages();
    } else {
      alert(res.message || 'Failed to activate garage');
    }
  };

  const submitActionModal = async () => {
    if (!actionModal) return;
    if (!actionReason.trim()) {
      setActionError('Reason is required.');
      return;
    }

    setActionLoading(true);
    setActionError(null);

    const endpoint = actionModal.type === 'suspend'
      ? `/admin/garages/${actionModal.garageId}/suspend`
      : `/admin/garages/${actionModal.garageId}/deactivate`;

    const res = await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({ reason: actionReason.trim() }),
    });

    setActionLoading(false);

    if (res.success) {
      setActionModal(null);
      setActionReason('');
      loadGarages();
    } else {
      setActionError(res.message || 'Action failed');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Verified':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
      case 'PendingVerification':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
      case 'Suspended':
        return 'border-rose-500/30 bg-rose-500/10 text-rose-400';
      case 'Inactive':
        return 'border-neutral-700 bg-neutral-800 text-neutral-400';
      default:
        return 'border-neutral-700 bg-neutral-800 text-neutral-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Workshop Partner Network</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Supervise garage onboarding, verification state machine, configurable service radius, and active jobs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setRefreshing(true); loadGarages(); }}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3.5 py-2 text-sm font-medium text-neutral-200 transition hover:bg-neutral-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search workshop by name, email, address..."
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
              <option value="PendingVerification">Pending Verification</option>
              <option value="Verified">Verified</option>
              <option value="Suspended">Suspended</option>
              <option value="Inactive">Inactive</option>
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

      {/* Garages Table */}
      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/50 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-neutral-800 bg-neutral-900 text-neutral-400 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Workshop</th>
                <th className="px-5 py-3.5 font-semibold">Contact</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
                <th className="px-5 py-3.5 font-semibold">Radius</th>
                <th className="px-5 py-3.5 font-semibold">Active Jobs</th>
                <th className="px-5 py-3.5 font-semibold">Total Quotes</th>
                <th className="px-5 py-3.5 font-semibold">Registered</th>
                <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                      Loading workshop network...
                    </div>
                  </td>
                </tr>
              ) : garages.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-500">
                    No partner workshops match the specified filters.
                  </td>
                </tr>
              ) : (
                garages.map((g) => (
                  <tr key={g.id} className="transition hover:bg-neutral-800/40">
                    <td className="px-5 py-4">
                      <Link href={`/admin/garages/${g.id}`} className="font-semibold text-white hover:text-red-400">
                        {g.name}
                      </Link>
                      <div className="text-[11px] text-neutral-500 truncate max-w-xs">{g.address}</div>
                    </td>
                    <td className="px-5 py-4 text-neutral-300">
                      <div>{g.email}</div>
                      <div className="text-[11px] text-neutral-500">{g.phoneNumber}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${getStatusBadge(g.status)}`}>
                        {g.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-neutral-300 bg-neutral-800 px-2 py-0.5 rounded text-[11px]">
                        {g.serviceRadiusKm.toFixed(1)} KM
                      </span>
                    </td>
                    <td className="px-5 py-4 text-neutral-300 font-semibold">
                      {g.activeJobsCount}
                    </td>
                    <td className="px-5 py-4 text-neutral-400">
                      {g.totalQuotesCount}
                    </td>
                    <td className="px-5 py-4 text-neutral-500 whitespace-nowrap">
                      {new Date(g.createdAtUtc).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/garages/${g.id}`}
                          className="rounded bg-neutral-800 p-1.5 text-neutral-300 hover:bg-neutral-700 hover:text-white"
                          title="View Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>

                        {/* Onboarding State Actions */}
                        {g.status === 'PendingVerification' && (
                          <button
                            onClick={() => handleVerify(g.id)}
                            className="rounded bg-emerald-600/20 border border-emerald-500/30 p-1.5 text-emerald-300 hover:bg-emerald-600/30"
                            title="Verify Garage"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {g.status === 'Verified' && (
                          <button
                            onClick={() => setActionModal({ type: 'suspend', garageId: g.id, garageName: g.name })}
                            className="rounded bg-amber-500/20 border border-amber-500/30 p-1.5 text-amber-300 hover:bg-amber-500/30"
                            title="Suspend Garage"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {g.status === 'Suspended' && (
                          <button
                            onClick={() => handleActivate(g.id)}
                            className="rounded bg-blue-500/20 border border-blue-500/30 p-1.5 text-blue-300 hover:bg-blue-500/30"
                            title="Reactivate Garage"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {g.status !== 'Inactive' && (
                          <button
                            onClick={() => setActionModal({ type: 'deactivate', garageId: g.id, garageName: g.name })}
                            className="rounded bg-rose-500/20 border border-rose-500/30 p-1.5 text-rose-300 hover:bg-rose-500/30"
                            title="Deactivate Garage"
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
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
            Showing <span className="font-medium text-white">{garages.length}</span> of{' '}
            <span className="font-medium text-white">{totalCount}</span> total workshops
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadGarages(page - 1, pageSize, searchTerm, statusFilter)}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300 transition hover:bg-neutral-700 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <span className="text-xs text-neutral-400">
              Page {page} of {Math.max(1, totalPages)}
            </span>
            <button
              onClick={() => loadGarages(page + 1, pageSize, searchTerm, statusFilter)}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300 transition hover:bg-neutral-700 disabled:opacity-40"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Action Reason Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base font-semibold text-white capitalize">
                {actionModal.type} Workshop: {actionModal.garageName}
              </h3>
              <button
                onClick={() => setActionModal(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-xs text-neutral-400">
              {actionModal.type === 'suspend'
                ? 'Suspending this workshop will immediately halt new proximity dispatches and quotation opportunities until reactivated.'
                : 'Deactivating this workshop marks it as inactive in the partner directory.'}
            </p>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-semibold text-neutral-300">
                Reason for {actionModal.type}: <span className="text-red-400">*</span>
              </label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Enter audit rationale, compliance note, or reason..."
                rows={3}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 p-2.5 text-xs text-white focus:border-red-500 focus:outline-none"
              />
              {actionError && <p className="text-xs text-rose-400">{actionError}</p>}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setActionModal(null)}
                className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-700"
              >
                Cancel
              </button>
              <button
                onClick={submitActionModal}
                disabled={actionLoading}
                className={`rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                  actionModal.type === 'suspend' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {actionLoading ? 'Processing...' : `Confirm ${actionModal.type}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
