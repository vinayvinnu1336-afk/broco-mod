'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  AdminServiceRequestSummaryDto,
  AdminServiceRequestDetailDto,
  PagedResult,
} from '@/types/serviceRequest';
import {
  FileText,
  Radio,
  ShieldCheck,
  Eye,
  MapPin,
  Building2,
  User,
  Clock,
  Calendar,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<AdminServiceRequestSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Detail Modal State
  const [selectedRequest, setSelectedRequest] = useState<AdminServiceRequestDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadRequests(p = 1) {
    setLoading(true);
    const res = await apiFetch<PagedResult<AdminServiceRequestSummaryDto>>(
      `/admin/requests?page=${p}&pageSize=15`
    );
    if (res.success && res.data) {
      setRequests(res.data.items);
      setPage(res.data.page);
      setTotalPages(res.data.totalPages);
      setTotalCount(res.data.totalCount);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function viewDetail(requestId: string) {
    setDetailLoading(true);
    setErrorMsg(null);
    const res = await apiFetch<AdminServiceRequestDetailDto>(`/admin/requests/${requestId}`);
    if (res.success && res.data) {
      setSelectedRequest(res.data);
    } else {
      setErrorMsg(res.message || 'Failed to load request details.');
    }
    setDetailLoading(false);
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'GARAGES_NOTIFIED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'UNDER_REVIEW':
      case 'ASSIGNED_TO_ADVISOR':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'CANCELLED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-surface-100 text-navy-700 border-surface-200';
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Platform Service Requests</h1>
        <p className="text-xs text-navy-600 mt-1">
          Global supervision of service requests, PostGIS 10 KM radial matching, and quotes pipeline.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-surface-200 p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-electric-600 flex items-center justify-center">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-navy-400 uppercase">Geospatial Engine</div>
            <div className="text-sm font-bold text-navy-900">PostGIS 10 KM Active</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-surface-200 p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-navy-400 uppercase">Total Bookings</div>
            <div className="text-sm font-bold text-navy-900">{totalCount} Requests</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-surface-200 p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-navy-400 uppercase">Isolation Compliance</div>
            <div className="text-sm font-bold text-navy-900">100% Policy Enforced</div>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-surface-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-navy-900">All Service Dispatches</h2>
          <span className="text-xs text-navy-500 font-medium">Showing {requests.length} of {totalCount} records</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-navy-500">Loading platform requests...</div>
        ) : requests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-navy-600 font-bold">
                  <th className="py-3 px-4">Request #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Vehicle</th>
                  <th className="py-3 px-4">City</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Dispatched Garages</th>
                  <th className="py-3 px-4">Advisor</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-navy-800">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-50/70 transition">
                    <td className="py-3 px-4 font-mono font-bold text-electric-600">{r.requestNumber}</td>
                    <td className="py-3 px-4 font-semibold">{r.customerName}</td>
                    <td className="py-3 px-4">{r.vehicleSummary}</td>
                    <td className="py-3 px-4 text-navy-500">{r.locationSummary || '—'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getStatusBadge(
                          r.status
                        )}`}
                      >
                        {r.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-emerald-600">
                      {r.matchedGaragesCount} Garages
                    </td>
                    <td className="py-3 px-4 text-navy-500">{r.assignedAdvisorName || 'Unassigned'}</td>
                    <td className="py-3 px-4 text-navy-400">
                      {new Date(r.submittedAtUtc).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => viewDetail(r.id)}
                        className="px-2.5 py-1 bg-surface-100 hover:bg-surface-200 text-navy-800 text-[11px] font-bold rounded-lg transition"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-xs text-navy-500">
            No service requests found in the database.
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-surface-100 flex justify-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => loadRequests(page - 1)}
              className="px-3 py-1 text-xs border border-surface-200 rounded-lg disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-navy-600 py-1">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => loadRequests(page + 1)}
              className="px-3 py-1 text-xs border border-surface-200 rounded-lg disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-surface-100 pb-4">
              <div>
                <span className="font-mono text-xs font-bold text-electric-600 bg-electric-50 px-2 py-0.5 rounded-lg">
                  {selectedRequest.requestNumber}
                </span>
                <h3 className="text-base font-bold text-navy-900 mt-1">{selectedRequest.vehicleSummary}</h3>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-navy-400 hover:text-navy-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Customer & Vehicle Info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-navy-400 font-bold uppercase text-[10px]">Customer</span>
                <div className="font-semibold text-navy-900">{selectedRequest.customerName}</div>
                <div className="text-[11px] text-navy-500">{selectedRequest.customerEmail}</div>
              </div>
              <div>
                <span className="text-navy-400 font-bold uppercase text-[10px]">License Plate</span>
                <div className="font-mono font-semibold text-navy-900">{selectedRequest.vehicleLicensePlate}</div>
              </div>
              <div>
                <span className="text-navy-400 font-bold uppercase text-[10px]">Assigned Advisor</span>
                <div className="font-medium text-navy-800">{selectedRequest.assignedAdvisorName || 'Unassigned'}</div>
              </div>
              <div>
                <span className="text-navy-400 font-bold uppercase text-[10px]">Category</span>
                <div className="font-medium text-navy-800">{selectedRequest.serviceCategory}</div>
              </div>
              <div>
                <span className="text-navy-400 font-bold uppercase text-[10px]">Status</span>
                <div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getStatusBadge(
                      selectedRequest.status
                    )}`}
                  >
                    {selectedRequest.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-navy-400 font-bold uppercase text-[10px]">Submitted Date</span>
                <div className="text-navy-700">{new Date(selectedRequest.submittedAtUtc).toLocaleString()}</div>
              </div>
            </div>

            {/* Location */}
            <div className="p-3.5 bg-surface-50 rounded-xl space-y-1 text-xs">
              <span className="text-[10px] font-bold text-navy-400 uppercase">Service Location (WGS84)</span>
              <div className="font-medium text-navy-900">{selectedRequest.serviceLocation.formattedAddress}</div>
              <div className="text-[11px] font-mono text-navy-500">
                Latitude: {selectedRequest.serviceLocation.latitude}, Longitude: {selectedRequest.serviceLocation.longitude}
              </div>
            </div>

            {/* Problem */}
            <div className="space-y-1 text-xs">
              <span className="text-[10px] font-bold text-navy-400 uppercase">Problem Description</span>
              <div className="p-3 bg-surface-50 rounded-xl font-medium text-navy-900 whitespace-pre-wrap">
                {selectedRequest.problemDescription}
              </div>
            </div>

            {/* Dispatched Garages Breakdown */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-navy-900">
                  Dispatched Partner Garages ({selectedRequest.dispatchedGarages.length} within 10 KM)
                </span>
              </div>

              {selectedRequest.dispatchedGarages.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedRequest.dispatchedGarages.map((g) => (
                    <div
                      key={g.garageRequestId}
                      className="p-3 border border-surface-200 rounded-xl flex items-center justify-between text-xs bg-surface-50/50"
                    >
                      <div>
                        <div className="font-bold text-navy-900">{g.garageName}</div>
                        <div className="text-[11px] text-navy-500">
                          {g.garagePhone} • Dispatched {new Date(g.notifiedAtUtc).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                          {g.distanceKm} KM
                        </span>
                        <div className="text-[10px] font-bold text-navy-500 mt-1 uppercase">{g.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-surface-50 text-navy-500 text-xs text-center rounded-xl">
                  No verified partner workshops were located within the 10 KM radius.
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-surface-100">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 bg-navy-900 text-white text-xs font-bold rounded-xl hover:bg-navy-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
