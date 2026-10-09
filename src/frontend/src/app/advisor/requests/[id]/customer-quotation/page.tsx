'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatDate, formatDateTime, formatINR } from '@/lib/format';
import {
  QuoteComparisonDto,
  CustomerQuotationDto,
  CustomerQuotationLineItemInputDto,
  GarageQuoteLineItemDto,
  QuoteLineType,
} from '@/types/customerQuotation';
import { AlertCircle, Lock, Plus, Save, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActionBar, ActionBarSpacer } from '@/components/ui/ActionBar';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

const LINE_TYPES: QuoteLineType[] = ['Labour', 'Part', 'Service', 'Other'];
const DEFAULT_MARKUP_PERCENT = 15;

/** The API may return the line type as its enum number (1-4); show it as a name. */
function lineTypeName(value: unknown): QuoteLineType {
  if (typeof value === 'number') return LINE_TYPES[value - 1] ?? 'Other';
  const match = LINE_TYPES.find((t) => t.toLowerCase() === String(value ?? '').toLowerCase());
  return match ?? 'Service';
}

/** Garage price per unit after the garage's own discount, before tax. */
function garageUnitNet(li: GarageQuoteLineItemDto): number {
  const qty = li.quantity || 0;
  if (qty <= 0) return li.unitPrice || 0;
  const net = typeof li.itemSubtotal === 'number' ? li.itemSubtotal : qty * (li.unitPrice || 0) - (li.discountAmount || 0);
  return Math.max(0, net) / qty;
}

let lineKeySeq = 0;
function nextKey() {
  lineKeySeq += 1;
  return `line-${lineKeySeq}`;
}

interface BuilderLine {
  key: string;
  /** Garage cost per unit for this line (advisor-only), when it came from the assigned garage's quote. */
  garageUnitCost: number | null;
  item: CustomerQuotationLineItemInputDto;
}

function lineNet(item: CustomerQuotationLineItemInputDto) {
  const gross = (item.quantity || 0) * (item.unitPrice || 0);
  return Math.max(0, gross - (item.discountAmount || 0));
}

