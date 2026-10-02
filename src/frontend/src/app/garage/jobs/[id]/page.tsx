'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  GarageServiceJobDetailDto,
  ServiceJobStatus,
  InspectionSeverity,
  ScheduleJobRequest,
  ReceiveVehicleRequest,
  StartInspectionRequest,
  CompleteInspectionRequest,
  StartWorkRequest,
  UpdateJobProgressRequest,
  CompleteWorkRequest,
  VehicleReadyRequest,
  HandOverVehicleRequest,
  CloseJobRequest,
  CancelJobRequest,
  CreateAdditionalWorkRequest,
} from '@/types/serviceJob';
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
  ClipboardList,
  PlusCircle,
  Info,
  Check,
  X,
  Send,
  Eye,
  Lock,
} from 'lucide-react';

export default function GarageJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [job, setJob] = useState<GarageServiceJobDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals state
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Form states
  const [scheduleForm, setScheduleForm] = useState<ScheduleJobRequest>({
    scheduledStartAtUtc: '',
    estimatedCompletionAtUtc: '',
    notes: '',
  });

  const [receiveForm, setReceiveForm] = useState<ReceiveVehicleRequest>({
    currentMileageKm: undefined,
    notes: '',
  });

  const [startInspectionSeverity, setStartInspectionSeverity] = useState<InspectionSeverity>('Medium');

  const [completeInspectionForm, setCompleteInspectionForm] = useState<CompleteInspectionRequest>({
    findings: '',
    recommendations: '',
    customerVisibleSummary: '',
    severity: 'Medium',
  });

  const [startWorkNotes, setStartWorkNotes] = useState('');

  const [progressForm, setProgressForm] = useState<UpdateJobProgressRequest>({
    progressNotes: '',
    isCustomerVisible: true,
  });

  const [completeWorkForm, setCompleteWorkForm] = useState<CompleteWorkRequest>({
    notes: '',
    customerFacingNotes: '',
  });

  const [vehicleReadyNotes, setVehicleReadyNotes] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [closingRemarks, setClosingRemarks] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const [additionalWorkForm, setAdditionalWorkForm] = useState<CreateAdditionalWorkRequest>({
    description: '',
    estimatedAdditionalAmount: 0,
    reason: '',
  });

  async function loadJob() {
    setLoading(true);
    setErrorMsg(null);
    const res = await apiFetch<GarageServiceJobDetailDto>(`/garage/jobs/${id}`);
    if (res.success && res.data) {
      setJob(res.data);
    } else {
      setErrorMsg(res.message || 'Failed to load service job details.');
    }
    setLoading(false);
  }

  useEffect(() => {
    if (id) loadJob();
  }, [id]);

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
    switch (severity.toLowerCase()) {
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

  async function handleAction(endpoint: string, payload: any) {
    setActionLoading(true);
    setErrorMsg(null);
    const res = await apiFetch(`/garage/jobs/${id}/${endpoint}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.success) {
      setActiveModal(null);
      await loadJob();
    } else {
      setErrorMsg(res.message || `Action '${endpoint}' failed.`);
    }
    setActionLoading(false);
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-navy-500">
        <Clock className="w-8 h-8 mx-auto mb-2 animate-spin text-amber-500" />
        Loading service job details...
      </div>
    );
  }

  if (errorMsg && !job) {
    return (
      <div className="space-y-4">
        <Link
          href="/garage/jobs"
          className="inline-flex items-center gap-1.5 text-xs text-navy-600 hover:text-navy-900"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Jobs
        </Link>
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/garage/jobs"
            className="inline-flex items-center gap-1.5 text-xs text-navy-600 hover:text-navy-900 font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Workshop Jobs
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono text-navy-900">{job.jobNumber}</h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(
                job.status
              )}`}
            >
              {job.status}
            </span>
          </div>
          <p className="text-xs text-navy-500">
            Linked to Request <span className="font-mono font-medium text-navy-700">{job.requestNumber}</span> • Customer Quotation <span className="font-mono font-medium text-navy-700">{job.quotationNumber}</span>
          </p>
        </div>

        {/* Dynamic Action Buttons based on status */}
        <div className="flex flex-wrap items-center gap-2">
          {job.status === 'BookingConfirmed' && (
            <>
              <button
                onClick={() => setActiveModal('schedule')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm inline-flex items-center gap-1.5"
              >
                <Calendar className="w-4 h-4" /> Schedule Intake
              </button>
              <button
                onClick={() => setActiveModal('cancel')}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
              >
                <X className="w-4 h-4" /> Cancel Booking
              </button>
            </>
          )}

          {job.status === 'Scheduled' && (
            <>
              <button
                onClick={() => setActiveModal('receive')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm inline-flex items-center gap-1.5"
              >
                <CarFront className="w-4 h-4" /> Receive Vehicle
              </button>
              <button
                onClick={() => setActiveModal('cancel')}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
              >
                <X className="w-4 h-4" /> Cancel Booking
              </button>
            </>
          )}

          {job.status === 'VehicleReceived' && (
            <>
              <button
                onClick={() => setActiveModal('startInspection')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm inline-flex items-center gap-1.5"
              >
                <ClipboardList className="w-4 h-4" /> Start Physical Inspection
              </button>
              <button
                onClick={() => setActiveModal('startWork')}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm inline-flex items-center gap-1.5"
              >
                <Wrench className="w-4 h-4" /> Start Work Directly
              </button>
            </>
          )}

          {job.status === 'Inspection' && (
            <>
              <button
                onClick={() => setActiveModal('completeInspection')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Complete Inspection
              </button>
              <button
                onClick={() => setActiveModal('startWork')}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm inline-flex items-center gap-1.5"
              >
                <Wrench className="w-4 h-4" /> Start Work
              </button>
            </>
          )}

          {(job.status === 'WorkStarted' || job.status === 'WorkInProgress') && (
            <>
              <button
                onClick={() => setActiveModal('progress')}
                className="px-3 py-2 bg-white border border-surface-300 hover:bg-surface-50 text-navy-800 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
              >
                <FileText className="w-4 h-4" /> Log Progress Update
              </button>
              <button
                onClick={() => setActiveModal('additionalWork')}
                className="px-3 py-2 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" /> Request Additional Work
              </button>
              <button
                onClick={() => setActiveModal('completeWork')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm inline-flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Complete Work
              </button>
            </>
          )}

          {job.status === 'WorkCompleted' && (
            <button
              onClick={() => setActiveModal('vehicleReady')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" /> Mark Vehicle Ready for Pickup
            </button>
          )}

          {job.status === 'VehicleReady' && (
            <button
              onClick={() => setActiveModal('handover')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm inline-flex items-center gap-1.5"
            >
              <CarFront className="w-4 h-4" /> Hand Over Vehicle
            </button>
          )}

          {job.status === 'HandedOver' && (
            <button
              onClick={() => setActiveModal('close')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm inline-flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Close Service Job
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Vehicle Details */}
        <div className="bg-white rounded-xl shadow-card border border-surface-200/60 p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy-500">
            <CarFront className="w-4 h-4 text-amber-500" />
            <span>Vehicle Specifications</span>
          </div>
          <div>
            <div className="text-base font-bold text-navy-900">
              {job.vehicleYear} {job.vehicleMake} {job.vehicleModel}
            </div>
            <div className="inline-block mt-1 font-mono font-bold bg-surface-100 text-navy-800 px-2 py-0.5 rounded text-xs border border-surface-200">
              {job.vehicleLicensePlate}
            </div>
          </div>
          <div className="pt-2 border-t border-surface-100 text-xs flex justify-between">
            <span className="text-navy-500">Intake Odometer:</span>
            <span className="font-semibold text-navy-800">
              {job.currentMileageKm != null ? `${job.currentMileageKm.toLocaleString()} KM` : 'Not recorded'}
            </span>
          </div>
        </div>

        {/* Customer Information */}
        <div className="bg-white rounded-xl shadow-card border border-surface-200/60 p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy-500">
            <User className="w-4 h-4 text-blue-500" />
            <span>Customer Contact</span>
          </div>
          <div>
            <div className="text-base font-bold text-navy-900">{job.customerName}</div>
            <div className="text-xs text-navy-600 flex items-center gap-1.5 mt-1">
              <Phone className="w-3.5 h-3.5 text-navy-400" />
              <span>{job.customerPhone}</span>
            </div>
          </div>
          <div className="pt-2 border-t border-surface-100 text-xs">
            <span className="text-navy-500">Workshop:</span>{' '}
            <span className="font-semibold text-navy-800">{job.garageName}</span>
          </div>
        </div>

        {/* Operational Schedule */}
        <div className="bg-white rounded-xl shadow-card border border-surface-200/60 p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy-500">
            <Clock className="w-4 h-4 text-indigo-500" />
            <span>Execution Milestones</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-navy-500">Scheduled Start:</span>
              <span className="font-medium text-navy-800">
                {job.scheduledStartAtUtc ? new Date(job.scheduledStartAtUtc).toLocaleString() : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-navy-500">Vehicle Received:</span>
              <span className="font-medium text-navy-800">
                {job.actualVehicleReceivedAtUtc ? new Date(job.actualVehicleReceivedAtUtc).toLocaleString() : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-navy-500">Work Completed:</span>
              <span className="font-medium text-navy-800">
                {job.actualWorkCompletedAtUtc ? new Date(job.actualWorkCompletedAtUtc).toLocaleString() : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-navy-500">Handed Over:</span>
              <span className="font-medium text-navy-800">
                {job.handedOverAtUtc ? new Date(job.handedOverAtUtc).toLocaleString() : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Complaint & Notes */}
      <div className="bg-white rounded-xl shadow-card border border-surface-200/60 p-5 space-y-4">
        <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2">
          <FileText className="w-4 h-4 text-navy-500" />
          Customer Reported Issue & Instructions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-surface-50 p-4 rounded-lg border border-surface-200">
            <div className="font-semibold text-navy-800 mb-1">Customer Problem Description:</div>
            <p className="text-navy-600 whitespace-pre-wrap">{job.problemDescription || 'None recorded'}</p>
          </div>
          <div className="bg-surface-50 p-4 rounded-lg border border-surface-200">
            <div className="font-semibold text-navy-800 mb-1">Customer Complaint Snapshot:</div>
            <p className="text-navy-600 whitespace-pre-wrap">{job.customerComplaintSnapshot || 'None'}</p>
          </div>
        </div>
        {job.customerFacingNotes && (
          <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 text-xs">
            <span className="font-semibold text-emerald-900">Current Customer-Facing Note:</span>{' '}
            <span className="text-emerald-800">{job.customerFacingNotes}</span>
          </div>
        )}
      </div>

      {/* Physical Inspection Findings */}
      <div className="bg-white rounded-xl shadow-card border border-surface-200/60 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-purple-600" />
            Physical Intake Inspection
          </h3>
          {job.inspections && job.inspections.length > 0 && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${getSeverityBadge(
                job.inspections[0].overallSeverity
              )}`}
            >
              Severity: {job.inspections[0].overallSeverity}
            </span>
          )}
        </div>

        {job.inspections && job.inspections.length > 0 ? (
          <div className="space-y-3">
            {job.inspections.map((insp) => (
              <div key={insp.id} className="border border-surface-200 rounded-lg p-4 space-y-3 bg-surface-50/30 text-xs">
                <div className="flex items-center justify-between text-navy-500 pb-2 border-b border-surface-200">
                  <span>Inspector: <strong className="text-navy-800">{insp.inspectorName}</strong></span>
                  <span>
                    {insp.inspectionCompletedAtUtc
                      ? `Completed: ${new Date(insp.inspectionCompletedAtUtc).toLocaleString()}`
                      : `Started: ${new Date(insp.inspectionStartedAtUtc).toLocaleString()}`}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded border border-surface-200">
                    <div className="font-bold text-navy-800 mb-1 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-navy-400" />
                      Confidential Workshop Findings
                    </div>
                    <p className="text-navy-600 whitespace-pre-wrap">{insp.findings || 'No workshop notes'}</p>
                    {insp.recommendations && (
                      <div className="mt-2 pt-2 border-t border-surface-100">
                        <strong className="text-navy-700">Recommendations:</strong> {insp.recommendations}
                      </div>
                    )}
                  </div>
                  <div className="bg-white p-3 rounded border border-surface-200">
                    <div className="font-bold text-emerald-800 mb-1 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                      Customer-Visible Inspection Summary
                    </div>
                    <p className="text-navy-600 whitespace-pre-wrap">
                      {insp.customerVisibleSummary || 'No customer summary specified.'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-navy-500 italic">No physical inspection recorded for this job yet.</p>
        )}
      </div>

      {/* Additional Work Requests */}
      <div className="bg-white rounded-xl shadow-card border border-surface-200/60 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-amber-600" />
              Additional Work Requests
            </h3>
            <p className="text-[11px] text-navy-500 mt-0.5">
              Work proposals discovered during inspection/service. Must be reviewed by Technical Advisor. Quotations and customer charges are never automatically modified.
            </p>
          </div>
          {(job.status === 'WorkStarted' || job.status === 'WorkInProgress') && (
            <button
              onClick={() => setActiveModal('additionalWork')}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Request Additional Work
            </button>
          )}
        </div>

        {job.additionalWorkRequests && job.additionalWorkRequests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-navy-700 font-semibold">
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Est. Amount</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Advisor Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {job.additionalWorkRequests.map((work) => (
                  <tr key={work.id}>
                    <td className="py-2.5 px-3 font-medium text-navy-900">{work.description}</td>
                    <td className="py-2.5 px-3 font-semibold text-navy-800">
                      ₹{work.estimatedAdditionalAmount.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-navy-600">{work.reason}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          work.status === 'Approved'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : work.status === 'Rejected'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {work.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-navy-600">
                      {work.advisorRemarks || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-navy-500 italic">No additional work requested during this service.</p>
        )}
      </div>

      {/* Activity Timeline */}
      <div className="bg-white rounded-xl shadow-card border border-surface-200/60 p-5 space-y-4">
        <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-navy-500" />
          Service Execution Activity Log
        </h3>
        {job.activities && job.activities.length > 0 ? (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-200">
            {job.activities.map((act) => (
              <div key={act.id} className="relative">
                <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-white" />
                <div className="text-xs">
                  <div className="flex items-center gap-2 font-semibold text-navy-900">
                    <span>{act.activityType}</span>
                    <span className="text-[10px] text-navy-400 font-normal">
                      {new Date(act.createdAtUtc).toLocaleString()}
                    </span>
                    {act.isCustomerVisible ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        <Eye className="w-2.5 h-2.5" /> Customer Visible
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-navy-600 bg-surface-100 px-1.5 py-0.2 rounded border border-surface-200">
                        <Lock className="w-2.5 h-2.5" /> Internal Workshop
                      </span>
                    )}
                  </div>
                  <p className="text-navy-700 mt-0.5">{act.message}</p>
                  <p className="text-[11px] text-navy-400 mt-0.5">By: {act.actorName}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-navy-500 italic">No activity recorded yet.</p>
        )}
      </div>

      {/* MODALS */}

      {/* 1. Schedule Modal */}
      {activeModal === 'schedule' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-navy-900">Schedule Service Intake</h3>
            <p className="text-xs text-navy-600">
              Set the planned intake and estimated completion dates for vehicle {job.vehicleMake} ({job.vehicleLicensePlate}).
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-navy-700 mb-1">Scheduled Start Time (UTC):</label>
                <input
                  type="datetime-local"
                  value={scheduleForm.scheduledStartAtUtc}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledStartAtUtc: e.target.value })}
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-navy-700 mb-1">Estimated Ready Time (UTC):</label>
                <input
                  type="datetime-local"
                  value={scheduleForm.estimatedCompletionAtUtc}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, estimatedCompletionAtUtc: e.target.value })}
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-navy-700 mb-1">Notes (Optional):</label>
                <textarea
                  rows={2}
                  value={scheduleForm.notes}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                  placeholder="Intake scheduling remarks..."
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={actionLoading}
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 text-xs text-navy-600 hover:text-navy-900 border rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading || !scheduleForm.scheduledStartAtUtc || !scheduleForm.estimatedCompletionAtUtc}
                onClick={() => handleAction('schedule', scheduleForm)}
                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50"
              >
                {actionLoading ? 'Scheduling...' : 'Confirm Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Receive Vehicle Modal */}
      {activeModal === 'receive' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-navy-900">Record Physical Vehicle Intake</h3>
            <p className="text-xs text-navy-600">
              Confirm that the vehicle has physically arrived at the workshop. Once received, customer cancellation is strictly locked.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-navy-700 mb-1">Current Odometer Reading (KM):</label>
                <input
                  type="number"
                  value={receiveForm.currentMileageKm || ''}
                  onChange={(e) => setReceiveForm({ ...receiveForm, currentMileageKm: Number(e.target.value) })}
                  placeholder="e.g. 45200"
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-navy-700 mb-1">Intake Remarks:</label>
                <textarea
                  rows={2}
                  value={receiveForm.notes}
                  onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })}
                  placeholder="Body condition, fuel level, possessions..."
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={actionLoading}
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 text-xs text-navy-600 hover:text-navy-900 border rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={() => handleAction('receive-vehicle', receiveForm)}
                className="px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
              >
                {actionLoading ? 'Saving...' : 'Confirm Vehicle Received'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Start Inspection Modal */}
      {activeModal === 'startInspection' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-navy-900">Start Physical Inspection</h3>
            <p className="text-xs text-navy-600">
              Initiate technical physical inspection for vehicle {job.vehicleLicensePlate}.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-navy-700 mb-1">Initial Severity Assessment:</label>
                <select
                  value={startInspectionSeverity}
                  onChange={(e) => setStartInspectionSeverity(e.target.value as InspectionSeverity)}
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg"
                >
                  <option value="Info">Info</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={actionLoading}
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 text-xs text-navy-600 hover:text-navy-900 border rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={() => handleAction('start-inspection', { severity: startInspectionSeverity })}
                className="px-4 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
              >
                {actionLoading ? 'Starting...' : 'Begin Inspection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Complete Inspection Modal */}
      {activeModal === 'completeInspection' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-navy-900">Complete Physical Inspection</h3>
            <p className="text-xs text-navy-600">
              Document your inspection findings. Internal findings remain confidential to workshop and advisor; the summary will be shared with the customer.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-navy-700 mb-1">Overall Inspection Severity:</label>
                <select
                  value={completeInspectionForm.severity}
                  onChange={(e) =>
                    setCompleteInspectionForm({
                      ...completeInspectionForm,
                      severity: e.target.value as InspectionSeverity,
                    })
                  }
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg"
                >
                  <option value="Info">Info</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-navy-700 mb-1">
                  Workshop Findings (Confidential):
                </label>
                <textarea
                  rows={3}
                  value={completeInspectionForm.findings}
                  onChange={(e) =>
                    setCompleteInspectionForm({ ...completeInspectionForm, findings: e.target.value })
                  }
                  placeholder="Detailed diagnostic observations, technician notes..."
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-navy-700 mb-1">
                  Workshop Recommendations (Internal):
                </label>
                <textarea
                  rows={2}
                  value={completeInspectionForm.recommendations}
                  onChange={(e) =>
                    setCompleteInspectionForm({ ...completeInspectionForm, recommendations: e.target.value })
                  }
                  placeholder="Recommended repairs, parts needed..."
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-navy-700 mb-1">
                  Customer-Visible Summary:
                </label>
                <textarea
                  rows={2}
                  value={completeInspectionForm.customerVisibleSummary}
                  onChange={(e) =>
                    setCompleteInspectionForm({
                      ...completeInspectionForm,
                      customerVisibleSummary: e.target.value,
                    })
                  }
                  placeholder="Clear, non-technical overview visible to customer..."
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={actionLoading}
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 text-xs text-navy-600 hover:text-navy-900 border rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={() => handleAction('complete-inspection', completeInspectionForm)}
                className="px-4 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
              >
                {actionLoading ? 'Saving...' : 'Save & Complete Inspection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Start Work Modal */}
      {activeModal === 'startWork' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-navy-900">Start Service Execution</h3>
            <p className="text-xs text-navy-600">
              Commence active mechanical repair/servicing on the vehicle.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-navy-700 mb-1">Starting Notes (Optional):</label>
                <textarea
                  rows={2}
                  value={startWorkNotes}
                  onChange={(e) => setStartWorkNotes(e.target.value)}
                  placeholder="Technician assignment, bay number..."
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={actionLoading}
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 text-xs text-navy-600 hover:text-navy-900 border rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={() => handleAction('start-work', { notes: startWorkNotes })}
                className="px-4 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg"
              >
                {actionLoading ? 'Starting...' : 'Confirm Work Started'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Progress Update Modal */}
      {activeModal === 'progress' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-navy-900">Log Execution Progress</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-navy-700 mb-1">Progress Notes:</label>
                <textarea
                  rows={3}
                  value={progressForm.progressNotes}
                  onChange={(e) => setProgressForm({ ...progressForm, progressNotes: e.target.value })}
                  placeholder="Describe progress (e.g. Engine oil drained, new filter installed)..."
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="custVisible"
                  checked={progressForm.isCustomerVisible}
                  onChange={(e) => setProgressForm({ ...progressForm, isCustomerVisible: e.target.checked })}
                  className="rounded text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="custVisible" className="text-navy-700 font-medium">
                  Make note visible on Customer Timeline
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={actionLoading}
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 text-xs text-navy-600 hover:text-navy-900 border rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading || !progressForm.progressNotes.trim()}
                onClick={() => handleAction('progress', progressForm)}
                className="px-4 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Post Progress'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Complete Work Modal */}
      {activeModal === 'completeWork' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-navy-900">Complete Mechanical Work</h3>
            <p className="text-xs text-navy-600">
              Confirm that all agreed service items and approved repairs have been finished.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-navy-700 mb-1">Completion Remarks (Internal):</label>
                <textarea
                  rows={2}
                  value={completeWorkForm.notes}
                  onChange={(e) => setCompleteWorkForm({ ...completeWorkForm, notes: e.target.value })}
                  placeholder="Testing results, torque specs verified..."
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-navy-700 mb-1">Customer-Facing Notes:</label>
                <textarea
                  rows={2}
                  value={completeWorkForm.customerFacingNotes}
                  onChange={(e) =>
                    setCompleteWorkForm({ ...completeWorkForm, customerFacingNotes: e.target.value })
                  }
                  placeholder="Work finished successfully, washing vehicle..."
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={actionLoading}
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 text-xs text-navy-600 hover:text-navy-900 border rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={() => handleAction('complete-work', completeWorkForm)}
                className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
              >
                {actionLoading ? 'Saving...' : 'Mark Work Completed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Vehicle Ready Modal */}
      {activeModal === 'vehicleReady' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-navy-900">Mark Vehicle Ready for Pickup</h3>
            <p className="text-xs text-navy-600">
              The customer and Technical Advisor will be notified that the vehicle is ready for collection.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-navy-700 mb-1">Customer Note:</label>
                <textarea
                  rows={2}
                  value={vehicleReadyNotes}
                  onChange={(e) => setVehicleReadyNotes(e.target.value)}
                  placeholder="Your car is ready for pickup during working hours..."
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={actionLoading}
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 text-xs text-navy-600 hover:text-navy-900 border rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={() => handleAction('vehicle-ready', { customerFacingNotes: vehicleReadyNotes })}
                className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
              >
                {actionLoading ? 'Updating...' : 'Notify Ready'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Handover Vehicle Modal */}
      {activeModal === 'handover' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-navy-900">Record Vehicle Handover</h3>
            <p className="text-xs text-navy-600">
              Confirm that the vehicle and keys have been physically handed back to the customer.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-navy-700 mb-1">Handover Remarks:</label>
                <textarea
                  rows={2}
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  placeholder="Keys handed over, customer satisfied..."
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={actionLoading}
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 text-xs text-navy-600 hover:text-navy-900 border rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={() => handleAction('handover', { handoverNotes })}
                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              >
                {actionLoading ? 'Updating...' : 'Confirm Handover'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Close Job Modal */}
      {activeModal === 'close' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-navy-900">Close Service Job</h3>
            <p className="text-xs text-navy-600">
              Archive and close this completed service job. This is the terminal execution state.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-navy-700 mb-1">Closing Remarks:</label>
                <textarea
                  rows={2}
                  value={closingRemarks}
                  onChange={(e) => setClosingRemarks(e.target.value)}
                  placeholder="Final billing reconciled, job closed..."
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={actionLoading}
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 text-xs text-navy-600 hover:text-navy-900 border rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={() => handleAction('close', { closingRemarks })}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white rounded-lg"
              >
                {actionLoading ? 'Closing...' : 'Close Job'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. Cancel Modal */}
      {activeModal === 'cancel' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-rose-700">Cancel Service Booking</h3>
            <p className="text-xs text-navy-600">
              Cancellation is only permitted prior to vehicle physical intake. Please provide a reason.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-navy-700 mb-1">Cancellation Reason:</label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason for cancellation..."
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={actionLoading}
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 text-xs text-navy-600 hover:text-navy-900 border rounded-lg"
              >
                Go Back
              </button>
              <button
                disabled={actionLoading || !cancelReason.trim()}
                onClick={() => handleAction('cancel', { reason: cancelReason })}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg disabled:opacity-50"
              >
                {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 12. Additional Work Request Modal */}
      {activeModal === 'additionalWork' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-navy-900">Request Additional Work Proposal</h3>
            <p className="text-xs text-navy-600">
              Submit a newly discovered repair or maintenance requirement. This request will be sent to the Technical Advisor for review.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-navy-700 mb-1">Work Description:</label>
                <input
                  type="text"
                  value={additionalWorkForm.description}
                  onChange={(e) =>
                    setAdditionalWorkForm({ ...additionalWorkForm, description: e.target.value })
                  }
                  placeholder="e.g. Front Brake Pad Replacement"
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-navy-700 mb-1">Estimated Additional Amount (₹):</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={additionalWorkForm.estimatedAdditionalAmount || ''}
                  onChange={(e) =>
                    setAdditionalWorkForm({
                      ...additionalWorkForm,
                      estimatedAdditionalAmount: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="e.g. 1800.00"
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-navy-700 mb-1">Reason / Justification:</label>
                <textarea
                  rows={2}
                  value={additionalWorkForm.reason}
                  onChange={(e) =>
                    setAdditionalWorkForm({ ...additionalWorkForm, reason: e.target.value })
                  }
                  placeholder="Observed 2mm remaining thickness, uneven rotor wear..."
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={actionLoading}
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 text-xs text-navy-600 hover:text-navy-900 border rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={
                  actionLoading ||
                  !additionalWorkForm.description.trim() ||
                  additionalWorkForm.estimatedAdditionalAmount <= 0
                }
                onClick={() => handleAction('additional-work', additionalWorkForm)}
                className="px-4 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg disabled:opacity-50"
              >
                {actionLoading ? 'Submitting...' : 'Submit to Advisor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
