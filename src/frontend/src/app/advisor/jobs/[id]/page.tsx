'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  AdvisorServiceJobDetailDto,
  ServiceJobStatus,
  AdditionalWorkRequestDto,
  ReviewAdditionalWorkRequest,
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
  Building2,
  Check,
  X,
  Eye,
  Lock,
  MessageSquare,
} from 'lucide-react';

export default function AdvisorJobDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [job, setJob] = useState<AdvisorServiceJobDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Review Additional Work Modal
  const [selectedWork, setSelectedWork] = useState<AdditionalWorkRequestDto | null>(null);
  const [reviewApproved, setReviewApproved] = useState<boolean>(true);
  const [reviewRemarks, setReviewRemarks] = useState<string>('');

  async function loadJob() {
    setLoading(true);
    setErrorMsg(null);
    const res = await apiFetch<AdvisorServiceJobDetailDto>(`/advisor/jobs/${id}`);
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

  async function handleReviewAdditionalWork() {
    if (!selectedWork) return;
    setActionLoading(true);
    setErrorMsg(null);
    const payload: ReviewAdditionalWorkRequest = {
      approved: reviewApproved,
      remarks: reviewRemarks,
    };
    const res = await apiFetch(`/advisor/jobs/${id}/additional-work/${selectedWork.id}/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.success) {
      setSelectedWork(null);
      setReviewRemarks('');
      await loadJob();
    } else {
      setErrorMsg(res.message || 'Failed to review additional work request.');
    }
    setActionLoading(false);
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-navy-500">
        <Clock className="w-8 h-8 mx-auto mb-2 animate-spin text-purple-600" />
        Loading advisor service job review...
      </div>
    );
  }

  if (errorMsg && !job) {
    return (
      <div className="space-y-4">
        <Link
          href="/advisor/jobs"
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
            href="/advisor/jobs"
            className="inline-flex items-center gap-1.5 text-xs text-navy-600 hover:text-navy-900 font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Advisor Jobs
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
            Request <span className="font-mono font-medium text-navy-700">{job.requestNumber}</span> • Customer Quotation <span className="font-mono font-medium text-navy-700">{job.quotationNumber}</span> • Garage <span className="font-semibold text-navy-800">{job.garageName}</span>
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Vehicle Details */}
        <div className="bg-white rounded-xl shadow-card border border-surface-200/60 p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy-500">
            <CarFront className="w-4 h-4 text-purple-600" />
            <span>Vehicle Information</span>
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
            <span>Customer & Workshop</span>
          </div>
          <div>
            <div className="text-base font-bold text-navy-900">{job.customerName}</div>
            <div className="text-xs text-navy-600 flex items-center gap-1.5 mt-1">
              <Phone className="w-3.5 h-3.5 text-navy-400" />
              <span>{job.customerPhone}</span>
            </div>
          </div>
          <div className="pt-2 border-t border-surface-100 text-xs">
            <span className="text-navy-500">Assigned Garage:</span>{' '}
            <span className="font-semibold text-navy-800">{job.garageName}</span>
          </div>
        </div>

        {/* Execution Milestones */}
        <div className="bg-white rounded-xl shadow-card border border-surface-200/60 p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy-500">
            <Clock className="w-4 h-4 text-indigo-500" />
            <span>Execution Milestones</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-navy-500">Scheduled:</span>
              <span className="font-medium text-navy-800">
                {job.scheduledStartAtUtc ? new Date(job.scheduledStartAtUtc).toLocaleString() : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-navy-500">Received:</span>
              <span className="font-medium text-navy-800">
                {job.actualVehicleReceivedAtUtc ? new Date(job.actualVehicleReceivedAtUtc).toLocaleString() : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-navy-500">Work Done:</span>
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

      {/* Additional Work Requests Review Section */}
      <div className="bg-white rounded-xl shadow-card border border-surface-200/60 p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-purple-600" />
            Additional Work Proposals (Advisor Evaluation)
          </h3>
          <p className="text-xs text-navy-500 mt-0.5">
            Advisors review technical necessity and reasonableness of garage proposals. Approval does not automatically bill or modify the accepted customer quotation.
          </p>
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
                  <th className="py-2.5 px-3 text-right">Action</th>
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
                    <td className="py-2.5 px-3 text-right">
                      {work.status === 'PendingAdvisorReview' && (
                        <button
                          onClick={() => {
                            setSelectedWork(work);
                            setReviewApproved(true);
                            setReviewRemarks('');
                          }}
                          className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[11px] font-medium transition-colors"
                        >
                          Review Proposal
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-navy-500 italic">No additional work proposals submitted for this job.</p>
        )}
      </div>

      {/* Inspection Reports */}
      <div className="bg-white rounded-xl shadow-card border border-surface-200/60 p-5 space-y-4">
        <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-purple-600" />
          Technical Physical Inspection Reports
        </h3>
        {job.inspections && job.inspections.length > 0 ? (
          <div className="space-y-3">
            {job.inspections.map((insp) => (
              <div key={insp.id} className="border border-surface-200 rounded-lg p-4 space-y-3 bg-surface-50/30 text-xs">
                <div className="flex items-center justify-between text-navy-500 pb-2 border-b border-surface-200">
                  <span>Inspector: <strong className="text-navy-800">{insp.inspectorName}</strong></span>
                  <span>Overall Severity: <strong className="text-navy-800">{insp.overallSeverity}</strong></span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded border border-surface-200">
                    <div className="font-bold text-navy-800 mb-1 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-navy-400" />
                      Workshop Findings (Confidential)
                    </div>
                    <p className="text-navy-600 whitespace-pre-wrap">{insp.findings || 'No notes'}</p>
                    {insp.recommendations && (
                      <div className="mt-2 pt-2 border-t border-surface-100">
                        <strong className="text-navy-700">Recommendations:</strong> {insp.recommendations}
                      </div>
                    )}
                  </div>
                  <div className="bg-white p-3 rounded border border-surface-200">
                    <div className="font-bold text-emerald-800 mb-1 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                      Customer-Facing Summary
                    </div>
                    <p className="text-navy-600 whitespace-pre-wrap">{insp.customerVisibleSummary || 'None'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-navy-500 italic">No physical inspections recorded yet.</p>
        )}
      </div>

      {/* Activity Timeline */}
      <div className="bg-white rounded-xl shadow-card border border-surface-200/60 p-5 space-y-4">
        <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-navy-500" />
          Full Execution Activity Log
        </h3>
        {job.activities && job.activities.length > 0 ? (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-200">
            {job.activities.map((act) => (
              <div key={act.id} className="relative">
                <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-purple-600 ring-4 ring-white" />
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
                  <p className="text-[11px] text-navy-400 mt-0.5">Actor: {act.actorName}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-navy-500 italic">No activity recorded yet.</p>
        )}
      </div>

      {/* Review Modal */}
      {selectedWork && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-navy-900">Review Additional Work Proposal</h3>
            <div className="text-xs space-y-2 bg-surface-50 p-3 rounded border border-surface-200">
              <div>
                <strong>Description:</strong> {selectedWork.description}
              </div>
              <div>
                <strong>Estimated Additional Amount:</strong> ₹{selectedWork.estimatedAdditionalAmount.toFixed(2)}
              </div>
              <div>
                <strong>Workshop Reason:</strong> {selectedWork.reason}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-navy-700 mb-1">Decision:</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="decision"
                      checked={reviewApproved === true}
                      onChange={() => setReviewApproved(true)}
                      className="text-purple-600"
                    />
                    <span className="text-emerald-700 font-semibold">Approve Proposal</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="decision"
                      checked={reviewApproved === false}
                      onChange={() => setReviewApproved(false)}
                      className="text-purple-600"
                    />
                    <span className="text-rose-700 font-semibold">Reject Proposal</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-navy-700 mb-1">Advisor Remarks:</label>
                <textarea
                  rows={3}
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  placeholder="Enter remarks explaining approval or grounds for rejection..."
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={actionLoading}
                onClick={() => setSelectedWork(null)}
                className="px-3 py-1.5 text-xs text-navy-600 hover:text-navy-900 border rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={handleReviewAdditionalWork}
                className="px-4 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
              >
                {actionLoading ? 'Saving...' : 'Submit Decision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
