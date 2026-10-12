'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { CreateGarageQuoteRequest, GarageQuoteDetailDto } from '@/types/garageQuote';
import { Lock } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ActionBar, ActionBarSpacer } from '@/components/ui/ActionBar';
import { LoadingState } from '@/components/ui/LoadingState';
import { useToast } from '@/components/ui/Toast';
import {
  LineItemsEditor,
  LocalLineItem,
  TotalsSummary,
  TotalSummaryLabel,
  calcTotals,
  newLineItem,
} from '../_components/LineItems';

function NewQuoteForm() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const garageRequestId = searchParams.get('requestId') || '';

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quote terms
  const [currency] = useState('INR');
  const [estimatedHours, setEstimatedHours] = useState<number | ''>('');
  const [estimatedDays, setEstimatedDays] = useState<number | ''>('');
  const [validUntil, setValidUntil] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [garageRemarks, setGarageRemarks] = useState('');

  // Line items start with one empty row; the mechanic fills in real prices.
  const [lineItems, setLineItems] = useState<LocalLineItem[]>(() => [newLineItem()]);

  function addLineItem() {
    setLineItems((prev) => [...prev, newLineItem()]);
  }

  function updateLineItem(id: string, updates: Partial<LocalLineItem>) {
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }

  function removeLineItem(id: string) {
    setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item.id !== id)));
  }

  const totals = calcTotals(lineItems);
  const busy = saving || submitting;

  function fail(message: string) {
    setErrorMsg(message);
    toast.error('Quote not saved', message);
  }

  async function handleSave(submitImmediately = false) {
    setErrorMsg(null);

    if (!garageRequestId) {
      fail('Open this screen from a request to quote on it.');
      return;
    }

    if (lineItems.length === 0) {
      fail('Add at least one item.');
      return;
    }

    for (const item of lineItems) {
      if (!item.description.trim()) {
        fail('Every item needs a description.');
        return;
      }
      if (item.quantity <= 0) {
        fail('Quantity must be more than zero.');
        return;
      }
      if (item.unitPrice < 0) {
        fail('Unit price cannot be negative.');
        return;
      }
    }

    const payload: CreateGarageQuoteRequest = {
      garageRequestId,
      currency,
      estimatedCompletionHours: estimatedHours !== '' ? Number(estimatedHours) : null,
      estimatedCompletionDays: estimatedDays !== '' ? Number(estimatedDays) : null,
      validUntil: new Date(validUntil + 'T23:59:59Z').toISOString(),
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

    if (submitImmediately) {
      setSubmitting(true);
    } else {
      setSaving(true);
    }

    try {
      const res = await apiFetch<GarageQuoteDetailDto>('/garage/quotes/draft', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.success || !res.data) {
        fail(res.message || 'Could not save the quote. Please try again.');
        setSaving(false);
        setSubmitting(false);
        return;
      }

      const quoteId = res.data.id;

      if (submitImmediately) {
        const submitRes = await apiFetch<GarageQuoteDetailDto>(`/garage/quotes/${quoteId}/submit`, {
          method: 'POST',
          body: JSON.stringify({ idempotencyKey: `idemp-create-${Date.now()}` }),
        });

        if (!submitRes.success) {
          toast.warning('Saved as draft, but not submitted', submitRes.message || 'Open the draft and try submitting again.');
          setSubmitting(false);
          router.push(`/garage/quotes/${quoteId}`);
          return;
        }
        toast.success('Quote submitted', 'The advisor will review it.');
      } else {
        toast.success('Draft saved');
      }

      router.push(`/garage/quotes/${quoteId}`);
    } catch (err: any) {
      fail(err?.message || 'Something unexpected happened. Please try again.');
      setSaving(false);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New quote"
        description="List the labour and parts for this job. The total updates as you type."
        backHref="/garage/requests"
        backLabel="Requests"
      />

      <div className="space-y-5 sm:space-y-6">
        {!garageRequestId && (
          <Alert type="warning" title="No request selected">
            Quotes are created from a customer request.{' '}
            <Link href="/garage/requests" className="font-semibold underline">
              Pick a request
            </Link>{' '}
            and tap “Create quote”.
          </Alert>
        )}

        {errorMsg && (
          <Alert type="error" onClose={() => setErrorMsg(null)}>
            {errorMsg}
          </Alert>
        )}

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-navy-900">Items</h2>
          <LineItemsEditor
            items={lineItems}
            onChange={updateLineItem}
            onAdd={addLineItem}
            onRemove={removeLineItem}
            disabled={busy}
          />
          <TotalsSummary subtotal={totals.subtotal} discount={totals.discount} tax={totals.tax} total={totals.total} />
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-navy-900">Timing and notes</h2>
          <div className="space-y-4 rounded-2xl border border-surface-200 bg-white p-4 shadow-card sm:p-5">
            <Input
              id="quote-valid-until"
              type="date"
              label="Quote valid until"
              required
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              helperText="Must be a future date."
              disabled={busy}
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
                placeholder="e.g. 6"
                disabled={busy}
              />
              <Input
                id="quote-days"
                type="number"
                inputMode="numeric"
                min="1"
                label="Ready in (days)"
                value={estimatedDays}
                onChange={(e) => setEstimatedDays(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 1"
                disabled={busy}
              />
            </div>
            <Textarea
              id="quote-remarks"
              label="Notes for the advisor"
              rows={3}
              value={garageRemarks}
              onChange={(e) => setGarageRemarks(e.target.value)}
              placeholder="Diagnosis, parts brand, warranty…"
              disabled={busy}
            />
          </div>
          <p className="flex items-start gap-2 px-1 text-xs text-navy-500">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Your item prices are shared only with BroCo advisors, never with customers or other garages.
          </p>
        </section>
      </div>

      <ActionBar summary={<TotalSummaryLabel total={totals.total} label="Quote total" />}>
        <Button variant="outline" onClick={() => handleSave(false)} isLoading={saving} disabled={busy}>
          Save draft
        </Button>
        <Button
          onClick={() => handleSave(true)}
          isLoading={submitting}
          disabled={busy}
        >
          Submit
        </Button>
      </ActionBar>
      <ActionBarSpacer />
    </div>
  );
}

export default function NewGarageQuotePage() {
  return (
    <Suspense fallback={<LoadingState message="Loading quote form…" />}>
      <NewQuoteForm />
    </Suspense>
  );
}
