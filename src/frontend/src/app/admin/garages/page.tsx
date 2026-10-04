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
  Check,
  X
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">Workshop Partner Network</h1>
          <p className="mt-1 text-sm text-navy-600">
            Supervise garage onboarding, verification state machine, configurable service radius, and active jobs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setRefreshing(true); loadGarages(); }}
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
            placeholder="Search workshop by name, email, address..."
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
              <option value="PendingVerification">Pending Verification</option>
              <option value="Verified">Verified</option>
              <option value="Suspended">Suspended</option>
              <option value="Inactive">Inactive</option>
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

      {/* Garages Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-surface-200 bg-surface-50 text-navy-500 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5 font-bold">Workshop</th>
                <th className="px-5 py-3.5 font-bold">Contact</th>
                <th className="px-5 py-3.5 font-bold">Status</th>
                <th className="px-5 py-3.5 font-bold">Radius</th>
                <th className="px-5 py-3.5 font-bold">Active Jobs</th>
                <th className="px-5 py-3.5 font-bold">Total Quotes</th>
                <th className="px-5 py-3.5 font-bold">Registered</th>
                <th className="px-5 py-3.5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-navy-500">
                    <LoadingState message="Loading workshop network..." />
                  </td>
                </tr>
              ) : garages.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-navy-500">
                    <EmptyState
                      icon={Building2}
                      title="No workshops found"
                      description="No partner workshops match the specified filters."
                    />
                  </td>
                </tr>
              ) : (
                garages.map((g) => (
                  <tr key={g.id} className="transition hover:bg-surface-50/50">
                    <td className="px-5 py-4">
                      <Link href={`/admin/garages/${g.id}`} className="font-bold text-navy-900 hover:text-electric-600">
                        {g.name}
                      </Link>
                      <div className="text-[11px] text-navy-500 truncate max-w-xs">{g.address}</div>
                    </td>
                    <td className="px-5 py-4 text-navy-700">
                      <div className="font-medium">{g.email}</div>
                      <div className="text-[11px] text-navy-500">{g.phoneNumber}</div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={g.status} />
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-navy-800 bg-surface-100 border border-surface-200 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                        {g.serviceRadiusKm.toFixed(1)} KM
                      </span>
                    </td>
                    <td className="px-5 py-4 text-navy-900 font-bold">
                      {g.activeJobsCount}
                    </td>
                    <td className="px-5 py-4 text-navy-600">
                      {g.totalQuotesCount}
                    </td>
                    <td className="px-5 py-4 text-navy-500 whitespace-nowrap">
                      {new Date(g.createdAtUtc).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/admin/garages/${g.id}`}>
                          <button
                            className="rounded-lg border border-surface-200 bg-surface-50 p-1.5 text-navy-600 hover:bg-surface-100 hover:text-navy-900"
                            title="View Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </Link>

                        {/* Onboarding State Actions */}
                        {g.status === 'PendingVerification' && (
                          <button
                            onClick={() => handleVerify(g.id)}
                            className="rounded-lg bg-emerald-50 border border-emerald-200 p-1.5 text-emerald-700 hover:bg-emerald-100"
                            title="Verify Garage"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {g.status === 'Verified' && (
                          <button
                            onClick={() => setActionModal({ type: 'suspend', garageId: g.id, garageName: g.name })}
                            className="rounded-lg bg-amber-50 border border-amber-200 p-1.5 text-amber-700 hover:bg-amber-100"
                            title="Suspend Garage"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {g.status === 'Suspended' && (
                          <button
                            onClick={() => handleActivate(g.id)}
                            className="rounded-lg bg-blue-50 border border-blue-200 p-1.5 text-blue-700 hover:bg-blue-100"
                            title="Reactivate Garage"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {g.status !== 'Inactive' && (
                          <button
                            onClick={() => setActionModal({ type: 'deactivate', garageId: g.id, garageName: g.name })}
                            className="rounded-lg bg-rose-50 border border-rose-200 p-1.5 text-rose-700 hover:bg-rose-100"
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
        {totalCount > 0 && (
          <div className="p-4 border-t border-surface-200">
            <Pagination
              currentPage={page}
              totalPages={Math.max(1, totalPages)}
              totalItems={totalCount}
              pageSize={pageSize}
              onPageChange={(p) => loadGarages(p, pageSize, searchTerm, statusFilter)}
            />
          </div>
        )}
      </Card>

      {/* Action Reason Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-surface-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-surface-100 pb-3">
              <h3 className="text-base font-bold text-navy-900 capitalize">
                {actionModal.type} Workshop: {actionModal.garageName}
              </h3>
              <button
                onClick={() => setActionModal(null)}
                className="text-navy-400 hover:text-navy-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-xs text-navy-600">
              {actionModal.type === 'suspend'
                ? 'Suspending this workshop will immediately halt new proximity dispatches and quotation opportunities until reactivated.'
                : 'Deactivating this workshop marks it as inactive in the partner directory.'}
            </p>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-bold text-navy-800">
                Reason for {actionModal.type}: <span className="text-rose-600">*</span>
              </label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Enter audit rationale, compliance note, or reason..."
                rows={3}
                className="w-full rounded-xl border border-surface-200 bg-surface-50 p-2.5 text-xs text-navy-900 focus:border-navy-900 focus:outline-none"
              />
              {actionError && <p className="text-xs text-rose-600">{actionError}</p>}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActionModal(null)}
              >
                Cancel
              </Button>
              <Button
                variant={actionModal.type === 'suspend' ? 'secondary' : 'danger'}
                size="sm"
                onClick={submitActionModal}
                isLoading={actionLoading}
              >
                Confirm {actionModal.type}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
