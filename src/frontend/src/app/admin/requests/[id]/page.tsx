'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { AdminRequestOperationalDetail } from '@/types/adminOperations';
import {
  FileText,
  User,
  CarFront,
  MapPin,
  Clock,
  ArrowLeft,
  Building2,
  FileCheck,
  CheckCircle2,
  XCircle,
  Wrench,
  ShieldCheck,
  AlertTriangle,
  History,
  Tag,
  Calendar
} from 'lucide-react';

export default function AdminRequestTimelinePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [data, setData] = useState<AdminRequestOperationalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRequestDetail() {
      setLoading(true);
      const res = await apiFetch<AdminRequestOperationalDetail>(`/admin/requests/${id}`);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.message || 'Failed to load request timeline.');
      }
      setLoading(false);
    }
    loadRequestDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-500 border-t-transparent" />
          <p className="text-sm text-neutral-400">Loading unified operational timeline...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-rose-400 mb-2" />
        <h2 className="text-base font-semibold text-rose-200">Unable to load request</h2>
        <p className="mt-1 text-sm text-rose-300/80">{error || 'Request not found.'}</p>
        <Link
          href="/admin/requests"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-neutral-800 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Requests
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/requests"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-white transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Platform Requests
        </Link>
        <span className="rounded-full border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs font-mono font-medium text-neutral-300">
          ID: {data.id}
        </span>
      </div>

      {/* Header Summary Card */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-neutral-800 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-white">{data.requestNumber}</h1>
              <span className="rounded-full border border-neutral-700 bg-neutral-800 px-3 py-0.5 text-xs font-semibold text-neutral-200">
                {data.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              Created on {new Date(data.createdAtUtc).toLocaleString()} &bull; Assigned Advisor:{' '}
              <span className="font-semibold text-purple-400">{data.assignedAdvisorName || 'Unassigned'}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/admin/customers/${data.customerId}`}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition"
            >
              View Customer Profile
            </Link>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5">
          {/* Customer */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400">
              <User className="h-3.5 w-3.5 text-blue-400" /> Customer Information
            </div>
            <p className="text-sm font-medium text-white">{data.customerName}</p>
            <p className="text-xs text-neutral-400">{data.customerEmail}</p>
            <p className="text-xs text-neutral-400">{data.customerPhone}</p>
          </div>

          {/* Vehicle */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400">
              <CarFront className="h-3.5 w-3.5 text-emerald-400" /> Vehicle
            </div>
            <p className="text-sm font-medium text-white">{data.vehicleMake} {data.vehicleModel}</p>
            <p className="text-xs font-mono text-neutral-300">{data.vehicleLicensePlate}</p>
            {data.serviceCategory && (
              <span className="inline-block mt-1 rounded bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-400 uppercase">
                {data.serviceCategory}
              </span>
            )}
          </div>

          {/* Service Location */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400">
              <MapPin className="h-3.5 w-3.5 text-red-400" /> Service Coordinates
            </div>
            <p className="text-xs text-neutral-300 truncate">{data.customerAddress || 'Address on record'}</p>
            <p className="text-xs font-mono text-neutral-500">
              Lat: {data.customerLatitude.toFixed(4)}, Lon: {data.customerLongitude.toFixed(4)}
            </p>
          </div>
        </div>

        {/* Complaint Snapshot */}
        <div className="mt-5 rounded-lg border border-neutral-800/80 bg-neutral-950/60 p-4">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Problem Description:</span>
          <p className="mt-1 text-xs text-neutral-200">{data.problemDescription}</p>
        </div>
      </div>

      {/* Unified Operational Timeline Stages */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <History className="h-5 w-5 text-red-400" />
          Unified Operational Stages
        </h2>

        {/* Stage 1: 10 KM Garage Matching & Dispatch */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Stage 1: 10 KM Garage Matching & Dispatches</h3>
            </div>
            <span className="text-xs text-neutral-400">
              {data.dispatchedGarages.length} workshops within radius
            </span>
          </div>
          <div className="mt-4 divide-y divide-neutral-800">
            {data.dispatchedGarages.length === 0 ? (
              <p className="py-4 text-xs text-neutral-500">No garages dispatched.</p>
            ) : (
              data.dispatchedGarages.map((g) => (
                <div key={g.garageId} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <Link href={`/admin/garages/${g.garageId}`} className="font-semibold text-white hover:text-red-400">
                      {g.garageName}
                    </Link>
                    <div className="text-neutral-400 text-[11px]">{g.garageEmail} &bull; {g.garagePhone}</div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block rounded bg-neutral-800 px-2 py-0.5 text-[11px] font-mono text-neutral-300">
                      {g.distanceKm} KM
                    </span>
                    <div className="mt-0.5 text-[11px] text-neutral-500">{g.status}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stage 2: Garage Quotations Received */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Stage 2: Garage Quotations Received</h3>
            </div>
            <span className="text-xs text-neutral-400">
              {data.quotesReceived.length} quotation(s) submitted
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {data.quotesReceived.length === 0 ? (
              <p className="py-4 text-xs text-neutral-500">No garage quotations received yet.</p>
            ) : (
              data.quotesReceived.map((q) => (
                <div key={q.quoteId} className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-4">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-white">{q.quoteNumber}</span>
                      <span className="ml-2 text-xs text-neutral-400">&bull; {q.garageName}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-emerald-400">₹{q.totalAmount.toLocaleString()}</span>
                      <span className="ml-2 rounded bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-300">{q.status}</span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-neutral-400">
                    <span>Valid until: {new Date(q.validUntil).toLocaleDateString()}</span> &bull;{' '}
                    <span>{q.lineItems.length} line items included</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stage 3: Advisor Review & Garage Assignment */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-white">Stage 3: Advisor Review & Assignment</h3>
            </div>
            <span className="text-xs text-neutral-400">
              {data.currentAssignment ? 'Garage Assigned' : 'Pending Selection'}
            </span>
          </div>
          <div className="mt-4 space-y-4">
            {data.currentAssignment ? (
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-purple-300 font-semibold uppercase">Selected Workshop:</span>
                    <p className="text-sm font-bold text-white">{data.currentAssignment.garageName}</p>
                    <p className="text-xs text-neutral-400 font-mono mt-0.5">Quote #{data.currentAssignment.selectedQuoteNumber}</p>
                  </div>
                  <div className="text-right">
                    <span className="rounded bg-purple-500/20 px-2 py-0.5 text-xs font-semibold text-purple-300">
                      {data.currentAssignment.status}
                    </span>
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Assigned: {new Date(data.currentAssignment.assignedAtUtc).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-500">No garage assignment has been finalized.</p>
            )}

            {/* Advisor Internal Notes */}
            {data.advisorNotes.length > 0 && (
              <div className="mt-3">
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Advisor Review Notes:</span>
                <div className="mt-2 space-y-2">
                  {data.advisorNotes.map((note) => (
                    <div key={note.id} className="rounded border border-neutral-800 bg-neutral-950 p-3 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-1">
                        <span className="font-semibold text-neutral-300">{note.advisorName}</span>
                        <span>{new Date(note.createdAtUtc).toLocaleString()}</span>
                      </div>
                      <p className="text-neutral-300">{note.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stage 4: Customer Quotation & Decision */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Stage 4: Customer Quotation & Decision</h3>
            </div>
            <span className="text-xs text-neutral-400">
              {data.customerQuotation ? data.customerQuotation.status : 'No Proposal Sent'}
            </span>
          </div>
          <div className="mt-4 space-y-4">
            {data.customerQuotation ? (
              <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-white">{data.customerQuotation.quotationNumber}</span>
                    <span className="ml-2 text-xs text-neutral-400">Version {data.customerQuotation.currentVersionNumber}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-bold text-white">₹{data.customerQuotation.totalAmount.toLocaleString()}</span>
                    <span className="ml-2 rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">{data.customerQuotation.status}</span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-neutral-400">
                  <span>Platform Margin: {data.customerQuotation.platformMarginPercentage}%</span> &bull;{' '}
                  <span>Valid until: {new Date(data.customerQuotation.expiresAtUtc).toLocaleDateString()}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-500">Customer proposal not yet drafted.</p>
            )}

            {/* Customer Decision */}
            {data.customerDecision && (
              <div className={`rounded-lg border p-4 ${
                data.customerDecision.decision === 'ACCEPTED'
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : 'border-rose-500/30 bg-rose-500/10'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {data.customerDecision.decision === 'ACCEPTED' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-400" />
                    )}
                    <span className="text-xs font-bold uppercase text-white">
                      Customer Decision: {data.customerDecision.decision}
                    </span>
                  </div>
                  <span className="text-xs text-neutral-400">
                    {new Date(data.customerDecision.decidedAtUtc).toLocaleString()}
                  </span>
                </div>
                {data.customerDecision.decisionReason && (
                  <p className="mt-2 text-xs text-neutral-300">
                    Reason: {data.customerDecision.decisionReason}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stage 5: Service Job Execution */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-orange-400" />
              <h3 className="text-sm font-semibold text-white">Stage 5: Workshop Service Execution</h3>
            </div>
            <span className="text-xs text-neutral-400">
              {data.serviceJob ? data.serviceJob.status : 'Booking Not Confirmed'}
            </span>
          </div>
          <div className="mt-4">
            {data.serviceJob ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950/60 p-4">
                  <div>
                    <span className="font-mono text-xs font-bold text-white">{data.serviceJob.jobNumber}</span>
                    <span className="ml-2 rounded bg-orange-500/10 border border-orange-500/30 px-2 py-0.5 text-xs font-medium text-orange-400">
                      {data.serviceJob.status}
                    </span>
                  </div>
                  <div className="text-right text-xs text-neutral-400">
                    <span>{data.serviceJob.activitiesCount} activity updates</span> &bull;{' '}
                    <span>{data.serviceJob.additionalWorkRequestsCount} additional work requests</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="rounded border border-neutral-800 bg-neutral-950 p-3">
                    <span className="text-neutral-500">Vehicle Received:</span>
                    <p className="mt-0.5 font-medium text-white">
                      {data.serviceJob.vehicleReceivedAtUtc ? new Date(data.serviceJob.vehicleReceivedAtUtc).toLocaleString() : 'Pending'}
                    </p>
                  </div>
                  <div className="rounded border border-neutral-800 bg-neutral-950 p-3">
                    <span className="text-neutral-500">Work Started:</span>
                    <p className="mt-0.5 font-medium text-white">
                      {data.serviceJob.workStartedAtUtc ? new Date(data.serviceJob.workStartedAtUtc).toLocaleString() : 'Pending'}
                    </p>
                  </div>
                  <div className="rounded border border-neutral-800 bg-neutral-950 p-3">
                    <span className="text-neutral-500">Work Completed:</span>
                    <p className="mt-0.5 font-medium text-white">
                      {data.serviceJob.workCompletedAtUtc ? new Date(data.serviceJob.workCompletedAtUtc).toLocaleString() : 'Pending'}
                    </p>
                  </div>
                  <div className="rounded border border-neutral-800 bg-neutral-950 p-3">
                    <span className="text-neutral-500">Handed Over / Closed:</span>
                    <p className="mt-0.5 font-medium text-white">
                      {data.serviceJob.closedAtUtc ? new Date(data.serviceJob.closedAtUtc).toLocaleString() : 'In Progress'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-500">No active service execution job for this request.</p>
            )}
          </div>
        </div>

        {/* Audit Log Events for Request */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-neutral-400" />
              <h3 className="text-sm font-semibold text-white">Operational Audit Trail</h3>
            </div>
            <span className="text-xs text-neutral-500">{data.timelineEvents.length} events logged</span>
          </div>
          <div className="mt-4 divide-y divide-neutral-800">
            {data.timelineEvents.length === 0 ? (
              <p className="py-4 text-xs text-neutral-500">No audit events recorded.</p>
            ) : (
              data.timelineEvents.map((evt) => (
                <div key={evt.id} className="py-2.5 flex items-start justify-between gap-4 text-xs">
                  <div>
                    <span className="font-semibold text-neutral-200">{evt.action}</span>
                    <p className="text-neutral-400 text-[11px] mt-0.5">
                      {evt.userEmail || 'System'} &bull; {evt.details}
                    </p>
                  </div>
                  <span className="text-neutral-500 text-[11px] whitespace-nowrap">
                    {new Date(evt.timestampUtc).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
