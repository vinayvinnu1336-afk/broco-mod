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
  X,
  Briefcase,
  FileCheck,
  Wrench
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';

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
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">Technical Advisors Management</h1>
          <p className="mt-1 text-sm text-navy-600">
            Supervise platform advisors, workloads, quote review activity, and account status.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setRefreshing(true); loadAdvisors(); }}
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
            placeholder="Search advisor by name, email, employee code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-surface-200 bg-surface-50 pl-9 pr-4 py-2 text-xs text-navy-900 placeholder-navy-400 focus:border-navy-900 focus:outline-none"
          />
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-navy-400" />
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-xs text-navy-900 focus:border-navy-900 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="true">Active Duty</option>
              <option value="false">Inactive</option>
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

      {/* Advisors Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-surface-200 bg-surface-50 text-navy-500 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5 font-bold">Advisor</th>
                <th className="px-5 py-3.5 font-bold">Employee Code</th>
                <th className="px-5 py-3.5 font-bold">Specialization</th>
                <th className="px-5 py-3.5 font-bold">Status</th>
                <th className="px-5 py-3.5 font-bold">Assigned Requests</th>
                <th className="px-5 py-3.5 font-bold">Quotes Reviewed</th>
                <th className="px-5 py-3.5 font-bold">Active Jobs</th>
                <th className="px-5 py-3.5 font-bold">Registered</th>
                <th className="px-5 py-3.5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-navy-500">
                    <LoadingState message="Loading advisors..." />
                  </td>
                </tr>
              ) : advisors.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-navy-500">
                    <EmptyState
                      icon={UserCheck}
                      title="No advisors found"
                      description="No technical advisors match the specified filters."
                    />
                  </td>
                </tr>
              ) : (
                advisors.map((adv) => (
                  <tr key={adv.id} className="transition hover:bg-surface-50/50">
                    <td className="px-5 py-4">
                      <span className="font-bold text-navy-900">{adv.fullName}</span>
                      <div className="text-[11px] text-navy-500">{adv.email}</div>
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-navy-700">
                      {adv.employeeCode || <span className="text-navy-400 font-normal">—</span>}
                    </td>
                    <td className="px-5 py-4 text-navy-700">
                      {adv.specialization || <span className="text-navy-400">General</span>}
                    </td>
                    <td className="px-5 py-4">
                      {adv.isActive ? (
                        <Badge variant="green" icon={CheckCircle2}>
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="neutral" icon={Ban}>
                          Inactive
                        </Badge>
                      )}
                    </td>
                    <td className="px-5 py-4 font-bold text-navy-900">
                      {adv.activeAssignedRequestsCount}
                    </td>
                    <td className="px-5 py-4 text-navy-700">
                      {adv.totalQuotesReviewedCount}
                    </td>
                    <td className="px-5 py-4 font-bold text-orange-600">
                      {adv.activeJobsOverseeingCount}
                    </td>
                    <td className="px-5 py-4 text-navy-500 whitespace-nowrap">
                      {new Date(adv.createdAtUtc).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {adv.isActive ? (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setDeactivateModal({ id: adv.id, name: adv.fullName })}
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleActivate(adv.id)}
                        >
                          Activate
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
              onPageChange={(p) => loadAdvisors(p, pageSize, searchTerm, activeFilter)}
            />
          </div>
        )}
      </Card>

      {/* Deactivate Modal */}
      {deactivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-surface-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-surface-100 pb-3">
              <h3 className="text-base font-bold text-navy-900">
                Deactivate Advisor: {deactivateModal.name}
              </h3>
              <button
                onClick={() => setDeactivateModal(null)}
                className="text-navy-400 hover:text-navy-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-xs text-navy-600">
              Deactivating this technical advisor will immediately prevent them from reviewing quotes or managing requests.
            </p>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-bold text-navy-800">
                Deactivation Reason: <span className="text-rose-600">*</span>
              </label>
              <textarea
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                placeholder="Enter audit rationale..."
                rows={3}
                className="w-full rounded-xl border border-surface-200 bg-surface-50 p-2.5 text-xs text-navy-900 focus:border-navy-900 focus:outline-none"
              />
              {deactivateError && <p className="text-xs text-rose-600">{deactivateError}</p>}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeactivateModal(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={submitDeactivate}
                isLoading={deactivateLoading}
              >
                Confirm Deactivation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
