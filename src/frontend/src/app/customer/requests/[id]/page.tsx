'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { ServiceRequestDetailDto } from '@/types/serviceRequest';
import { CustomerServiceJobDetailDto, ServiceJobStatus } from '@/types/serviceJob';
import {
  Wrench,
  Clock,
  ArrowLeft,
  CheckCircle2,
  Calendar,
  AlertCircle,
  CarFront,
  User,
  Phone,
  FileText,
  ShieldAlert,
  Building2,
  Check,
  Eye,
  MapPin,
  ClipboardList,
} from 'lucide-react';

export default function CustomerRequestDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [request, setRequest] = useState<ServiceRequestDetailDto | null>(null);
  const [job, setJob] = useState<CustomerServiceJobDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      setLoading(true);
      setErrorMsg(null);

      // 1. Fetch request details
      const reqRes = await apiFetch<ServiceRequestDetailDto>(`/customer/requests/${id}`);
      if (reqRes.success && reqRes.data) {
        setRequest(reqRes.data);

        // 2. Fetch service job execution details if available
        const jobRes = await apiFetch<CustomerServiceJobDetailDto>(`/customer/requests/${id}/job`);
        if (jobRes.success && jobRes.data) {
          setJob(jobRes.data);
        }
      } else {
        setErrorMsg(reqRes.message || 'Service request not found.');
      }

      setLoading(false);
    }

    loadData();
  }, [id]);

  function getStepStatus(currentStatus: string, stepName: string) {
    const order: ServiceJobStatus[] = [
      'BookingConfirmed',
      'Scheduled',
      'VehicleReceived',
      'Inspection',
      'WorkStarted',
      'WorkInProgress',
      'WorkCompleted',
      'VehicleReady',
      'HandedOver',
      'Closed',
    ];

    const currentIdx = order.indexOf(currentStatus as ServiceJobStatus);

    let stepIdx = 0;
    switch (stepName) {
      case 'Confirmed':
        stepIdx = 0;
        break;
      case 'Scheduled':
        stepIdx = 1;
        break;
      case 'Received':
        stepIdx = 2;
        break;
      case 'In Progress':
        stepIdx = 4;
        break;
      case 'Ready':
        stepIdx = 7;
        break;
      case 'Handed Over':
        stepIdx = 8;
        break;
    }

    if (currentIdx > stepIdx) return 'completed';
    if (currentIdx === stepIdx) return 'active';
    return 'pending';
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

  function getSeverityBadge(severity: string) {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'low':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-navy-500">
        <Clock className="w-8 h-8 mx-auto mb-2 animate-spin text-electric-600" />
        Loading service request & execution tracker...
      </div>
    );
  }

  if (errorMsg || !request) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Link
          href="/customer/requests"
          className="inline-flex items-center gap-1.5 text-xs text-navy-600 hover:text-navy-900"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Requests
        </Link>
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg || 'Request not found'}</span>
        </div>
      </div>
    );
  }

  const steps = [
    { name: 'Confirmed', label: 'Booking Confirmed' },
    { name: 'Scheduled', label: 'Intake Scheduled' },
    { name: 'Received', label: 'Vehicle Received' },
    { name: 'In Progress', label: 'Work In Progress' },
    { name: 'Ready', label: 'Ready for Pickup' },
    { name: 'Handed Over', label: 'Handed Over' },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Header */}
      <div className="space-y-2">
        <Link
          href="/customer/requests"
          className="inline-flex items-center gap-1.5 text-xs text-navy-600 hover:text-navy-900 font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Service Requests
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold text-electric-600 bg-electric-50 px-2.5 py-1 rounded-lg">
              {request.requestNumber}
            </span>
            <h1 className="text-xl font-bold text-navy-900">{request.vehicleSummary}</h1>
            <span className="font-mono text-xs font-semibold bg-surface-100 text-navy-700 px-2 py-0.5 rounded border border-surface-200">
              {request.vehicleLicensePlate}
            </span>
          </div>
          {job && (
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border self-start sm:self-auto ${getStatusBadge(
                job.status
              )}`}
            >
              {job.status}
            </span>
          )}
        </div>
      </div>

      {/* SERVICE EXECUTION TRACKER (If Job exists) */}
      {job ? (
        <div className="bg-white rounded-2xl shadow-card border border-surface-200/60 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-surface-100">
            <div>
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-bold text-navy-900">Live Service Execution Tracker</h2>
              </div>
              <p className="text-xs text-navy-500 mt-0.5">
                Job <span className="font-mono font-bold text-navy-800">{job.jobNumber}</span> handled by{' '}
                <strong className="text-navy-900">{job.garageName}</strong>
              </p>
            </div>
            {job.estimatedCompletionAtUtc && (
              <div className="text-xs text-navy-600 bg-surface-50 px-3 py-1.5 rounded-lg border border-surface-200">
                <span className="text-navy-400">Est. Ready:</span>{' '}
                <strong className="text-navy-800">
                  {new Date(job.estimatedCompletionAtUtc).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </strong>
              </div>
            )}
          </div>

          {/* Stepper Progress Bar */}
          <div className="relative pt-2">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {steps.map((s, idx) => {
                const status = getStepStatus(job.status, s.name);
                return (
                  <div key={s.name} className="flex flex-col items-center text-center">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-colors mb-2 ${
                        status === 'completed'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : status === 'active'
                          ? 'bg-amber-500 text-white ring-4 ring-amber-100 shadow-sm animate-pulse'
                          : 'bg-surface-100 text-navy-400 border border-surface-200'
                      }`}
                    >
                      {status === 'completed' ? <Check className="w-4 h-4" /> : idx + 1}
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        status === 'completed'
                          ? 'text-emerald-700'
                          : status === 'active'
                          ? 'text-amber-800'
                          : 'text-navy-400'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Customer-Facing Notes */}
          {job.customerFacingNotes && (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900 space-y-1">
              <strong className="block font-bold flex items-center gap-1.5 text-emerald-950">
                <FileText className="w-4 h-4 text-emerald-600" /> Latest Workshop Note:
              </strong>
              <p className="leading-relaxed">{job.customerFacingNotes}</p>
            </div>
          )}

          {/* Inspection Summary (if completed) */}
          {job.inspection && (
            <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <strong className="font-bold text-navy-900 flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-purple-600" /> Intake Inspection Summary
                </strong>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${getSeverityBadge(
                    job.inspection.overallSeverity
                  )}`}
                >
                  Condition: {job.inspection.overallSeverity}
                </span>
              </div>
              <p className="text-navy-700 whitespace-pre-wrap leading-relaxed">
                {job.inspection.customerVisibleSummary || 'Intake inspection verified and passed.'}
              </p>
            </div>
          )}

          {/* Activity Timeline */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-navy-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Service Milestones & Updates
            </h3>
            {job.timeline && job.timeline.length > 0 ? (
              <div className="relative pl-5 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-200">
                {job.timeline.map((act, index) => (
                  <div key={index} className="relative text-xs">
                    <div className="absolute -left-5 top-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-navy-900">{act.activityType}</span>
                      <span className="text-[11px] text-navy-400">
                        {new Date(act.createdAtUtc).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-navy-600 mt-0.5">{act.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-navy-400 italic">No milestone updates logged yet.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-card border border-surface-200/60 p-6 text-center text-xs text-navy-500">
          <Clock className="w-8 h-8 text-navy-300 mx-auto mb-2" />
          <p className="font-medium text-navy-700">Service execution job pending.</p>
          <p className="mt-1">
            Once you accept an advisor quotation proposal, your service job will be automatically scheduled with the assigned workshop.
          </p>
        </div>
      )}

      {/* Original Request Details */}
      <div className="bg-white rounded-2xl shadow-card border border-surface-200/60 p-6 space-y-4 text-xs">
        <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">Service Request Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-navy-400 font-bold uppercase text-[10px]">Reported Issue</span>
            <p className="p-3 bg-surface-50 rounded-xl text-navy-800 font-medium">
              {request.problemDescription}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-navy-400 font-bold uppercase text-[10px]">Service Location</span>
            <div className="p-3 bg-surface-50 rounded-xl space-y-1">
              <div className="font-medium text-navy-900 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-navy-400" />
                <span>{request.serviceLocation.formattedAddress}</span>
              </div>
              <div className="text-[11px] font-mono text-navy-500">
                Coords: {request.serviceLocation.latitude}, {request.serviceLocation.longitude}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
