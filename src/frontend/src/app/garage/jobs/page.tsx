'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { ServiceJobSummaryDto, ServiceJobStatus } from '@/types/serviceJob';
import { PagedResult } from '@/types/serviceRequest';
import {
  Wrench,
  Clock,
  Tag,
  Eye,
  CheckCircle2,
  Calendar,
  AlertCircle,
  FileCheck,
  Building2,
  ArrowRight,
  Filter,
} from 'lucide-react';

export default function GarageJobsPage() {
  const [jobs, setJobs] = useState<ServiceJobSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadJobs(1);
  }, [statusFilter]);

  async function loadJobs(p = 1) {
    setLoading(true);
    const query = statusFilter !== 'ALL' ? `&status=${statusFilter}` : '';
    const res = await apiFetch<PagedResult<ServiceJobSummaryDto>>(
      `/garage/jobs?page=${p}&pageSize=15${query}`
    );
    if (res.success && res.data) {
      setJobs(res.data.items);
      setPage(res.data.page);
      setTotalPages(res.data.totalPages);
    }
    setLoading(false);
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'BookingConfirmed':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Scheduled':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'VehicleReceived':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Inspection':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'WorkStarted':
      case 'WorkInProgress':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'WorkCompleted':
      case 'VehicleReady':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'HandedOver':
      case 'Closed':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'Cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-surface-100 text-navy-700 border-surface-200';
    }
  }

  const tabs = [
    { id: 'ALL', label: 'All Jobs' },
    { id: 'BookingConfirmed', label: 'Confirmed / Pending Schedule' },
    { id: 'Scheduled', label: 'Scheduled' },
    { id: 'VehicleReceived', label: 'Vehicle Received' },
    { id: 'Inspection', label: 'Inspection' },
    { id: 'WorkInProgress', label: 'In Progress' },
    { id: 'VehicleReady', label: 'Vehicle Ready' },
    { id: 'HandedOver', label: 'Handed Over' },
    { id: 'Closed', label: 'Closed' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Workshop Service Execution</h1>
          <p className="text-xs text-navy-600 mt-1">
            Manage your garage service jobs from booking intake to vehicle handover and closeout.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-surface-200 overflow-x-auto gap-2 no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
              statusFilter === tab.id
                ? 'border-amber-500 text-amber-700 bg-amber-50/50'
                : 'border-transparent text-navy-600 hover:text-navy-900 hover:border-surface-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-card border border-surface-200/60 p-12 text-center text-navy-500 text-sm">
          <Clock className="w-8 h-8 mx-auto mb-2 animate-spin text-amber-500" />
          Loading workshop jobs...
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-card border border-surface-200/60 p-12 text-center">
          <Wrench className="w-12 h-12 mx-auto text-navy-300 mb-3" />
          <h3 className="text-base font-semibold text-navy-900">No Service Jobs Found</h3>
          <p className="text-xs text-navy-600 mt-1 max-w-sm mx-auto">
            {statusFilter === 'ALL'
              ? 'No active or completed service jobs assigned to your workshop yet.'
              : `No jobs currently matching status "${statusFilter}".`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-card border border-surface-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-navy-700 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Job #</th>
                  <th className="py-3 px-4">Request #</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Scheduled Start</th>
                  <th className="py-3 px-4">Estimated Ready</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-surface-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-navy-900">
                      {job.jobNumber}
                    </td>
                    <td className="py-3 px-4 font-mono text-navy-600">
                      {job.requestNumber}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${getStatusBadge(
                          job.status
                        )}`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-navy-700">
                      {job.scheduledStartAtUtc
                        ? new Date(job.scheduledStartAtUtc).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-navy-700">
                      {job.estimatedCompletionAtUtc
                        ? new Date(job.estimatedCompletionAtUtc).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-navy-500">
                      {new Date(job.createdAtUtc).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/garage/jobs/${job.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg text-xs transition-colors shadow-sm"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        Manage Job
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-surface-200 bg-surface-50 text-xs">
              <span className="text-navy-600">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => loadJobs(page - 1)}
                  className="px-3 py-1 bg-white border border-surface-200 rounded text-navy-700 disabled:opacity-50 hover:bg-surface-100"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => loadJobs(page + 1)}
                  className="px-3 py-1 bg-white border border-surface-200 rounded text-navy-700 disabled:opacity-50 hover:bg-surface-100"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
