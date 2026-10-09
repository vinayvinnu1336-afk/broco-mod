'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatDate, formatDateTime, formatINR, formatINRWhole, formatRelative, humanize } from '@/lib/format';
import {
  QuoteComparisonDto,
  QuoteComparisonItemDto,
  AdvisorRequestNoteDto,
  GarageAssignmentDto,
} from '@/types/customerQuotation';
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Lock,
  MapPin,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActionBar, ActionBarSpacer } from '@/components/ui/ActionBar';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { Textarea } from '@/components/ui/Textarea';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

const linkButtonPrimary =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-electric-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-electric-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-600 focus-visible:ring-offset-2';

function formatDuration(days: number, hours: number) {
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (hours > 0) parts.push(`${hours} h`);
  return parts.length ? parts.join(' ') : 'Not given';
}

function isPast(value: string) {
  const t = new Date(value).getTime();
  return !Number.isNaN(t) && t < Date.now();
}

function QuoteFact({ label, children, tone }: { label: string; children: React.ReactNode; tone?: 'red' }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-sm text-navy-500">{label}</dt>
      <dd className={`text-right text-sm font-medium ${tone === 'red' ? 'text-red-600' : 'text-navy-900'}`}>
        {children}
      </dd>
    </div>
  );
}

export default function AdvisorRequestQuotationReviewPage() {
  const params = useParams();
  const requestId = params.id as string;
  const toast = useToast();

  const [comparison, setComparison] = useState<QuoteComparisonDto | null>(null);
  const [notes, setNotes] = useState<AdvisorRequestNoteDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Expanded quote for line item inspection
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);

  // Assignment sheet
  const [selectedQuoteForAssign, setSelectedQuoteForAssign] = useState<QuoteComparisonItemDto | null>(null);
  const [assignmentReason, setAssignmentReason] = useState('');
  const [assigning, setAssigning] = useState(false);

  // New note
  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Edit / delete note
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [deletingNote, setDeletingNote] = useState(false);

  const loadData = useCallback(async () => {
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
  }, [requestId]);

  useEffect(() => {
    if (requestId) {
      setLoading(true);
      loadData();
    }
  }, [requestId, loadData]);

  async function handleAssignGarage() {
    if (!selectedQuoteForAssign) return;
    setAssigning(true);

    const res = await apiFetch<GarageAssignmentDto>(`/advisor/requests/${requestId}/assignment`, {
      method: 'POST',
      body: JSON.stringify({
        garageId: selectedQuoteForAssign.garageId,
        quoteId: selectedQuoteForAssign.quoteId,
        assignmentReason: assignmentReason || 'Selected by technical advisor after multi-garage comparison.',
      }),
    });

    if (res.success && res.data) {
      toast.success(`${selectedQuoteForAssign.garageName} assigned`, 'Next, prepare the customer quotation.');
      setSelectedQuoteForAssign(null);
      setAssignmentReason('');
      await loadData();
    } else {
      toast.error('Could not assign garage', res.message || 'Failed to assign garage.');
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
      toast.error('Could not add note', res.message || 'Failed to add internal note.');
    }
    setAddingNote(false);
  }

  async function handleUpdateNote(noteId: string) {
    if (!editNoteText.trim()) return;
    setSavingNote(true);

    const res = await apiFetch<AdvisorRequestNoteDto>(`/advisor/requests/${requestId}/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify({ note: editNoteText.trim() }),
    });

    if (res.success) {
      setEditingNoteId(null);
      setEditNoteText('');
      await loadData();
    } else {
      toast.error('Could not update note', res.message || 'Failed to update note.');
    }
    setSavingNote(false);
  }

  async function handleDeleteNote() {
    if (!noteToDelete) return;
    setDeletingNote(true);

    const res = await apiFetch<boolean>(`/advisor/requests/${requestId}/notes/${noteToDelete}`, {
      method: 'DELETE',
    });

    if (res.success) {
      setNoteToDelete(null);
      await loadData();
    } else {
      toast.error('Could not delete note', res.message || 'Failed to delete note.');
    }
    setDeletingNote(false);
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-16 w-2/3 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="space-y-5">
        <PageHeader title="Service request" backHref="/advisor/requests" backLabel="Service requests" />
        <ErrorState
          title="Could not load this request"
          error={errorMsg || 'Unable to retrieve quotation comparison.'}
          onRetry={() => {
            setLoading(true);
            loadData();
          }}
        />
      </div>
    );
  }

  const activeAssignment = comparison.activeAssignment;
  const quotes = comparison.quotes ?? [];
  const showLowest = quotes.length > 1 && typeof comparison.lowestQuotedAmount === 'number';

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        backHref="/advisor/requests"
        backLabel="Service requests"
        eyebrow={
          <>
            <span className="font-mono text-xs font-semibold text-navy-500">{comparison.requestNumber}</span>
            <StatusBadge status={comparison.requestStatus} />
          </>
        }
        title={comparison.vehicleSummary}
      />

      {/* Request summary */}
      <Card className="p-4 sm:p-5">
        <div className="space-y-4">
          <section>
            <h2 className="text-base font-semibold text-navy-900">Customer&apos;s problem</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-navy-700">
              {comparison.problemDescription || 'No description given.'}
            </p>
          </section>
          {comparison.customerFormattedAddress && (
            <p className="flex items-start gap-2 text-sm text-navy-700">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" />
              <span>{comparison.customerFormattedAddress}</span>
            </p>
          )}
          <dl className="grid grid-cols-2 gap-3 border-t border-surface-200 pt-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-navy-500">Quotes received</dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums text-navy-900">{comparison.totalQuotesCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-navy-500">Garages yet to quote</dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums text-navy-900">{comparison.pendingGaragesCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-navy-500">Lowest quote</dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums text-navy-900">
                {typeof comparison.lowestQuotedAmount === 'number' ? formatINRWhole(comparison.lowestQuotedAmount) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-navy-500">Latest quote</dt>
              <dd className="mt-0.5 text-sm font-medium text-navy-900">
                {comparison.latestQuoteReceivedAtUtc ? formatRelative(comparison.latestQuoteReceivedAtUtc) : '—'}
              </dd>
            </div>
          </dl>
        </div>
      </Card>

      {/* Assignment status */}
      {activeAssignment ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-emerald-900">Assigned to {activeAssignment.garageName}</p>
              <p className="text-sm text-emerald-800">
                Quote <span className="font-mono">{activeAssignment.selectedQuoteNumber}</span> ·{' '}
                {formatINR(activeAssignment.selectedQuoteAmount)}
              </p>
              <p className="text-xs text-emerald-700">
                By {activeAssignment.assignedByAdvisorName} · {formatDateTime(activeAssignment.assignedAtUtc)}
              </p>
              {activeAssignment.assignmentReason && (
                <p className="text-xs text-emerald-800">Reason: {activeAssignment.assignmentReason}</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        quotes.length > 0 && (
          <p className="text-sm text-navy-600">
            No garage assigned yet. Compare the quotes below and choose one.
          </p>
        )
      )}

      {/* Quote comparison: stacked cards on phones, side by side from md */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-navy-900">Garage quotes ({quotes.length})</h2>

        {quotes.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No quotes yet"
            description={
              comparison.pendingGaragesCount > 0
                ? `${comparison.pendingGaragesCount} garage${comparison.pendingGaragesCount === 1 ? ' has' : 's have'} not replied yet.`
                : 'Garage quotes will appear here as they come in.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {quotes.map((q) => {
              const isLowest = showLowest && comparison.lowestQuotedAmount === q.grandTotal;
              const isAssigned = activeAssignment?.selectedQuoteId === q.quoteId;
              const isExpanded = expandedQuoteId === q.quoteId;
              const expired = isPast(q.validUntil);
              const lineItems = q.lineItems ?? [];

              return (
                <Card
                  key={q.quoteId}
                  className={`flex flex-col p-4 sm:p-5 ${isAssigned ? 'border-emerald-400 ring-2 ring-emerald-100' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-navy-900">{q.garageName}</h3>
                      <p className="font-mono text-xs text-navy-500">{q.quoteNumber}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {isAssigned && (
                        <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                          Assigned
                        </span>
                      )}
                      {isLowest && (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          Lowest
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-2xl font-bold tabular-nums tracking-tight text-navy-900">
                      {formatINR(q.grandTotal)}
                    </div>
                    <div className="text-xs text-navy-500">
                      {formatINR(q.subtotal)} + {formatINR(q.taxAmount)} tax
                      {q.discountAmount > 0 && <> · {formatINR(q.discountAmount)} off</>}
                    </div>
                  </div>

                  <dl className="mt-3 divide-y divide-surface-200 border-y border-surface-200">
                    <QuoteFact label="Time needed">
                      {formatDuration(q.estimatedDurationDays, q.estimatedDurationHours)}
                    </QuoteFact>
                    <QuoteFact label="Valid until" tone={expired ? 'red' : undefined}>
                      {expired ? `Expired ${formatDate(q.validUntil)}` : formatDate(q.validUntil)}
                    </QuoteFact>
                    <QuoteFact label="Distance">
                      {typeof q.distanceKm === 'number' ? `${q.distanceKm.toFixed(1)} km` : '—'}
                    </QuoteFact>
                    <QuoteFact label="Submitted">{formatRelative(q.submittedAtUtc)}</QuoteFact>
                  </dl>

                  {q.notes && (
                    <p className="mt-3 rounded-xl bg-surface-50 p-3 text-sm text-navy-700">
                      <span className="font-medium text-navy-900">Garage note: </span>
                      {q.notes}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => setExpandedQuoteId(isExpanded ? null : q.quoteId)}
                    aria-expanded={isExpanded}
                    className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 self-start text-sm font-medium text-electric-600 hover:text-electric-700"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {isExpanded ? 'Hide' : 'Show'} {lineItems.length || q.lineItemsCount} line item
                    {(lineItems.length || q.lineItemsCount) === 1 ? '' : 's'}
                  </button>

                  {isExpanded && (
                    <ul className="mb-2 divide-y divide-surface-200 rounded-xl border border-surface-200">
                      {lineItems.map((li) => (
                        <li key={li.id} className="px-3 py-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <span className="min-w-0 text-sm text-navy-900">{li.description}</span>
                            <span className="shrink-0 text-sm font-semibold tabular-nums text-navy-900">
                              {formatINR(li.lineTotal)}
                            </span>
                          </div>
                          <div className="mt-0.5 text-xs text-navy-500">
                            {humanize(li.lineType)} · {li.quantity} × {formatINR(li.unitPrice)}
                            {li.discountAmount > 0 && <> · {formatINR(li.discountAmount)} off</>} · {li.taxRate}% tax
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-auto pt-3">
                    {isAssigned ? (
                      <div className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-50 text-sm font-semibold text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        Assigned garage
                      </div>
                    ) : (
                      <Button
                        variant={activeAssignment ? 'outline' : 'secondary'}
                        className="w-full"
                        onClick={() => setSelectedQuoteForAssign(q)}
                      >
                        Assign this garage
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Internal notes */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-navy-900">Internal notes</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-navy-500">
              <Lock className="h-3.5 w-3.5" />
              Only advisors and admins see these. Never shown to customers or garages.
            </p>
          </div>
          <span className="shrink-0 text-xs text-navy-500">{notes.length}</span>
        </div>

        <div className="mt-4 space-y-3">
          {notes.length === 0 ? (
            <p className="text-sm text-navy-500">No notes yet.</p>
          ) : (
            notes.map((n) => (
              <div key={n.id} className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-navy-900">{n.advisorName}</div>
                    <div className="text-xs text-navy-500">
                      {formatDateTime(n.createdAtUtc)}
                      {n.updatedAtUtc ? ' · edited' : ''}
                    </div>
                  </div>
                  {n.isOwnNote && editingNoteId !== n.id && (
                    <div className="-mr-1 -mt-1 flex shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNoteId(n.id);
                          setEditNoteText(n.note);
                        }}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-navy-500 hover:bg-surface-100 hover:text-navy-800"
                        aria-label="Edit note"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setNoteToDelete(n.id)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700"
                        aria-label="Delete note"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {editingNoteId === n.id ? (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      aria-label="Edit note"
                      value={editNoteText}
                      onChange={(e) => setEditNoteText(e.target.value)}
                      rows={3}
                    />
                    <div className="flex gap-2 sm:justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 sm:flex-none"
                        onClick={() => setEditingNoteId(null)}
                        disabled={savingNote}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 sm:flex-none"
                        onClick={() => handleUpdateNote(n.id)}
                        isLoading={savingNote}
                        disabled={!editNoteText.trim()}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-navy-700">{n.note}</p>
                )}
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleAddNote} className="mt-4 space-y-2 border-t border-surface-200 pt-4">
          <Textarea
            label="Add a note"
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder="Findings, customer preferences, why you chose a garage..."
            rows={3}
          />
          <div className="flex sm:justify-end">
            <Button
              type="submit"
              variant="outline"
              className="w-full sm:w-auto"
              isLoading={addingNote}
              disabled={!newNoteText.trim()}
            >
              Add note
            </Button>
          </div>
        </form>
      </Card>

      {activeAssignment && (
        <>
          <ActionBar
            summary={
              <div className="min-w-0">
                <div className="truncate text-xs text-navy-500">{activeAssignment.garageName}</div>
                <div className="text-base font-bold tabular-nums text-navy-900">
                  {formatINRWhole(activeAssignment.selectedQuoteAmount)}
                </div>
              </div>
            }
          >
            <Link href={`/advisor/requests/${requestId}/customer-quotation`} className={linkButtonPrimary}>
              <FileText className="h-4 w-4" />
              Customer quotation
            </Link>
          </ActionBar>
          <ActionBarSpacer />
        </>
      )}

      {/* Assign garage sheet */}
      <Modal
        isOpen={!!selectedQuoteForAssign}
        onClose={() => !assigning && setSelectedQuoteForAssign(null)}
        title={selectedQuoteForAssign ? `Assign ${selectedQuoteForAssign.garageName}?` : undefined}
        description="After assigning, you prepare the customer quotation from this garage's quote."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setSelectedQuoteForAssign(null)}
              disabled={assigning}
            >
              Cancel
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleAssignGarage} isLoading={assigning}>
              Assign garage
            </Button>
          </div>
        }
      >
        {selectedQuoteForAssign && (
          <div className="space-y-4">
            <dl className="divide-y divide-surface-200 rounded-xl border border-surface-200 px-3">
              <QuoteFact label="Quote">
                <span className="font-mono">{selectedQuoteForAssign.quoteNumber}</span>
              </QuoteFact>
              <QuoteFact label="Garage total">{formatINR(selectedQuoteForAssign.grandTotal)}</QuoteFact>
              <QuoteFact label="Time needed">
                {formatDuration(selectedQuoteForAssign.estimatedDurationDays, selectedQuoteForAssign.estimatedDurationHours)}
              </QuoteFact>
              <QuoteFact label="Valid until">{formatDate(selectedQuoteForAssign.validUntil)}</QuoteFact>
            </dl>
            <Textarea
              label="Reason (optional)"
              value={assignmentReason}
              onChange={(e) => setAssignmentReason(e.target.value)}
              placeholder="For example: best price and can start tomorrow"
              rows={3}
            />
          </div>
        )}
      </Modal>

      <ConfirmationDialog
        isOpen={!!noteToDelete}
        onClose={() => !deletingNote && setNoteToDelete(null)}
        onConfirm={handleDeleteNote}
        title="Delete this note?"
        message="This cannot be undone."
        confirmText="Delete"
        variant="danger"
        isLoading={deletingNote}
      />
    </div>
  );
}