function percent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function SummaryRow({
  label,
  value,
  strong,
  tone,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  strong?: boolean;
  tone?: 'red' | 'green';
}) {
  const toneClass = tone === 'red' ? 'text-red-600' : tone === 'green' ? 'text-emerald-700' : 'text-navy-900';
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? 'border-t border-surface-200 pt-2' : ''}`}>
      <dt className={strong ? 'text-sm font-semibold text-navy-900' : 'text-sm text-navy-500'}>{label}</dt>
      <dd className={`text-right tabular-nums ${strong ? 'text-lg font-bold' : 'text-sm font-medium'} ${toneClass}`}>
        {value}
      </dd>
    </div>
  );
}

export default function CustomerQuotationBuilderPage() {
  const params = useParams();
  const requestId = params.id as string;
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [comparison, setComparison] = useState<QuoteComparisonDto | null>(null);
  const [existingQuote, setExistingQuote] = useState<CustomerQuotationDto | null>(null);

  // Form state
  const [scopeSummary, setScopeSummary] = useState('');
  const [advisorRemarks, setAdvisorRemarks] = useState('');
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [customerDiscount, setCustomerDiscount] = useState<number>(0);
  const [lines, setLines] = useState<BuilderLine[]>([]);
  const [dirty, setDirty] = useState(false);
  const [markupInput, setMarkupInput] = useState(String(DEFAULT_MARKUP_PERCENT));
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);

  // The request body uses exactly these objects.
  const lineItems = useMemo(() => lines.map((l) => l.item), [lines]);

  const loadData = useCallback(async () => {
    setLoadError(null);

    // 1. Fetch comparison and active assignment
    const compRes = await apiFetch<QuoteComparisonDto>(`/advisor/requests/${requestId}/quotes`);
    if (!compRes.success || !compRes.data) {
      setLoadError(compRes.message || 'Failed to load request and assignment data.');
      setLoading(false);
      return;
    }
    setComparison(compRes.data);

    const assignedQuoteId = compRes.data.activeAssignment?.selectedQuoteId;
    const winningQuote = compRes.data.quotes.find((q) => q.quoteId === assignedQuoteId);
    const garageLines = winningQuote?.lineItems ?? [];
    const costForDescription = (description: string): number | null => {
      const match = garageLines.find(
        (g) => g.description.trim().toLowerCase() === description.trim().toLowerCase()
      );
      return match ? garageUnitNet(match) : null;
    };

    // 2. Fetch existing customer quotations for this service request if any
    const listRes = await apiFetch<CustomerQuotationDto[]>(`/advisor/customer-quotations?serviceRequestId=${requestId}`);
    let activeQuote: CustomerQuotationDto | null = null;
    if (listRes.success && listRes.data && listRes.data.length > 0) {
      activeQuote = listRes.data[0];
      setExistingQuote(activeQuote);
    }

    if (activeQuote) {
      setScopeSummary(activeQuote.scopeSummary || '');
      setAdvisorRemarks(activeQuote.advisorRemarks || '');
      setValidUntil(new Date(activeQuote.validUntilUtc).toISOString().split('T')[0]);
      setCustomerDiscount(activeQuote.customerDiscount || 0);
      setLines(
        activeQuote.lineItems.map((li, idx) => ({
          key: nextKey(),
          garageUnitCost: costForDescription(li.description),
          item: {
            lineType: li.lineType,
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            taxRate: li.taxRate,
            discountAmount: li.discountAmount,
            sortOrder: li.sortOrder || idx + 1,
          },
        }))
      );
    } else if (garageLines.length > 0) {
      // Start from the assigned garage's quote with the default markup on each line.
      setLines(
        garageLines.map((li, idx) => ({
          key: nextKey(),
          garageUnitCost: garageUnitNet(li),
          item: {
            lineType: (li.lineType as QuoteLineType) || 'Service',
            description: li.description,
            quantity: li.quantity,
            unitPrice: Math.round(li.unitPrice * (1 + DEFAULT_MARKUP_PERCENT / 100)),
            taxRate: li.taxRate || 18,
            discountAmount: 0,
            sortOrder: idx + 1,
          },
        }))
      );
    } else {
      // Nothing to copy from: start with one empty line for the advisor to fill in.
      setLines([
        {
          key: nextKey(),
          garageUnitCost: null,
          item: {
            lineType: 'Service',
            description: '',
            quantity: 1,
            unitPrice: 0,
            taxRate: 18,
            discountAmount: 0,
            sortOrder: 1,
          },
        },
      ]);
    }

    setDirty(false);
    setLoading(false);
  }, [requestId]);

  useEffect(() => {
    if (requestId) {
      setLoading(true);
      loadData();
    }
  }, [requestId, loadData]);

  // Live calculations (same maths as before)
  const calculatedSubtotal = lineItems.reduce((sum, item) => sum + lineNet(item), 0);
  const taxableAfterDiscount = Math.max(0, calculatedSubtotal - customerDiscount);
  const discountRatio = calculatedSubtotal > 0 ? taxableAfterDiscount / calculatedSubtotal : 1;
  const calculatedTax = lineItems.reduce((sum, item) => {
    const rawTax = (lineNet(item) * (item.taxRate || 0)) / 100;
    return sum + rawTax * discountRatio;
  }, 0);
  const calculatedTotal = taxableAfterDiscount + calculatedTax;

  // Advisor-only margin view
  const winningQuote = comparison?.quotes.find((q) => q.quoteId === comparison.activeAssignment?.selectedQuoteId);
  const garagePreTax = winningQuote ? winningQuote.grandTotal - winningQuote.taxAmount : null;
  const totalMargin = garagePreTax !== null ? taxableAfterDiscount - garagePreTax : null;
  const totalMarginPct = garagePreTax && garagePreTax > 0 && totalMargin !== null ? (totalMargin / garagePreTax) * 100 : null;
  const hasCostLines = lines.some((l) => l.garageUnitCost !== null);

  const status = existingQuote?.status;
  const editable = !existingQuote || status === 'Draft';
  const canSave = !existingQuote || status === 'Draft';
  const canMarkReady = !!existingQuote && status === 'Draft';
  const canSend = !!existingQuote && (status === 'ReadyToSend' || status === 'Draft');

  function markDirty() {
    setDirty(true);
  }

  function addLineItem() {
    setLines((prev) => [
      ...prev,
      {
        key: nextKey(),
        garageUnitCost: null,
        item: {
          lineType: 'Labour',
          description: '',
          quantity: 1,
          unitPrice: 0,
          taxRate: 18,
          discountAmount: 0,
          sortOrder: prev.length + 1,
        },
      },
    ]);
    markDirty();
  }

  function updateLineItem<K extends keyof CustomerQuotationLineItemInputDto>(
    key: string,
    field: K,
    val: CustomerQuotationLineItemInputDto[K]
  ) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, item: { ...l.item, [field]: val } } : l)));
    markDirty();
  }

  function removeLineItem(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
    markDirty();
  }

  function applyMarkupToAll() {
    const pct = parseFloat(markupInput);
    if (!Number.isFinite(pct)) {
      toast.error('Enter a margin percentage');
      return;
    }
    setLines((prev) =>
      prev.map((l) =>
        l.garageUnitCost === null
          ? l
          : { ...l, item: { ...l.item, unitPrice: Math.round(l.garageUnitCost * (1 + pct / 100)) } }
      )
    );
    markDirty();
    toast.success(`Prices set to garage cost + ${pct}%`);
  }

  /** Creates or updates the draft. Returns the saved quotation, or null when it failed. */
  async function saveDraft(silent = false): Promise<CustomerQuotationDto | null> {
    if (!scopeSummary.trim()) {
      toast.error('Add a scope summary', 'Describe the work in a line for the customer.');
      return null;
    }
    if (lineItems.length === 0) {
      toast.error('Add at least one line item');
      return null;
    }
    if (lineItems.some((li) => !li.description.trim())) {
      toast.error('Every line needs a description');
      return null;
    }

    setSaving(true);
    const validUntilIso = new Date(validUntil + 'T23:59:59Z').toISOString();
    let saved: CustomerQuotationDto | null = null;

    if (existingQuote) {
      const res = await apiFetch<CustomerQuotationDto>(`/advisor/customer-quotations/${existingQuote.id}/draft`, {
        method: 'PUT',
        body: JSON.stringify({
          scopeSummary,
          advisorRemarks,
          validUntilUtc: validUntilIso,
          customerDiscount,
          lineItems,
        }),
      });

      if (res.success && res.data) {
        saved = res.data;
        setExistingQuote(res.data);
        setDirty(false);
        if (!silent) toast.success('Draft saved');
      } else {
        toast.error('Could not save draft', res.message || 'Failed to update draft.');
      }
    } else {
      const res = await apiFetch<CustomerQuotationDto>(`/advisor/requests/${requestId}/customer-quotation`, {
        method: 'POST',
        body: JSON.stringify({
          scopeSummary,
          advisorRemarks,
          validUntilUtc: validUntilIso,
          customerDiscount,
          currency: 'INR',
          lineItems,
        }),
      });

      if (res.success && res.data) {
        saved = res.data;
        setExistingQuote(res.data);
        setDirty(false);
        if (!silent) toast.success(`Draft ${res.data.quotationNumber} created`);
      } else {
        toast.error('Could not create draft', res.message || 'Failed to create quotation draft.');
      }
    }
    setSaving(false);
    return saved;
  }

  async function handleMarkReady() {
    // Save first when there is no draft yet or there are unsaved edits, so the snapshot matches the screen.
    let quote = existingQuote;
    if (!quote || dirty) {
      quote = await saveDraft(true);
      if (!quote) return;
    }

    setSaving(true);
    const res = await apiFetch<CustomerQuotationDto>(`/advisor/customer-quotations/${quote.id}/ready`, {
      method: 'POST',
    });

    if (res.success && res.data) {
      setExistingQuote(res.data);
      toast.success('Ready to send', 'A version of this quotation was saved.');
    } else {
      toast.error('Could not mark ready', res.message || 'Failed to mark quotation ready.');
    }
    setSaving(false);
  }

  async function handleSendToCustomer() {
    let quote = existingQuote;
    if (!quote) return;
    if (dirty && quote.status === 'Draft') {
      quote = await saveDraft(true);
      if (!quote) {
        setConfirmSendOpen(false);
        return;
      }
    }

    setSaving(true);
    const res = await apiFetch<CustomerQuotationDto>(`/advisor/customer-quotations/${quote.id}/send`, {
      method: 'POST',
    });

    if (res.success && res.data) {
      setExistingQuote(res.data);
      toast.success('Quotation sent', 'The customer has been notified.');
    } else {
      toast.error('Could not send quotation', res.message || 'Failed to send customer quotation.');
    }
    setSaving(false);
    setConfirmSendOpen(false);
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-16 w-2/3 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  }

  if (loadError && !comparison) {
    return (
      <div className="space-y-5">
        <PageHeader title="Customer quotation" backHref={`/advisor/requests/${requestId}`} backLabel="Back to request" />
        <ErrorState
          title="Could not load this request"
          error={loadError}
          onRetry={() => {
            setLoading(true);
            loadData();
          }}
        />
      </div>
    );
  }

  const assignment = comparison?.activeAssignment;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        backHref={`/advisor/requests/${requestId}`}
        backLabel="Back to request"
        eyebrow={
          existingQuote ? (
            <>
              <span className="font-mono text-xs font-semibold text-navy-500">
                {existingQuote.quotationNumber} · v{existingQuote.versionNumber}
              </span>
              <StatusBadge status={existingQuote.status} />
            </>
          ) : (
            <span className="text-xs font-medium text-navy-500">New quotation</span>
          )
        }
        title="Customer quotation"
        description={[comparison?.vehicleSummary, assignment?.garageName].filter(Boolean).join(' · ')}
      />

      {!assignment && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p>
            No garage is assigned to this request yet, so there are no garage costs to work from.{' '}
            <Link href={`/advisor/requests/${requestId}`} className="font-semibold underline">
              Assign a garage first
            </Link>
            .
          </p>
        </div>
      )}

      {existingQuote && !editable && (
        <div className="rounded-2xl border border-surface-200 bg-white p-4 text-sm text-navy-700">
          {status === 'ReadyToSend'
            ? 'This quotation is locked and ready to send.'
            : existingQuote.sentAtUtc
              ? `Sent to the customer on ${formatDateTime(existingQuote.sentAtUtc)}. It can no longer be edited.`
              : 'This quotation can no longer be edited.'}
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-navy-500">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Garage costs and margins on this page are only visible to advisors. The customer sees the scope, line
        descriptions and your prices.
      </p>

      {/* Details */}
      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-navy-900">Details for the customer</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <Input
              id="scope-summary"
              label="Scope summary"
              required
              value={scopeSummary}
              disabled={!editable}
              onChange={(e) => {
                setScopeSummary(e.target.value);
                markDirty();
              }}
              placeholder="For example: Clutch replacement and gearbox check"
            />
          </div>
          <Input
            id="valid-until"
            label="Valid until"
            type="date"
            value={validUntil}
            disabled={!editable}
            onChange={(e) => {
              setValidUntil(e.target.value);
              markDirty();
            }}
          />
          <div className="md:col-span-3">
            <Textarea
              id="advisor-remarks"
              label="Remarks (optional)"
              value={advisorRemarks}
              disabled={!editable}
              onChange={(e) => {
                setAdvisorRemarks(e.target.value);
                markDirty();
              }}
              placeholder="Notes the customer should see, such as warranty or pickup details"
              rows={2}
            />
          </div>
        </div>
      </Card>

      {/* Margin helper */}
      {editable && hasCostLines && (
        <Card className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="sm:w-56">
              <Input
                id="markup-percent"
                label="Margin over garage cost (%)"
                type="number"
                inputMode="decimal"
                value={markupInput}
                onChange={(e) => setMarkupInput(e.target.value)}
              />
            </div>
            <Button variant="outline" className="w-full sm:w-auto" onClick={applyMarkupToAll}>
              Apply to all garage lines
            </Button>
          </div>
          <p className="mt-2 text-xs text-navy-500">
            Sets each customer price to the garage&apos;s price plus this margin. You can still edit any line.
          </p>
        </Card>
      )}

      {/* Line items */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-navy-900">Line items ({lines.length})</h2>
          {editable && (
            <Button variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={addLineItem}>
              Add line
            </Button>
          )}
        </div>

        {lines.length === 0 && (
          <p className="rounded-2xl border border-dashed border-surface-300 bg-white p-6 text-center text-sm text-navy-500">
            No line items. Add at least one before saving.
          </p>
        )}

        {lines.map((line, idx) => {
          const item = line.item;
          const net = lineNet(item);
          const tax = (net * (item.taxRate || 0)) / 100;
          const total = net + tax;
          const cost = line.garageUnitCost !== null ? line.garageUnitCost * (item.quantity || 0) : null;
          const margin = cost !== null ? net - cost : null;
          const marginPct = cost !== null && cost > 0 && margin !== null ? (margin / cost) * 100 : null;
          const idBase = line.key;

          return (
            <Card key={line.key} className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-navy-900">Line {idx + 1}</span>
                {editable && (
                  <button
                    type="button"
                    onClick={() => removeLineItem(line.key)}
                    className="-mr-2 flex h-10 w-10 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 hover:text-red-700"
                    aria-label={`Remove line ${idx + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-12">
                <div className="col-span-2 md:col-span-5">
                  <Input
                    id={`${idBase}-description`}
                    label="Description"
                    value={item.description}
                    disabled={!editable}
                    onChange={(e) => updateLineItem(line.key, 'description', e.target.value)}
                    placeholder="Part or work done"
                  />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <Select
                    id={`${idBase}-type`}
                    label="Type"
                    value={lineTypeName(item.lineType)}
                    disabled={!editable}
                    onChange={(e) => updateLineItem(line.key, 'lineType', e.target.value as QuoteLineType)}
                    options={LINE_TYPES.map((t) => ({ value: t, label: t }))}
                  />
                </div>
                <div className="col-span-1 md:col-span-1">
                  <Input
                    id={`${idBase}-qty`}
                    label="Qty"
                    type="number"
                    inputMode="decimal"
                    min="1"
                    value={item.quantity}
                    disabled={!editable}
                    onChange={(e) => updateLineItem(line.key, 'quantity', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <Input
                    id={`${idBase}-price`}
                    label="Customer price (₹)"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={item.unitPrice}
                    disabled={!editable}
                    onChange={(e) => updateLineItem(line.key, 'unitPrice', parseFloat(e.target.value) || 0)}
                    helperText={line.garageUnitCost !== null ? `Garage: ${formatINR(line.garageUnitCost)} each` : undefined}
                  />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <Input
                    id={`${idBase}-tax`}
                    label="Tax (%)"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={item.taxRate}
                    disabled={!editable}
                    onChange={(e) => updateLineItem(line.key, 'taxRate', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-surface-50 p-3 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-navy-500">Garage cost</dt>
                  <dd className="text-sm font-medium tabular-nums text-navy-900">
                    {cost !== null ? formatINR(cost) : <span className="text-navy-400">Not in garage quote</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-navy-500">Customer price</dt>
                  <dd className="text-sm font-medium tabular-nums text-navy-900">{formatINR(net)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-navy-500">Margin</dt>
                  <dd
                    className={`text-sm font-semibold tabular-nums ${
                      margin === null ? 'text-navy-400' : margin < 0 ? 'text-red-600' : 'text-emerald-700'
                    }`}
                  >
                    {margin === null ? '—' : `${formatINR(margin)} ${percent(marginPct)}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-navy-500">Line total incl. tax</dt>
                  <dd className="text-sm font-semibold tabular-nums text-navy-900">{formatINR(total)}</dd>
                </div>
              </dl>
            </Card>
          );
        })}

        {editable && lines.length > 0 && (
          <Button variant="outline" className="w-full" leftIcon={<Plus className="h-4 w-4" />} onClick={addLineItem}>
            Add another line
          </Button>
        )}
      </section>

      {/* Totals */}
      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-navy-900">Totals</h2>
        <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="md:max-w-xs">
            <Input
              id="customer-discount"
              label="Discount for customer (₹)"
              type="number"
              inputMode="decimal"
              min="0"
              value={customerDiscount}
              disabled={!editable}
              onChange={(e) => {
                setCustomerDiscount(parseFloat(e.target.value) || 0);
                markDirty();
              }}
            />
          </div>
          <dl className="space-y-2">
            <SummaryRow label="Subtotal" value={formatINR(calculatedSubtotal)} />
            {customerDiscount > 0 && <SummaryRow label="Discount" value={`− ${formatINR(customerDiscount)}`} tone="red" />}
            <SummaryRow label="Tax (GST)" value={formatINR(calculatedTax)} />
            <SummaryRow label="Customer pays" value={formatINR(calculatedTotal)} strong />
          </dl>
        </div>

        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-3 sm:p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
            <Lock className="h-3.5 w-3.5" />
            Advisor only
          </p>
          <dl className="mt-2 space-y-2">
            <SummaryRow
              label="Garage quote (before tax)"
              value={garagePreTax !== null ? formatINR(garagePreTax) : '—'}
            />
            <SummaryRow label="Customer price (before tax)" value={formatINR(taxableAfterDiscount)} />
            <SummaryRow
              label="Your margin"
              value={
                totalMargin !== null ? (
                  <>
                    {formatINR(totalMargin)}{' '}
                    <span className="text-sm font-semibold">{percent(totalMarginPct)}</span>
                  </>
                ) : (
                  '—'
                )
              }
              strong
              tone={totalMargin === null ? undefined : totalMargin < 0 ? 'red' : 'green'}
            />
          </dl>
          {totalMargin !== null && totalMargin < 0 && (
            <p className="mt-2 text-xs font-medium text-red-600">The customer price is below the garage&apos;s quote.</p>
          )}
        </div>
      </Card>

      {/* Version history */}
      {existingQuote && existingQuote.versions?.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h2 className="text-base font-semibold text-navy-900">Versions ({existingQuote.versions.length})</h2>
          <ul className="mt-3 divide-y divide-surface-200">
            {existingQuote.versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <div className="text-sm font-medium text-navy-900">Version {v.versionNumber}</div>
                  <div className="text-xs text-navy-500">
                    {formatDateTime(v.createdAtUtc)} · valid until {formatDate(v.validUntilUtc)}
                  </div>
                </div>
                <div className="text-sm font-semibold tabular-nums text-navy-900">{formatINR(v.customerTotal)}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(canSave || canMarkReady || canSend) && (
        <>
          <ActionBar>
            <div className="flex w-full flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-6">
              <div className="flex items-baseline justify-between gap-3 md:block">
                <div className="text-xs text-navy-500">
                  Customer pays
                  {totalMargin !== null && (
                    <span className={totalMargin < 0 ? 'text-red-600' : 'text-emerald-700'}>
                      {' '}
                      · margin {formatINR(totalMargin)}
                    </span>
                  )}
                </div>
                <div className="text-base font-bold tabular-nums text-navy-900">
                  {formatINR(calculatedTotal)}
                  {dirty && <span className="ml-2 text-xs font-medium text-amber-600">Unsaved</span>}
                </div>
              </div>
              <div className="flex gap-2">
                {canSave && (
                  <Button
                    variant="outline"
                    onClick={() => saveDraft()}
                    disabled={saving}
                    aria-label="Save draft"
                    leftIcon={<Save className="h-4 w-4" />}
                    className={canMarkReady || canSend ? 'shrink-0 px-3 sm:px-4' : 'flex-1 md:flex-none'}
                  >
                    {canMarkReady || canSend ? <span className="hidden sm:inline">Save</span> : 'Save draft'}
                  </Button>
                )}
                {canMarkReady && (
                  <Button variant="secondary" onClick={handleMarkReady} disabled={saving} className="flex-1 md:flex-none">
                    Mark ready
                  </Button>
                )}
                {canSend && (
                  <Button
                    onClick={() => setConfirmSendOpen(true)}
                    disabled={saving}
                    leftIcon={<Send className="h-4 w-4" />}
                    className="flex-1 md:flex-none"
                  >
                    Send
                  </Button>
                )}
              </div>
            </div>
          </ActionBar>
          <ActionBarSpacer />
          <div className="h-8 md:hidden" aria-hidden="true" />
        </>
      )}

      <ConfirmationDialog
        isOpen={confirmSendOpen}
        onClose={() => !saving && setConfirmSendOpen(false)}
        onConfirm={handleSendToCustomer}
        title="Send this quotation to the customer?"
        message={
          <>
            The customer will see it in their account and can accept or decline. Total{' '}
            <strong className="text-navy-900">{formatINR(calculatedTotal)}</strong>.
            {dirty && ' Your unsaved changes will be saved first.'}
          </>
        }
        confirmText="Send to customer"
        isLoading={saving}
      />
    </div>
  );
}
