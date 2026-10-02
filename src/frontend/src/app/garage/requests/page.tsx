'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  GarageIncomingRequestDto,
  GarageIncomingRequestDetailDto,
  PagedResult,
} from '@/types/serviceRequest';
import {
  Radio,
  MapPin,
  Clock,
  ArrowRight,
  Eye,
  CheckCircle2,
  Calendar,
  AlertCircle,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';

export default function GarageRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<GarageIncomingRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Detail Modal State
  const [selectedRequest, setSelectedRequest] = useState<GarageIncomingRequestDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadRequests(p = 1) {
    setLoading(true);
    const res = await apiFetch<PagedResult<GarageIncomingRequestDto>>(
      `/garage/requests?page=${p}&pageSize=10`
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

  async function viewDetail(garageRequestId: string) {
    setDetailLoading(true);
    setErrorMsg(null);
    const res = await apiFetch<GarageIncomingRequestDetailDto>(`/garage/requests/${garageRequestId}`);
    if (res.success && res.data) {
      setSelectedRequest(res.data);
      // Reload list in background to reflect VIEWED status
      loadRequests(page);
    } else {
      setErrorMsg(res.message || 'Failed to load request details.');
    }
    setDetailLoading(false);
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NOTIFIED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'VIEWED':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'ACCEPTED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'DECLINED':
        return 'bg-surface-100 text-navy-500 border-surface-200';
      default:
        return 'bg-surface-100 text-navy-700 border-surface-200';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Dispatched Incoming Requests</h1>
          <p className="text-xs text-navy-600 mt-1">
            Service and tuning dispatches located within your certified 10 KM geographic radius.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-navy-500">Loading incoming workshop requests...</div>
      ) : requests.length > 0 ? (
        <div className="space-y-4">
          {requests.map((r) => (
            <div
              key={r.garageRequestId}
              className="bg-white rounded-2xl border border-surface-200 shadow-sm p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-surface-300 transition"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-mono text-xs font-bold text-electric-600 bg-electric-50 px-2 py-0.5 rounded-lg">
                    {r.requestNumber}
                  </span>
                  <span className="text-xs font-bold text-navy-900">{r.vehicleSummary}</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                    {r.distanceKm} KM Away
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase ${getStatusBadge(
                      r.status
                    )}`}
                  >
                    {r.status}
                  </span>
                </div>

                <p className="text-xs text-navy-700 font-medium line-clamp-2">{r.problemDescription}</p>

                <div className="flex items-center gap-4 text-xs text-navy-500 pt-1 flex-wrap">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-navy-400" />
                    <span>{r.locationArea}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-navy-400" />
                    <span>Dispatched {new Date(r.sentAtUtc).toLocaleDateString()}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-center">
                <button
                  onClick={() => router.push(`/garage/quotes/new?requestId=${r.garageRequestId}`)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold tracking-wide transition shadow-sm"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Create Quote
                </button>
                <button
                  onClick={() => viewDetail(r.garageRequestId)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-bold tracking-wide transition shadow-sm"
                >
                  <Eye className="w-3.5 h-3.5" /> View Details
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
          <Radio className="w-12 h-12 text-navy-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-900">No Nearby Requests Dispatched</h3>
          <p className="text-xs text-navy-500 mt-1 max-w-sm mx-auto">
            Dispatches from vehicle owners within your 10 KM geographic perimeter will appear here in real time.
          </p>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-surface-100 pb-4">
              <div>
                <span className="font-mono text-xs font-bold text-electric-600 bg-electric-50 px-2 py-0.5 rounded-lg">
                  {selectedRequest.requestNumber}
                </span>
                <h3 className="text-base font-bold text-navy-900 mt-1">
                  {selectedRequest.vehicleYear} {selectedRequest.vehicleMake} {selectedRequest.vehicleModel}
                </h3>
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
                <span className="text-navy-400 font-bold uppercase text-[10px]">Distance</span>
                <div className="font-semibold text-emerald-600">{selectedRequest.distanceKm} KM Away</div>
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
                    {selectedRequest.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-surface-50 rounded-xl space-y-1 text-xs">
              <span className="text-[10px] font-bold text-navy-400 uppercase">Service Location Area</span>
              <div className="font-medium text-navy-900">{selectedRequest.locationArea}</div>
            </div>

            <div className="space-y-1 text-xs">
              <span className="text-[10px] font-bold text-navy-400 uppercase">Problem Description</span>
              <div className="p-3 bg-surface-50 rounded-xl font-medium text-navy-900 whitespace-pre-wrap">
                {selectedRequest.problemDescription}
              </div>
            </div>

            {selectedRequest.preferredServiceDate && (
              <div className="text-xs text-navy-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-navy-400" />
                <span>
                  Customer Preferred Date:{' '}
                  <span className="font-semibold">
                    {new Date(selectedRequest.preferredServiceDate).toLocaleDateString()}
                  </span>
                </span>
              </div>
            )}

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-3">
              <div>
                <span className="font-bold">Confidential Quotation: </span>
                Submit detailed line items and workshop pricing directly to BroCo Mod Advisors.
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-surface-100">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 bg-surface-100 text-navy-800 text-xs font-bold rounded-xl hover:bg-surface-200"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const reqId = selectedRequest.garageRequestId;
                  setSelectedRequest(null);
                  router.push(`/garage/quotes/new?requestId=${reqId}`);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-sm transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Create Quotation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
