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
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';

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
    return <LoadingState message="Loading unified operational timeline..." />;
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-rose-600 mb-2" />
        <h2 className="text-base font-bold text-rose-900">Unable to load request</h2>
        <p className="mt-1 text-sm text-rose-700">{error || 'Request not found.'}</p>
        <Link href="/admin/requests" className="mt-4 inline-block">
          <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}>
            Back to Requests
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/requests"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-navy-600 hover:text-navy-900 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Platform Requests
        </Link>
        <span className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-1 text-xs font-mono font-bold text-navy-700">
          ID: {data.id}
        </span>
      </div>

      {/* Header Summary Card */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-surface-100 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-navy-900 font-mono">{data.requestNumber}</h1>
              <StatusBadge status={data.status} />
            </div>
            <p className="mt-1 text-xs text-navy-600">
              Created on {new Date(data.createdAtUtc).toLocaleString()} &bull; Assigned Advisor:{' '}
              <span className="font-bold text-purple-700">{data.assignedAdvisorName || 'Unassigned'}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/admin/customers/${data.customerId}`}>
              <Button variant="outline" size="sm">
                View Customer Profile
              </Button>
            </Link>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5">
          {/* Customer */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-navy-500 uppercase tracking-wider">
              <User className="h-3.5 w-3.5 text-electric-600" /> Customer Information
            </div>
            <p className="text-sm font-bold text-navy-900">{data.customerName}</p>
            <p className="text-xs text-navy-600">{data.customerEmail}</p>
            <p className="text-xs text-navy-600">{data.customerPhone}</p>
          </div>

          {/* Vehicle */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-navy-500 uppercase tracking-wider">
              <CarFront className="h-3.5 w-3.5 text-emerald-600" /> Vehicle
            </div>
            <p className="text-sm font-bold text-navy-900">{data.vehicleMake} {data.vehicleModel}</p>
            <p className="text-xs font-mono font-bold text-navy-700">{data.vehicleLicensePlate}</p>
            {data.serviceCategory && (
              <span className="inline-block mt-1 rounded bg-surface-100 px-2 py-0.5 text-[10px] font-bold text-navy-600 uppercase border border-surface-200">
                {data.serviceCategory}
              </span>
            )}
          </div>

          {/* Service Location */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-navy-500 uppercase tracking-wider">
              <MapPin className="h-3.5 w-3.5 text-red-600" /> Service Coordinates
            </div>
            <p className="text-xs font-medium text-navy-800 truncate">{data.customerAddress || 'Address on record'}</p>
            <p className="text-xs font-mono text-navy-500">
              Lat: {data.customerLatitude.toFixed(4)}, Lon: {data.customerLongitude.toFixed(4)}
            </p>
          </div>
        </div>

        {/* Complaint Snapshot */}
        <div className="mt-5 rounded-xl border border-surface-200 bg-surface-50 p-4">
          <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Problem Description:</span>
          <p className="mt-1 text-xs text-navy-800 font-medium">{data.problemDescription}</p>
        </div>
      </Card>

      {/* Unified Operational Timeline Stages */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-navy-900 flex items-center gap-2">
          <History className="h-5 w-5 text-electric-600" />
          Unified Operational Stages
        </h2>

        {/* Stage 1: 10 KM Garage Matching & Dispatch */}
        <Card className="p-6">
          <div className="flex items-center justify-between pb-3 border-b border-surface-100">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-navy-900">Stage 1: 10 KM Workshop Matching & Dispatches</h3>
            </div>
            <span className="text-xs font-bold text-navy-500">
              {data.dispatchedGarages.length} workshops within radius
            </span>
          </div>
          <div className="mt-4 divide-y divide-surface-100">
            {data.dispatchedGarages.length === 0 ? (
              <p className="py-4 text-xs text-navy-500">No garages dispatched.</p>
            ) : (
              data.dispatchedGarages.map((g) => (
                <div key={g.garageId} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <Link href={`/admin/garages/${g.garageId}`} className="font-bold text-navy-900 hover:text-electric-600">
                      {g.garageName}
                    </Link>
                    <div className="text-navy-500 text-[11px]">{g.garageEmail} &bull; {g.garagePhone}</div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block rounded-lg bg-surface-100 border border-surface-200 px-2 py-0.5 text-[11px] font-mono font-bold text-navy-800">
                      {g.distanceKm} KM
                    </span>
                    <div className="mt-0.5 text-[11px] text-navy-500">{g.status}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Stage 2: Garage Quotations Received */}
        <Card className="p-6">
          <div className="flex items-center justify-between pb-3 border-b border-surface-100">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-electric-600" />
              <h3 className="text-sm font-bold text-navy-900">Stage 2: Workshop Quotations Received</h3>
            </div>
            <span className="text-xs font-bold text-navy-500">
              {data.quotesReceived.length} quotation(s) submitted
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {data.quotesReceived.length === 0 ? (
              <p className="py-4 text-xs text-navy-500">No garage quotations received yet.</p>
            ) : (
              data.quotesReceived.map((q) => (
                <div key={q.quoteId} className="rounded-xl border border-surface-200 bg-surface-50 p-4">
                  <div className="flex items-center justify-between border-b border-surface-200 pb-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-navy-900">{q.quoteNumber}</span>
                      <span className="ml-2 text-xs font-semibold text-navy-700">&bull; {q.garageName}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black font-mono text-emerald-700">₹{q.totalAmount.toLocaleString()}</span>
                      <span className="ml-2 rounded-lg bg-white border border-surface-200 px-2 py-0.5 text-[10px] font-bold text-navy-700">{q.status}</span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-navy-500">
                    <span>Valid until: {new Date(q.validUntil).toLocaleDateString()}</span> &bull;{' '}
                    <span>{q.lineItems.length} line items included</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Stage 3: Advisor Review & Garage Assignment */}
        <Card className="p-6">
          <div className="flex items-center justify-between pb-3 border-b border-surface-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-purple-600" />
              <h3 className="text-sm font-bold text-navy-900">Stage 3: Advisor Review & Assignment</h3>
            </div>
            <span className="text-xs font-bold text-navy-500">
              {data.currentAssignment ? 'Workshop Assigned' : 'Pending Selection'}
            </span>
          </div>
          <div className="mt-4 space-y-4">
            {data.currentAssignment ? (
              <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-purple-700 font-bold uppercase">Selected Workshop:</span>
                    <p className="text-sm font-bold text-navy-900">{data.currentAssignment.garageName}</p>
                    <p className="text-xs text-navy-600 font-mono mt-0.5">Quote #{data.currentAssignment.selectedQuoteNumber}</p>
                  </div>
                  <div className="text-right">
                    <span className="rounded-lg bg-white border border-purple-200 px-2 py-0.5 text-xs font-bold text-purple-700">
                      {data.currentAssignment.status}
                    </span>
                    <p className="text-[11px] text-navy-500 mt-1">
                      Assigned: {new Date(data.currentAssignment.assignedAtUtc).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-navy-500">No garage assignment has been finalized.</p>
            )}

            {/* Advisor Internal Notes */}
            {data.advisorNotes.length > 0 && (
              <div className="mt-3">
                <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Advisor Review Notes:</span>
                <div className="mt-2 space-y-2">
                  {data.advisorNotes.map((note) => (
                    <div key={note.id} className="rounded-xl border border-surface-200 bg-surface-50 p-3 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-navy-500 mb-1">
                        <span className="font-bold text-navy-900">{note.advisorName}</span>
                        <span>{new Date(note.createdAtUtc).toLocaleString()}</span>
                      </div>
                      <p className="text-navy-700 font-medium">{note.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Stage 4: Customer Quotation & Decision */}
        <Card className="p-6">
          <div className="flex items-center justify-between pb-3 border-b border-surface-100">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-bold text-navy-900">Stage 4: Customer Quotation & Decision</h3>
            </div>
            <span className="text-xs font-bold text-navy-500">
              {data.customerQuotation ? data.customerQuotation.status : 'No Proposal Sent'}
            </span>
          </div>
          <div className="mt-4 space-y-4">
            {data.customerQuotation ? (
              <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-navy-900">{data.customerQuotation.quotationNumber}</span>
                    <span className="ml-2 text-xs text-navy-500">Version {data.customerQuotation.currentVersionNumber}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black font-mono text-navy-900">₹{data.customerQuotation.totalAmount.toLocaleString()}</span>
                    <span className="ml-2 rounded-lg bg-white border border-surface-200 px-2 py-0.5 text-xs font-bold text-navy-700">{data.customerQuotation.status}</span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-navy-500">
                  <span>Platform Margin: {data.customerQuotation.platformMarginPercentage}%</span> &bull;{' '}
                  <span>Valid until: {new Date(data.customerQuotation.expiresAtUtc).toLocaleDateString()}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-navy-500">Customer proposal not yet drafted.</p>
            )}

            {/* Customer Decision */}
            {data.customerDecision && (
              <div className={`rounded-xl border p-4 ${
                data.customerDecision.decision === 'ACCEPTED'
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-rose-200 bg-rose-50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {data.customerDecision.decision === 'ACCEPTED' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-600" />
                    )}
                    <span className="text-xs font-bold uppercase text-navy-900">
                      Customer Decision: {data.customerDecision.decision}
                    </span>
                  </div>
                  <span className="text-xs text-navy-500">
                    {new Date(data.customerDecision.decidedAtUtc).toLocaleString()}
                  </span>
                </div>
                {data.customerDecision.decisionReason && (
                  <p className="mt-2 text-xs text-navy-700 font-medium">
                    Reason: {data.customerDecision.decisionReason}
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Stage 5: Service Job Execution */}
        <Card className="p-6">
          <div className="flex items-center justify-between pb-3 border-b border-surface-100">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-orange-600" />
              <h3 className="text-sm font-bold text-navy-900">Stage 5: Workshop Service Execution</h3>
            </div>
            <span className="text-xs font-bold text-navy-500">
              {data.serviceJob ? data.serviceJob.status : 'Booking Not Confirmed'}
            </span>
          </div>
          <div className="mt-4">
            {data.serviceJob ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-surface-200 bg-surface-50 p-4">
                  <div>
                    <span className="font-mono text-xs font-bold text-navy-900">{data.serviceJob.jobNumber}</span>
                    <span className="ml-2 rounded-lg bg-orange-100 border border-orange-200 px-2 py-0.5 text-xs font-bold text-orange-700">
                      {data.serviceJob.status}
                    </span>
                  </div>
                  <div className="text-right text-xs text-navy-500">
                    <span>{data.serviceJob.activitiesCount} activity updates</span> &bull;{' '}
                    <span>{data.serviceJob.additionalWorkRequestsCount} additional work requests</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                    <span className="text-navy-500 font-medium">Vehicle Received:</span>
                    <p className="mt-0.5 font-bold text-navy-900">
                      {data.serviceJob.vehicleReceivedAtUtc ? new Date(data.serviceJob.vehicleReceivedAtUtc).toLocaleString() : 'Pending'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                    <span className="text-navy-500 font-medium">Work Started:</span>
                    <p className="mt-0.5 font-bold text-navy-900">
                      {data.serviceJob.workStartedAtUtc ? new Date(data.serviceJob.workStartedAtUtc).toLocaleString() : 'Pending'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                    <span className="text-navy-500 font-medium">Work Completed:</span>
                    <p className="mt-0.5 font-bold text-navy-900">
                      {data.serviceJob.workCompletedAtUtc ? new Date(data.serviceJob.workCompletedAtUtc).toLocaleString() : 'Pending'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                    <span className="text-navy-500 font-medium">Handed Over / Closed:</span>
                    <p className="mt-0.5 font-bold text-navy-900">
                      {data.serviceJob.closedAtUtc ? new Date(data.serviceJob.closedAtUtc).toLocaleString() : 'In Progress'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-navy-500">No active service execution job for this request.</p>
            )}
          </div>
        </Card>

        {/* Audit Log Events for Request */}
        <Card className="p-6">
          <div className="flex items-center justify-between pb-3 border-b border-surface-100">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-navy-500" />
              <h3 className="text-sm font-bold text-navy-900">Operational Audit Trail</h3>
            </div>
            <span className="text-xs font-bold text-navy-500">{data.timelineEvents.length} events logged</span>
          </div>
          <div className="mt-4 divide-y divide-surface-100">
            {data.timelineEvents.length === 0 ? (
              <p className="py-4 text-xs text-navy-500">No audit events recorded.</p>
            ) : (
              data.timelineEvents.map((evt) => (
                <div key={evt.id} className="py-2.5 flex items-start justify-between gap-4 text-xs">
                  <div>
                    <span className="font-bold text-navy-900">{evt.action}</span>
                    <p className="text-navy-600 text-[11px] mt-0.5">
                      {evt.userEmail || 'System'} &bull; {evt.details}
                    </p>
                  </div>
                  <span className="text-navy-400 text-[11px] whitespace-nowrap font-mono">
                    {new Date(evt.timestampUtc).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
