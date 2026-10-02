'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  CustomerServiceRequestSummaryDto,
  ServiceRequestDetailDto,
  PagedResult,
} from '@/types/serviceRequest';
import {
  FileText,
  Clock,
  MapPin,
  CheckCircle,
  Plus,
  XCircle,
  AlertCircle,
  ChevronRight,
  Eye,
  Building2,
  Calendar,
  Wrench,
} from 'lucide-react';

export default function CustomerRequestsPage() {
  const [requests, setRequests] = useState<CustomerServiceRequestSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Detail Modal State
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequestDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Cancellation Modal State
  const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function loadRequests(p = 1) {
    setLoading(true);
    const res = await apiFetch<PagedResult<CustomerServiceRequestSummaryDto>>(
      `/customer/requests?page=${p}&pageSize=10`
    );
    if (res.success && res.data) {
      setRequests(res.data.items);
      setPage(res.data.page);
      setTotalPages(res.data.totalPages);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function viewRequestDetail(id: string) {
    setDetailLoading(true);
    setActionError(null);
    const res = await apiFetch<ServiceRequestDetailDto>(`/customer/requests/${id}`);
    if (res.success && res.data) {
      setSelectedRequest(res.data);
    } else {
      setActionError(res.message || 'Failed to load request details.');
    }
    setDetailLoading(false);
  }

  async function handleCancelRequest() {
    if (!cancellingRequestId || !cancelReason.trim()) return;
    setCancelLoading(true);
    setActionError(null);

    const res = await apiFetch<boolean>(`/customer/requests/${cancellingRequestId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: cancelReason }),
    });

    setCancelLoading(false);

    if (res.success) {
      setCancellingRequestId(null);
      setCancelReason('');
      if (selectedRequest && selectedRequest.id === cancellingRequestId) {
        setSelectedRequest(null);
      }
      loadRequests(page);
    } else {
      setActionError(res.message || 'Failed to cancel service request.');
    }
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
      case 'COMPLETED':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-surface-100 text-navy-700 border-surface-200';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Service & Tuning Requests</h1>
          <p className="text-xs text-navy-600 mt-1">
            Active repair and modification requests broadcast to verified partner garages within 10 KM.
          </p>
        </div>
        <Link
          href="/customer/requests/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-electric-600 hover:bg-electric-700 text-white text-xs font-bold rounded-xl transition shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Book a New Service
        </Link>
      </div>

      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Main List */}
      {loading ? (
        <div className="py-16 text-center text-sm text-navy-500">Loading service requests...</div>
      ) : requests.length > 0 ? (
        <div className="space-y-4">
          {requests.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-2xl border border-surface-200 shadow-sm p-5 hover:border-surface-300 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-mono text-xs font-bold text-electric-600 bg-electric-50 px-2 py-0.5 rounded-lg">
                    {r.requestNumber}
                  </span>
                  <span className="text-xs font-bold text-navy-900">{r.vehicleSummary}</span>
                  <span className="text-[11px] font-mono font-medium text-navy-500 bg-surface-100 px-2 py-0.5 rounded-md">
                    {r.licensePlate}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase ${getStatusBadge(
                      r.status
                    )}`}
                  >
                    {r.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <p className="text-xs text-navy-700 font-medium line-clamp-2">{r.problemDescription}</p>

                <div className="flex items-center gap-4 text-xs text-navy-500 pt-1 flex-wrap">
                  {r.locationSummary && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-navy-400" />
                      <span>{r.locationSummary}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-navy-400" />
                    <span>Submitted {new Date(r.submittedAtUtc).toLocaleDateString()}</span>
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>{r.quotesCount} Workshop Quotes</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                <Link
                  href={`/customer/requests/${r.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-electric-50 hover:bg-electric-100 text-electric-700 text-xs font-semibold rounded-xl transition border border-electric-200"
                >
                  <Wrench className="w-3.5 h-3.5" /> Track Execution
                </Link>
                <button
                  onClick={() => viewRequestDetail(r.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-100 hover:bg-surface-200 text-navy-800 text-xs font-semibold rounded-xl transition"
                >
                  <Eye className="w-3.5 h-3.5" /> Details
                </button>
                {r.status !== 'CANCELLED' && r.status !== 'COMPLETED' && (
                  <button
                    onClick={() => {
                      setCancellingRequestId(r.id);
                      setCancelReason('');
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-rose-600 hover:bg-rose-50 text-xs font-semibold rounded-xl transition"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
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
      ) : (
        <div className="py-16 bg-white rounded-2xl border border-dashed border-surface-300 text-center p-8">
          <FileText className="w-12 h-12 text-navy-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-900">No Service Requests Active</h3>
          <p className="text-xs text-navy-500 mt-1 max-w-sm mx-auto mb-5">
            Once you submit a service request, it will be automatically dispatched to verified partner workshops within a 10 KM radius.
          </p>
          <Link
            href="/customer/requests/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy-900 text-white text-xs font-bold rounded-xl hover:bg-navy-800 transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> Book Your First Service
          </Link>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-xl max-h-[90vh] overflow-y-auto">
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

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-navy-400 font-bold uppercase text-[10px]">License Plate</span>
                <div className="font-mono font-semibold text-navy-900">{selectedRequest.vehicleLicensePlate}</div>
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
                <span className="text-navy-400 font-bold uppercase text-[10px]">Category</span>
                <div className="font-medium text-navy-800">{selectedRequest.serviceCategory}</div>
              </div>
              <div>
                <span className="text-navy-400 font-bold uppercase text-[10px]">Workshops Matched</span>
                <div className="font-semibold text-emerald-600">
                  {selectedRequest.matchedGaragesCount} within 10 KM
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-surface-50 rounded-xl space-y-1 text-xs">
              <span className="text-[10px] font-bold text-navy-400 uppercase">Service Location</span>
              <div className="font-medium text-navy-900">{selectedRequest.serviceLocation.formattedAddress}</div>
              <div className="text-[11px] font-mono text-navy-500">
                Coords: {selectedRequest.serviceLocation.latitude}, {selectedRequest.serviceLocation.longitude}
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <span className="text-[10px] font-bold text-navy-400 uppercase">Reported Problem</span>
              <div className="p-3 bg-surface-50 rounded-xl font-medium text-navy-900 whitespace-pre-wrap">
                {selectedRequest.problemDescription}
              </div>
            </div>

            {selectedRequest.cancelledAtUtc && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                <span className="font-bold">Cancelled on {new Date(selectedRequest.cancelledAtUtc).toLocaleDateString()}</span>
                {selectedRequest.cancellationReason && <div>Reason: {selectedRequest.cancellationReason}</div>}
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2 border-t border-surface-100">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 border border-surface-200 text-navy-700 text-xs font-bold rounded-xl hover:bg-surface-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCELLATION MODAL */}
      {cancellingRequestId && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-navy-900">Cancel Service Request</h3>
            <p className="text-xs text-navy-600">
              Are you sure you want to cancel this request? Any partner garages preparing quotations will be notified.
            </p>

            <div>
              <label className="block text-xs font-bold text-navy-800 mb-1">
                Reason for Cancellation <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Schedule changed, or resolved the issue independently."
                className="w-full px-3 py-2 text-xs bg-surface-50 border border-surface-200 rounded-xl focus:outline-none focus:border-navy-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCancellingRequestId(null)}
                disabled={cancelLoading}
                className="px-4 py-2 border border-surface-200 text-navy-700 text-xs font-bold rounded-xl hover:bg-surface-50"
              >
                Keep Request
              </button>
              <button
                onClick={handleCancelRequest}
                disabled={cancelLoading || !cancelReason.trim()}
                className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 disabled:opacity-50 transition"
              >
                {cancelLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
