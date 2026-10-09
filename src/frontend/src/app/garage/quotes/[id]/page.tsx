'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { GarageQuoteDetailDto, UpdateGarageQuoteDraftRequest } from '@/types/garageQuote';
import { History, Lock, RefreshCw, Save, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { ActionBar, ActionBarSpacer } from '@/components/ui/ActionBar';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { formatDate, formatDateTime, formatINR } from '@/lib/format';
import {
  LineItemsEditor,
  LineItemsList,
  LocalLineItem,
  TotalsSummary,
  TotalSummaryLabel,
  calcTotals,
  newLineItem,
} from '../_components/LineItems';

function describeDuration(days?: number | null, hours?: number | null) {
  const parts: string[] = [];
  if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (hours) parts.push(`${hours} h of work`);
  return parts.length ? parts.join(' · ') : 'Not given';
}

export default function GarageQuoteDetailPage() {
  const params = useParams();
  const toast = useToast();
  const quoteId = params.id as string;

  const [quote, setQuote] = useState<GarageQuoteDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Edit state (drafts only)
  const [isEditing, setIsEditing] = useState(false);
  const [estimatedHours, setEstimatedHours] = useState<number | ''>('');
  const [estimatedDays, setEstimatedDays] = useState<number | ''>('');
  const [validUntil, setValidUntil] = useState<string>('');
  const [garageRemarks, setGarageRemarks] = useState('');
  const [lineItems, setLineItems] = useState<LocalLineItem[]>([]);

  // Dialogs
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmRevision, setConfirmRevision] = useState(false);

  useEffect(() => {
    loadQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  async function loadQuote() {
    setLoading(true);
    setLoadError(null);
    const res = await apiFetch<GarageQuoteDetailDto>(`/garage/quotes/${quoteId}`);
    if (res.success && res.data) {
      setQuote(res.data);
      populateEditForm(res.data);
    } else {
      setLoadError(res.message || 'Could not load this quote.');
    }
    setLoading(false);
  }

  function populateEditForm(q: GarageQuoteDetailDto) {
    setEstimatedHours(q.estimatedCompletionHours ?? '');
    setEstimatedDays(q.estimatedCompletionDays ?? '');
    setValidUntil(q.validUntil ? q.validUntil.slice(0, 10) : '');
    setGarageRemarks(q.garageRemarks || '');
    setLineItems(
      q.lineItems.map((li) => ({
        id: li.id,
        lineType: li.lineType,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        taxRate: li.taxRate,
        discountAmount: li.discountAmount,
      }))
    );
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, newLineItem()]);
  }

  function updateLineItem(id: string, updates: Partial<LocalLineItem>) {
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }

  function removeLineItem(id: string) {
    setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item.id !== id)));
  }

  const editTotals = calcTotals(lineItems);

  async function handleUpdateDraft() {
    setActionLoading(true);

    const payload: UpdateGarageQuoteDraftRequest = {
      currency: quote?.currency || 'INR',
      estimatedCompletionHours: estimatedHours !== '' ? Number(estimatedHours) : null,
      estimatedCompletionDays: estimatedDays !== '' ? Number(estimatedDays) : null,
      validUntil: validUntil ? new Date(validUntil + 'T23:59:59Z').toISOString() : null,
      garageRemarks: garageRemarks.trim() || null,
      lineItems: lineItems.map((item, index) => ({
        lineType: item.lineType,
        description: item.description.trim(),
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate) || 0,
        discountAmount: Number(item.discountAmount) || 0,
        sortOrder: index + 1,
      })),
    };

    const res = await apiFetch<GarageQuoteDetailDto>(`/garage/quotes/${quoteId}/draft`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    if (res.success && res.data) {
      setQuote(res.data);
      populateEditForm(res.data);
      setIsEditing(false);
      toast.success('Draft saved');
    } else {
      toast.error('Draft not saved', res.message || 'Please try again.');
    }
    setActionLoading(false);
  }

  async function handleSubmitQuote() {
    setActionLoading(true);

    const res = await apiFetch<GarageQuoteDetailDto>(`/garage/quotes/${quoteId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ idempotencyKey: `idemp-submit-${Date.now()}` }),
    });

    if (res.success && res.data) {
      setQuote(res.data);
      populateEditForm(res.data);
      setIsEditing(false);
      toast.success('Quote submitted', 'The advisor will review it.');
    } else {
      toast.error('Quote not submitted', res.message || 'Please try again.');
    }
    setConfirmSubmit(false);
    setActionLoading(false);
  }

  async function handleCreateRevision() {
    setActionLoading(true);

    const res = await apiFetch<GarageQuoteDetailDto>(`/garage/quotes/${quoteId}/revision`, {
      method: 'POST',
    });

    if (res.success && res.data) {
      setQuote(res.data);
      populateEditForm(res.data);
      setIsEditing(true);
      toast.success(`Version ${res.data.versionNumber} created`, 'Make your changes, save, then submit again.');
    } else {
      toast.error('Could not start a new version', res.message || 'Please try again.');
    }
    setConfirmRevision(false);
    setActionLoading(false);
  }

  async function handleWithdrawQuote() {
    if (!withdrawReason.trim()) return;

    setActionLoading(true);

    const res = await apiFetch<GarageQuoteDetailDto>(`/garage/quotes/${quoteId}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ reason: withdrawReason.trim() }),
    });

    if (res.success && res.data) {
      setQuote(res.data);
      setShowWithdrawModal(false);
      setWithdrawReason('');
      toast.success('Quote withdrawn');
    } else {
      toast.error('Quote not withdrawn', res.message || 'Please try again.');
    }
    setActionLoading(false);
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Quote" backHref="/garage/quotes" backLabel="Quotes" />
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div>
        <PageHeader title="Quote" backHref="/garage/quotes" backLabel="Quotes" />
        <ErrorState title="Couldn’t load this quote" error={loadError} onRetry={loadQuote} />
      </div>
    );
  }

  const isDraft = quote.status === 'Draft';
  const isSubmittedOrUnderReview = quote.status === 'Submitted' || quote.status === 'UnderReview';
  const hasActionBar = isDraft || isSubmittedOrUnderReview;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        backHref="/garage/quotes"
        backLabel="Quotes"
        eyebrow={
          <>
            <StatusBadge status={quote.status} />
            <span className="text-xs font-medium text-navy-500">Version {quote.versionNumber}</span>
          </>
        }
        title={quote.vehicleSummary || quote.quoteNumber}
        description={`Quote ${quote.quoteNumber} · Request ${quote.serviceRequestNumber}`}
      />

      <div className="space-y-5 sm:space-y-6">
        {/* Terms */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-navy-900">{isEditing ? 'Timing and notes' : 'Details'}</h2>
          {isEditing ? (
            <div className="space-y-4 rounded-2xl border border-surface-200 bg-white p-4 shadow-card sm:p-5">
              <Input
                id="quote-valid-until"
                type="date"
                label="Quote valid until"
                required
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                disabled={actionLoading}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  id="quote-hours"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  label="Work time (hours)"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={actionLoading}
                />
                <Input
                  id="quote-days"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  label="Ready in (days)"
                  value={estimatedDays}
                  onChange={(e) => setEstimatedDays(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={actionLoading}
                />
              </div>
              <Textarea
                id="quote-remarks"
                label="Notes for the advisor"
                rows={3}
                value={garageRemarks}
                onChange={(e) => setGarageRemarks(e.target.value)}
                disabled={actionLoading}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-card sm:p-5">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-navy-500">Valid until</dt>
                  <dd className="font-medium text-navy-900">{formatDate(quote.validUntil)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-navy-500">Estimated time</dt>
                  <dd className="font-medium text-navy-900">
                    {describeDuration(quote.estimatedCompletionDays, quote.estimatedCompletionHours)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-navy-500">Created</dt>
                  <dd className="font-medium text-navy-900">{formatDate(quote.createdAtUtc)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-navy-500">Submitted</dt>
                  <dd className="font-medium text-navy-900">
                    {quote.submittedAtUtc ? formatDateTime(quote.submittedAtUtc) : 'Not yet'}
                  </dd>
                </div>
              </dl>

              {quote.garageRemarks && (
                <div className="mt-4 border-t border-surface-200 pt-3">
                  <div className="text-xs text-navy-500">Notes for the advisor</div>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-navy-800">{quote.garageRemarks}</p>
                </div>
              )}

              {quote.withdrawalReason && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
                  <div className="text-xs font-medium text-red-700">
                    Withdrawn{quote.withdrawnAtUtc ? ` on ${formatDate(quote.withdrawnAtUtc)}` : ''}
                  </div>
                  <p className="mt-0.5 text-sm text-red-900">{quote.withdrawalReason}</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Items */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-navy-900">Items</h2>
          {isEditing ? (
            <LineItemsEditor
              items={lineItems}
              onChange={updateLineItem}
              onAdd={addLineItem}
              onRemove={removeLineItem}
              disabled={actionLoading}
            />
          ) : (
            <LineItemsList items={quote.lineItems} />
          )}
          {isEditing ? (
            <TotalsSummary
              subtotal={editTotals.subtotal}
              discount={editTotals.discount}
              tax={editTotals.tax}
              total={editTotals.total}
            />
          ) : (
            <TotalsSummary
              subtotal={quote.subtotal}
              discount={quote.discountAmount}
              tax={quote.taxAmount}
              total={quote.totalAmount}
            />
          )}
          <p className="flex items-start gap-2 px-1 text-xs text-navy-500">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Your item prices are shared only with BroCo Mod advisors, never with customers or other garages.
          </p>
        </section>

        {/* Version history */}
        {quote.versions && quote.versions.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-navy-900">
              <History className="h-4 w-4 text-navy-400" />
              Earlier versions
            </h2>
            <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-card divide-y divide-surface-200/80">
              {quote.versions.map((ver) => (
                <div key={ver.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold text-navy-900">Version {ver.versionNumber}</div>
                      <div className="mt-0.5 text-xs text-navy-500">
                        Submitted {formatDateTime(ver.submittedAtUtc)} · {ver.lineItems ? ver.lineItems.length : 0} items
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold tabular-nums text-navy-900">
                      {formatINR(ver.totalAmount)}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-navy-500">
                    Subtotal {formatINR(ver.subtotal)} · Discounts {formatINR(ver.discountAmount)} · GST{' '}
                    {formatINR(ver.taxAmount)}
                  </div>
                  {ver.garageRemarks && (
                    <p className="mt-1 text-sm text-navy-600 break-words">“{ver.garageRemarks}”</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Primary actions */}
      {hasActionBar && (
        <>
          {isDraft && !isEditing && (
            <ActionBar summary={<TotalSummaryLabel total={quote.totalAmount} label="Quote total" />}>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
              <Button onClick={() => setConfirmSubmit(true)} disabled={actionLoading}>
                Submit
              </Button>
            </ActionBar>
          )}

          {isDraft && isEditing && (
            <ActionBar summary={<TotalSummaryLabel total={editTotals.total} label="New total" />}>
              <Button
                variant="ghost"
                disabled={actionLoading}
                onClick={() => {
                  populateEditForm(quote);
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateDraft} isLoading={actionLoading} leftIcon={<Save className="h-4 w-4" />}>
                Save
              </Button>
            </ActionBar>
          )}

          {isSubmittedOrUnderReview && (
            <ActionBar>
              <Button
                variant="outline"
                onClick={() => setShowWithdrawModal(true)}
                disabled={actionLoading}
                leftIcon={<XCircle className="h-4 w-4" />}
                className="!text-red-700"
              >
                Withdraw
              </Button>
              <Button
                onClick={() => setConfirmRevision(true)}
                disabled={actionLoading}
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                Revise quote
              </Button>
            </ActionBar>
          )}
          <ActionBarSpacer />
        </>
      )}

      <ConfirmationDialog
        isOpen={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        onConfirm={handleSubmitQuote}
        title="Submit this quote?"
        message={`The advisor will review it. You can't edit it after submitting, but you can create a new version. Total ${formatINR(quote.totalAmount)}.`}
        confirmText="Submit quote"
        isLoading={actionLoading}
      />

      <ConfirmationDialog
        isOpen={confirmRevision}
        onClose={() => setConfirmRevision(false)}
        onConfirm={handleCreateRevision}
        title={`Create version ${quote.versionNumber + 1}?`}
        message="A new draft opens for you to change and submit again. The current version is kept in the history."
        confirmText="Create version"
        isLoading={actionLoading}
      />

      <Modal
        isOpen={showWithdrawModal}
        onClose={() => {
          setShowWithdrawModal(false);
          setWithdrawReason('');
        }}
        title="Withdraw quote"
        description="Tell the advisor why, e.g. parts not available or the workshop is full."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={actionLoading}
              onClick={() => {
                setShowWithdrawModal(false);
                setWithdrawReason('');
              }}
            >
              Keep quote
            </Button>
            <Button
              variant="danger"
              className="w-full sm:w-auto"
              onClick={handleWithdrawQuote}
              isLoading={actionLoading}
              disabled={!withdrawReason.trim()}
            >
              Withdraw quote
            </Button>
          </div>
        }
      >
        <Textarea
          id="withdraw-reason"
          label="Reason"
          required
          rows={3}
          value={withdrawReason}
          onChange={(e) => setWithdrawReason(e.target.value)}
          placeholder="Why are you withdrawing?"
        />
      </Modal>
    </div>
  );
}
