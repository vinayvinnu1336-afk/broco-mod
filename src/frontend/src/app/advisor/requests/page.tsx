'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  AdvisorServiceRequestSummaryDto,
  AdvisorServiceRequestDetailDto,
  PagedResult,
} from '@/types/serviceRequest';
import {
  Inbox,
  User,
  Clock,
  CheckCircle,
  Eye,
  MapPin,
  Building2,
  Phone,
  Mail,
  Calendar,
  AlertCircle,
  ShieldAlert,
  FileSpreadsheet,
} from 'lucide-react';

export default function AdvisorRequestsPage() {
  const [requests, setRequests] = useState<AdvisorServiceRequestSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Detail Modal State
  const [selectedRequest, setSelectedRequest] = useState<AdvisorServiceRequestDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadRequests(p = 1) {
    setLoading(true);
    const res = await apiFetch<PagedResult<AdvisorServiceRequestSummaryDto>>(
      `/advisor/requests?page=${p}&pageSize=10`
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

  async function viewDetail(requestId: string) {
    setDetailLoading(true);
    setErrorMsg(null);
    const res = await apiFetch<AdvisorServiceRequestDetailDto>(`/advisor/requests/${requestId}`);
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
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Customer Requests Under Review</h1>
        <p className="text-xs text-navy-600 mt-1">
          Review service requests dispatched to workshops and monitor incoming workshop bids.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-navy-500">Loading advisor workbench...</div>
      ) : requests.length > 0 ? (
        <div className="space-y-4">
          {requests.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-2xl border border-surface-200 shadow-sm p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-surface-300 transition"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-mono text-xs font-bold text-electric-600 bg-electric-50 px-2 py-0.5 rounded-lg">
                    {r.requestNumber}
                  </span>
                  <span className="text-xs font-bold text-navy-900">{r.vehicleSummary}</span>
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
                  <span className="flex items-center gap-1 font-semibold text-navy-800">
                    <User className="w-3.5 h-3.5 text-navy-400" />
                    <span>{r.customerName}</span>
                  </span>
                  {r.locationSummary && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-navy-400" />
                      <span>{r.locationSummary}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{r.matchedGaragesCount} Garages Dispatched</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-navy-400" />
                    <span>Submitted {new Date(r.submittedAtUtc).toLocaleDateString()}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-center">
                <Link
                  href={`/advisor/requests/${r.id}`}
                  className="flex items-center gap-1.5 px-4 py-2 bg-electric-600 hover:bg-electric-700 text-white rounded-xl text-xs font-bold tracking-wide transition shadow-sm"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Quotes & Assign
                </Link>
                <button
                  onClick={() => viewDetail(r.id)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-bold tracking-wide transition shadow-sm"
                >
                  <Eye className="w-3.5 h-3.5" /> Inspect Dispatch
                </button>
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
          <Inbox className="w-12 h-12 text-navy-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-900">No Service Requests In Review</h3>
          <p className="text-xs text-navy-500 mt-1 max-w-sm mx-auto">
            Dispatched customer requests will be routed to your advisor review workbench here.
          </p>
        </div>
      )}

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
                <span className="text-navy-400 font-bold uppercase text-[10px]">Customer Name</span>
                <div className="font-semibold text-navy-900">{selectedRequest.customerName}</div>
              </div>
              <div>
                <span className="text-navy-400 font-bold uppercase text-[10px]">Customer Contact</span>
                <div className="text-navy-800">{selectedRequest.customerPhone || selectedRequest.customerEmail}</div>
              </div>
              <div>
                <span className="text-navy-400 font-bold uppercase text-[10px]">License Plate</span>
                <div className="font-mono font-semibold text-navy-900">{selectedRequest.vehicleLicensePlate}</div>
              </div>
              <div>
                <span className="text-navy-400 font-bold uppercase text-[10px]">Service Category</span>
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
            </div>

            {/* Location */}
            <div className="p-3.5 bg-surface-50 rounded-xl space-y-1 text-xs">
              <span className="text-[10px] font-bold text-navy-400 uppercase">Service Location (WGS84 Point)</span>
              <div className="font-medium text-navy-900">{selectedRequest.serviceLocation.formattedAddress}</div>
              <div className="text-[11px] font-mono text-navy-500">
                Coords: {selectedRequest.serviceLocation.latitude}, {selectedRequest.serviceLocation.longitude}
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
