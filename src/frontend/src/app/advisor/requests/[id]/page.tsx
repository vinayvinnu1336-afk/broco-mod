'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  QuoteComparisonDto,
  QuoteComparisonItemDto,
  AdvisorRequestNoteDto,
  GarageAssignmentDto,
} from '@/types/customerQuotation';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  MapPin,
  MessageSquare,
  ShieldAlert,
  Send,
  Trash2,
  Edit2,
  AlertCircle,
  Tag,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function AdvisorRequestQuotationReviewPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.id as string;

  const [comparison, setComparison] = useState<QuoteComparisonDto | null>(null);
  const [notes, setNotes] = useState<AdvisorRequestNoteDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Expanded items for line item inspection
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);

  // Assignment Modal
  const [selectedQuoteForAssign, setSelectedQuoteForAssign] = useState<QuoteComparisonItemDto | null>(null);
  const [assignmentReason, setAssignmentReason] = useState('');
  const [assigning, setAssigning] = useState(false);

  // New Note
  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Edit Note
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');

  async function loadData() {
    setLoading(true);
    setErrorMsg(null);

    const [compRes, notesRes] = await Promise.all([
      apiFetch<QuoteComparisonDto>(`/advisor/requests/${requestId}/quotes`),
      apiFetch<AdvisorRequestNoteDto[]>(`/advisor/requests/${requestId}/notes`),
    ]);

    if (compRes.success && compRes.data) {
      setComparison(compRes.data);
    } else {
      setErrorMsg(compRes.message || 'Failed to load quotation comparison.');
    }

    if (notesRes.success && notesRes.data) {
      setNotes(notesRes.data);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (requestId) {
      loadData();
    }
  }, [requestId]);

  async function handleAssignGarage() {
    if (!selectedQuoteForAssign) return;
    setAssigning(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await apiFetch<GarageAssignmentDto>(`/advisor/requests/${requestId}/assignment`, {
      method: 'POST',
      body: JSON.stringify({
        garageId: selectedQuoteForAssign.garageId,
        quoteId: selectedQuoteForAssign.quoteId,
        assignmentReason: assignmentReason || 'Selected by technical advisor after multi-garage comparison.',
      }),
    });

    if (res.success && res.data) {
      setSuccessMsg(`Garage '${selectedQuoteForAssign.garageName}' successfully assigned!`);
      setSelectedQuoteForAssign(null);
      setAssignmentReason('');
      await loadData();
    } else {
      setErrorMsg(res.message || 'Failed to assign garage.');
    }
    setAssigning(false);
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    setAddingNote(true);

    const res = await apiFetch<AdvisorRequestNoteDto>(`/advisor/requests/${requestId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note: newNoteText.trim() }),
    });

    if (res.success && res.data) {
      setNewNoteText('');
      await loadData();
    } else {
      setErrorMsg(res.message || 'Failed to add internal note.');
    }
    setAddingNote(false);
  }

  async function handleUpdateNote(noteId: string) {
    if (!editNoteText.trim()) return;

    const res = await apiFetch<AdvisorRequestNoteDto>(`/advisor/requests/${requestId}/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify({ note: editNoteText.trim() }),
    });

    if (res.success) {
      setEditingNoteId(null);
      setEditNoteText('');
      await loadData();
    } else {
      setErrorMsg(res.message || 'Failed to update note.');
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!confirm('Are you sure you want to delete this internal note?')) return;

    const res = await apiFetch<boolean>(`/advisor/requests/${requestId}/notes/${noteId}`, {
      method: 'DELETE',
    });

    if (res.success) {
      await loadData();
    } else {
      setErrorMsg(res.message || 'Failed to delete note.');
    }
  }

  if (loading) {
    return (
      <div className="py-24 text-center text-sm text-navy-500">
        Loading quotation comparison and workshop analytics...
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-navy-900">Request Not Found or Ineligible</h2>
        <p className="text-sm text-navy-600">{errorMsg || 'Unable to retrieve quotation comparison.'}</p>
        <Link
          href="/advisor/requests"
          className="inline-flex items-center gap-2 px-4 py-2 bg-navy-900 text-white rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Workbench
        </Link>
      </div>
    );
  }

  const activeAssignment = comparison.activeAssignment;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Header Breadcrumb & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/advisor/requests"
            className="inline-flex items-center gap-1.5 text-xs text-navy-500 hover:text-navy-900 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Requests
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-navy-900 tracking-tight">
              Quotation Review: {comparison.requestNumber}
            </h1>
            <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {comparison.requestStatus.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-xs text-navy-600">{comparison.vehicleSummary} • {comparison.customerFormattedAddress}</p>
        </div>

        {activeAssignment && (
          <Link
            href={`/advisor/requests/${requestId}/customer-quotation`}
            className="flex items-center gap-2 px-5 py-2.5 bg-electric-600 hover:bg-electric-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
          >
            <FileText className="w-4 h-4" /> Prepare Customer Quotation
          </Link>
        )}
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm">
          <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Active Assignment Callout */}
      {activeAssignment ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span>Assigned Partner Workshop: {activeAssignment.garageName}</span>
            </div>
            <p className="text-xs text-emerald-700">
              Selected Quote: <span className="font-mono font-semibold">{activeAssignment.quoteNumber}</span> (₹{activeAssignment.quotedAmount.toLocaleString()}) • Assigned by {activeAssignment.assignedByAdvisorName}
            </p>
            {activeAssignment.assignmentReason && (
              <p className="text-xs text-emerald-800 italic mt-1 font-medium">
                Reason: &quot;{activeAssignment.assignmentReason}&quot;
              </p>
            )}
          </div>
          <Link
            href={`/advisor/requests/${requestId}/customer-quotation`}
            className="flex-shrink-0 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition shadow-sm"
          >
            Review / Build Customer Proposal →
          </Link>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-amber-800 text-xs">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <span>
            No workshop currently assigned. Review the competitive quotes below, compare turnaround and pricing, and click <strong>&quot;Select Garage&quot;</strong> to establish operational assignment.
          </span>
        </div>
      )}

      {/* Quotation Comparison Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-navy-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-electric-600" />
            <span>Workshop Quotations ({comparison.quotes.length} received)</span>
          </h2>
          {comparison.lowestQuotedAmount && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              Lowest Bid: ₹{comparison.lowestQuotedAmount.toLocaleString()}
            </span>
          )}
        </div>

        {comparison.quotes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-surface-200 p-8 text-center text-xs text-navy-500">
            No workshop quotations submitted yet. Eligible workshops are currently preparing bids.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {comparison.quotes.map((q) => {
              const isLowest = comparison.lowestQuotedAmount === q.grandTotal;
              const isAssigned = activeAssignment?.selectedQuoteId === q.quoteId;
              const isExpanded = expandedQuoteId === q.quoteId;

              return (
                <div
                  key={q.quoteId}
                  className={`bg-white rounded-2xl border transition shadow-sm overflow-hidden ${
                    isAssigned
                      ? 'border-emerald-500 ring-2 ring-emerald-100'
                      : 'border-surface-200 hover:border-surface-300'
                  }`}
                >
                  <div className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-navy-800 bg-surface-100 px-2 py-0.5 rounded-lg">
                          {q.quoteNumber}
                        </span>
                        <span className="text-sm font-bold text-navy-900">{q.garageName}</span>
                        {isLowest && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                            Lowest Bid
                          </span>
                        )}
                        {isAssigned && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-600 text-white">
                            Selected Workshop
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-navy-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-navy-400" />
                          <span>{q.distanceKm} km away</span>
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-navy-700">
                          <Clock className="w-3.5 h-3.5 text-navy-400" />
                          <span>Est: {q.estimatedDurationDays}d / {q.estimatedDurationHours}h</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-navy-400" />
                          <span>Valid till {new Date(q.validUntil).toLocaleDateString()}</span>
                        </span>
                      </div>

                      {q.notes && (
                        <p className="text-xs text-navy-600 bg-surface-50 p-2 rounded-lg italic">
                          Workshop note: &quot;{q.notes}&quot;
                        </p>
                      )}
                    </div>

                    {/* Financial Summary & Actions */}
                    <div className="flex items-center gap-6 self-end md:self-center">
                      <div className="text-right">
                        <div className="text-xs text-navy-500">Workshop Total</div>
                        <div className="text-lg font-bold text-navy-900">₹{q.grandTotal.toLocaleString()}</div>
                        <div className="text-[10px] text-navy-400">
                          Subtotal ₹{q.subtotal.toLocaleString()} + Tax ₹{q.taxAmount.toLocaleString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedQuoteId(isExpanded ? null : q.quoteId)}
                          className="p-2 border border-surface-200 hover:bg-surface-50 text-navy-600 rounded-xl text-xs transition"
                          title="View line items"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        {!isAssigned ? (
                          <button
                            type="button"
                            onClick={() => setSelectedQuoteForAssign(q)}
                            className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold rounded-xl transition shadow-sm"
                          >
                            Select Garage
                          </button>
                        ) : (
                          <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl">
                            Assigned
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expandable Line Items Table */}
                  {isExpanded && (
                    <div className="bg-surface-50 border-t border-surface-200 p-5 space-y-3">
                      <div className="text-xs font-bold text-navy-800 uppercase tracking-wider">
                        Workshop Line Items Breakdown ({q.lineItems.length})
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-surface-100 text-navy-600 border-b border-surface-200">
                            <tr>
                              <th className="py-2 px-3">Type</th>
                              <th className="py-2 px-3">Description</th>
                              <th className="py-2 px-3 text-right">Qty</th>
                              <th className="py-2 px-3 text-right">Unit Price</th>
                              <th className="py-2 px-3 text-right">Disc</th>
                              <th className="py-2 px-3 text-right">Tax Rate</th>
                              <th className="py-2 px-3 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-surface-200 text-navy-800 font-medium">
                            {q.lineItems.map((li) => (
                              <tr key={li.id}>
                                <td className="py-2 px-3">
                                  <span className="px-2 py-0.5 bg-white border border-surface-200 rounded text-[10px] font-bold">
                                    {li.lineType}
                                  </span>
                                </td>
                                <td className="py-2 px-3">{li.description}</td>
                                <td className="py-2 px-3 text-right">{li.quantity}</td>
                                <td className="py-2 px-3 text-right">₹{li.unitPrice.toLocaleString()}</td>
                                <td className="py-2 px-3 text-right text-rose-600">₹{li.discountAmount.toLocaleString()}</td>
                                <td className="py-2 px-3 text-right">{li.taxRate}%</td>
                                <td className="py-2 px-3 text-right font-bold">₹{li.lineTotal.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Internal Confidential Notes Thread */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-surface-200 pb-4">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-navy-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-500" />
              <span>Advisor Internal Notes</span>
            </h2>
            <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 font-semibold w-fit">
              <ShieldAlert className="w-3.5 h-3.5" /> Confidential to BroCo Mod Internal Staff — Never exposed to Customers or Garages
            </div>
          </div>
          <span className="text-xs font-bold text-navy-500">{notes.length} notes</span>
        </div>

        {/* Notes List */}
        <div className="space-y-3">
          {notes.length === 0 ? (
            <div className="text-center py-6 text-xs text-navy-400">
              No internal notes recorded yet. Record diagnostics, customer preferences, or price margin rationale here.
            </div>
          ) : (
            notes.map((n) => (
              <div key={n.id} className="bg-surface-50 rounded-xl p-4 border border-surface-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-navy-900">{n.advisorName}</span>
                  <div className="flex items-center gap-3 text-navy-400 text-[11px]">
                    <span>{new Date(n.createdAtUtc).toLocaleString()}</span>
                    {n.isOwnNote && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNoteId(n.id);
                            setEditNoteText(n.note);
                          }}
                          className="hover:text-navy-700 text-navy-500"
                          title="Edit note"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(n.id)}
                          className="hover:text-rose-600 text-rose-400"
                          title="Delete note"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {editingNoteId === n.id ? (
                  <div className="space-y-2 pt-1">
                    <textarea
                      value={editNoteText}
                      onChange={(e) => setEditNoteText(e.target.value)}
                      className="w-full text-xs p-2.5 border border-surface-300 rounded-lg focus:ring-1 focus:ring-navy-900 outline-none"
                      rows={2}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingNoteId(null)}
                        className="px-3 py-1 text-xs border border-surface-300 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateNote(n.id)}
                        className="px-3 py-1 text-xs bg-navy-900 text-white rounded-lg font-bold"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-navy-700 whitespace-pre-wrap">{n.note}</p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add Note Form */}
        <form onSubmit={handleAddNote} className="space-y-3 pt-2">
          <textarea
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder="Record technical findings, OEM part price quotes, or dispatch instructions..."
            rows={3}
            className="w-full text-xs p-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-navy-900 outline-none transition"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={addingNote || !newNoteText.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold rounded-xl transition disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{addingNote ? 'Recording...' : 'Add Internal Note'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Assign Garage Confirmation Modal */}
      {selectedQuoteForAssign && (
        <div className="fixed inset-0 bg-navy-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-surface-200">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-navy-900">Confirm Workshop Assignment</h3>
              <p className="text-xs text-navy-600">
                You are assigning workshop <strong>{selectedQuoteForAssign.garageName}</strong> with quote{' '}
                <strong>{selectedQuoteForAssign.quoteNumber}</strong> (₹{selectedQuoteForAssign.grandTotal.toLocaleString()}).
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-navy-800">
                Assignment Justification / Reason (Optional)
              </label>
              <textarea
                value={assignmentReason}
                onChange={(e) => setAssignmentReason(e.target.value)}
                placeholder="E.g., Proven transmission specialist with fastest 1-day turnaround."
                rows={3}
                className="w-full text-xs p-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-navy-900 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedQuoteForAssign(null)}
                className="px-4 py-2 text-xs font-bold text-navy-600 hover:bg-surface-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={assigning}
                onClick={handleAssignGarage}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50"
              >
                {assigning ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
