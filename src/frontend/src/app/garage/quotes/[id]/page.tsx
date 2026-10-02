'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  GarageQuoteDetailDto,
  GarageQuoteLineItemDto,
  UpdateGarageQuoteDraftRequest,
  QuoteLineType,
} from '@/types/garageQuote';
import {
  ArrowLeft,
  FileSpreadsheet,
  ShieldAlert,
  Send,
  Save,
  Clock,
  Calendar,
  AlertCircle,
  Plus,
  Trash2,
  RefreshCw,
  XCircle,
  CheckCircle2,
  History,
  FileText,
} from 'lucide-react';

interface LocalLineItem {
  id: string;
  lineType: QuoteLineType;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountAmount: number;
}

export default function GarageQuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.id as string;

  const [quote, setQuote] = useState<GarageQuoteDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit State (for Drafts)
  const [isEditing, setIsEditing] = useState(false);
  const [estimatedHours, setEstimatedHours] = useState<number | ''>('');
  const [estimatedDays, setEstimatedDays] = useState<number | ''>('');
  const [validUntil, setValidUntil] = useState<string>('');
  const [garageRemarks, setGarageRemarks] = useState('');
  const [lineItems, setLineItems] = useState<LocalLineItem[]>([]);

  // Withdraw Modal State
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');

  useEffect(() => {
    loadQuote();
  }, [quoteId]);

  async function loadQuote() {
    setLoading(true);
    const res = await apiFetch<GarageQuoteDetailDto>(`/garage/quotes/${quoteId}`);
    if (res.success && res.data) {
      setQuote(res.data);
      populateEditForm(res.data);
    } else {
      setErrorMsg(res.message || 'Failed to load quotation.');
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
    setLineItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        lineType: 'Labour',
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxRate: 18,
        discountAmount: 0,
      },
    ]);
  }

  function updateLineItem(id: string, updates: Partial<LocalLineItem>) {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }

  function removeLineItem(id: string) {
    if (lineItems.length <= 1) {
      alert('At least one line item is required.');
      return;
    }
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  }

  // Real-time calculations for editing mode
  const calculations = lineItems.map((item) => {
    const gross = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
    const discount = Number(item.discountAmount) || 0;
    const taxable = Math.max(0, gross - discount);
    const tax = taxable * ((Number(item.taxRate) || 0) / 100);
    const lineTotal = taxable + tax;
    return { gross, discount, taxable, tax, lineTotal };
  });

  const subtotalSum = calculations.reduce((acc, c) => acc + c.gross, 0);
  const discountSum = calculations.reduce((acc, c) => acc + c.discount, 0);
  const taxSum = calculations.reduce((acc, c) => acc + c.tax, 0);
  const totalAmount = subtotalSum - discountSum + taxSum;

  async function handleUpdateDraft() {
    setErrorMsg(null);
    setSuccessMsg(null);
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
      setSuccessMsg('Quotation draft updated successfully.');
    } else {
      setErrorMsg(res.message || 'Failed to update draft.');
    }
    setActionLoading(false);
  }

  async function handleSubmitQuote() {
    if (!confirm('Are you sure you want to submit this quotation? It will be locked for review by BroCo Mod Advisors.')) {
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(true);

    const res = await apiFetch<GarageQuoteDetailDto>(`/garage/quotes/${quoteId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ idempotencyKey: `idemp-submit-${Date.now()}` }),
    });

    if (res.success && res.data) {
      setQuote(res.data);
      populateEditForm(res.data);
      setIsEditing(false);
      setSuccessMsg('Quotation submitted successfully to Technical Advisors.');
    } else {
      setErrorMsg(res.message || 'Failed to submit quote.');
    }
    setActionLoading(false);
  }

  async function handleCreateRevision() {
    if (!confirm('Create a new revision? This will create version ' + ((quote?.versionNumber || 1) + 1) + ' in draft mode while preserving historical snapshots.')) {
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(true);

    const res = await apiFetch<GarageQuoteDetailDto>(`/garage/quotes/${quoteId}/revision`, {
      method: 'POST',
    });

    if (res.success && res.data) {
      setQuote(res.data);
      populateEditForm(res.data);
      setIsEditing(true);
      setSuccessMsg(`Revision v${res.data.versionNumber} created. You can now edit and re-submit.`);
    } else {
      setErrorMsg(res.message || 'Failed to create revision.');
    }
    setActionLoading(false);
  }

  async function handleWithdrawQuote() {
    if (!withdrawReason.trim()) {
      alert('Withdrawal reason is required.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(true);

    const res = await apiFetch<GarageQuoteDetailDto>(`/garage/quotes/${quoteId}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ reason: withdrawReason.trim() }),
    });

    if (res.success && res.data) {
      setQuote(res.data);
      setShowWithdrawModal(false);
      setWithdrawReason('');
      setSuccessMsg('Quotation has been withdrawn.');
    } else {
      setErrorMsg(res.message || 'Failed to withdraw quotation.');
    }
    setActionLoading(false);
  }

  function getStatusBadge(status: string) {
    switch (status.toUpperCase()) {
      case 'DRAFT':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'SUBMITTED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'UNDERREVIEW':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'SELECTEDBYADVISOR':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'REJECTEDBYADVISOR':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'WITHDRAWN':
        return 'bg-zinc-100 text-zinc-700 border-zinc-300';
      case 'EXPIRED':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-surface-100 text-navy-700 border-surface-200';
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-navy-600">Loading quotation details...</div>;
  }

  if (!quote) {
    return (
      <div className="py-16 text-center space-y-3">
        <h2 className="text-lg font-bold text-navy-900">Quotation Not Found</h2>
        <Link href="/garage/quotes" className="text-xs text-amber-600 font-bold hover:underline">
          Return to Quotations List
        </Link>
      </div>
    );
  }

  const isDraft = quote.status === 'Draft';
  const isSubmittedOrUnderReview = quote.status === 'Submitted' || quote.status === 'UnderReview';

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/garage/quotes"
            className="p-2 rounded-xl border border-surface-200 hover:bg-surface-100 transition"
          >
            <ArrowLeft className="w-4 h-4 text-navy-600" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-navy-900 font-mono">{quote.quoteNumber}</h1>
              <span className="font-mono text-xs font-bold text-navy-600 bg-surface-100 px-2 py-0.5 rounded-lg border border-surface-200">
                Version {quote.versionNumber}
              </span>
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getStatusBadge(
                  quote.status
                )}`}
              >
                {quote.status}
              </span>
            </div>
            <p className="text-xs text-navy-600 mt-1">
              Service Request:{' '}
              <strong className="text-navy-900 font-mono">{quote.serviceRequestNumber}</strong> • {quote.vehicleSummary}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isDraft && !isEditing && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 border border-surface-300 bg-white hover:bg-surface-50 text-navy-800 rounded-xl text-xs font-bold transition shadow-sm"
              >
                Edit Draft
              </button>
              <button
                onClick={handleSubmitQuote}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" /> Submit to Advisor
              </button>
            </>
          )}

          {isDraft && isEditing && (
            <>
              <button
                onClick={() => {
                  populateEditForm(quote);
                  setIsEditing(false);
                }}
                className="px-3.5 py-2 text-navy-600 hover:text-navy-800 text-xs font-bold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateDraft}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> Save Changes
              </button>
            </>
          )}

          {isSubmittedOrUnderReview && (
            <>
              <button
                onClick={handleCreateRevision}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Create Revision (v{quote.versionNumber + 1})
              </button>
              <button
                onClick={() => setShowWithdrawModal(true)}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3.5 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" /> Withdraw
              </button>
            </>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Confidential Warning */}
      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="block mb-0.5 font-bold">Confidential Commercial Pricing Guarantee:</strong>
          These line items and workshop pricing values are strictly confidential. Customers will never see your workshop unit prices, labor margins, or discount structures.
        </div>
      </div>

      {/* Terms & Metadata Card */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-bold text-navy-900 border-b border-surface-100 pb-3">
          General Quotation Terms
        </h2>

        {isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-navy-500 uppercase mb-1">
                  Valid Until Date *
                </label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full text-xs border border-surface-200 rounded-xl px-3 py-2 text-navy-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-navy-500 uppercase mb-1">
                  Completion Hours
                </label>
                <input
                  type="number"
                  min="1"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full text-xs border border-surface-200 rounded-xl px-3 py-2 text-navy-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-navy-500 uppercase mb-1">
                  Completion Days
                </label>
                <input
                  type="number"
                  min="1"
                  value={estimatedDays}
                  onChange={(e) => setEstimatedDays(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full text-xs border border-surface-200 rounded-xl px-3 py-2 text-navy-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-navy-500 uppercase mb-1">
                Garage Remarks
              </label>
              <textarea
                rows={2}
                value={garageRemarks}
                onChange={(e) => setGarageRemarks(e.target.value)}
                className="w-full text-xs border border-surface-200 rounded-xl p-3 text-navy-900"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[10px] font-bold text-navy-400 uppercase block">Validity Date</span>
              <span className="font-semibold text-navy-900">
                {new Date(quote.validUntil).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-navy-400 uppercase block">Estimated Duration</span>
              <span className="font-semibold text-navy-900">
                {quote.estimatedCompletionDays ? `${quote.estimatedCompletionDays} Days` : ''}{' '}
                {quote.estimatedCompletionHours ? `(${quote.estimatedCompletionHours} Hours)` : ''}
                {!quote.estimatedCompletionDays && !quote.estimatedCompletionHours && 'Standard'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-navy-400 uppercase block">Submitted At</span>
              <span className="font-semibold text-navy-900">
                {quote.submittedAtUtc ? new Date(quote.submittedAtUtc).toLocaleString() : 'Draft'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-navy-400 uppercase block">Status</span>
              <span className="font-semibold text-navy-900">{quote.status}</span>
            </div>

            {quote.garageRemarks && (
              <div className="col-span-2 sm:col-span-4 bg-surface-50 p-3 rounded-xl border border-surface-200">
                <span className="text-[10px] font-bold text-navy-400 uppercase block mb-1">
                  Workshop Remarks / Diagnostic Notes
                </span>
                <p className="text-navy-700 whitespace-pre-wrap">{quote.garageRemarks}</p>
              </div>
            )}

            {quote.withdrawalReason && (
              <div className="col-span-2 sm:col-span-4 bg-red-50 p-3 rounded-xl border border-red-200 text-red-900">
                <span className="text-[10px] font-bold text-red-600 uppercase block mb-1">
                  Withdrawal Reason
                </span>
                <p>{quote.withdrawalReason}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Line Items Card */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-surface-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-navy-900">Line Items Breakdown</h2>
            <p className="text-[11px] text-navy-500">
              Detailed cost components for parts, labor, and services.
            </p>
          </div>

          {isEditing && (
            <button
              type="button"
              onClick={addLineItem}
              className="flex items-center gap-1 px-3 py-1.5 bg-surface-100 hover:bg-surface-200 text-navy-800 rounded-xl text-xs font-bold transition"
            >
              <Plus className="w-3.5 h-3.5 text-navy-600" /> Add Line Item
            </button>
          )}
        </div>

        {/* Line Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-200 text-[10px] font-bold uppercase text-navy-500 tracking-wider">
                <th className="py-2 px-2 w-28">Type</th>
                <th className="py-2 px-2">Description</th>
                <th className="py-2 px-2 w-20">Qty</th>
                <th className="py-2 px-2 w-28">Unit Price</th>
                <th className="py-2 px-2 w-20">GST (%)</th>
                <th className="py-2 px-2 w-24">Disc</th>
                <th className="py-2 px-2 w-28 text-right">Line Total</th>
                {isEditing && <th className="py-2 px-1 w-10 text-center"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {isEditing
                ? lineItems.map((item, idx) => {
                    const calc = calculations[idx];
                    return (
                      <tr key={item.id} className="hover:bg-surface-50/50 transition">
                        <td className="py-2 px-2">
                          <select
                            value={item.lineType}
                            onChange={(e) =>
                              updateLineItem(item.id, { lineType: e.target.value as QuoteLineType })
                            }
                            className="w-full border border-surface-200 rounded-lg p-1.5 text-xs text-navy-900 bg-white"
                          >
                            <option value="Labour">Labour</option>
                            <option value="Part">Part</option>
                            <option value="Service">Service</option>
                            <option value="Other">Other</option>
                          </select>
                        </td>

                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                            placeholder="Description"
                            className="w-full border border-surface-200 rounded-lg p-1.5 text-xs text-navy-900"
                          />
                        </td>

                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="0.1"
                            step="0.5"
                            value={item.quantity}
                            onChange={(e) =>
                              updateLineItem(item.id, { quantity: Number(e.target.value) || 0 })
                            }
                            className="w-full border border-surface-200 rounded-lg p-1.5 text-xs text-navy-900"
                          />
                        </td>

                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateLineItem(item.id, { unitPrice: Number(e.target.value) || 0 })
                            }
                            className="w-full border border-surface-200 rounded-lg p-1.5 text-xs text-navy-900 font-mono"
                          />
                        </td>

                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.taxRate}
                            onChange={(e) =>
                              updateLineItem(item.id, { taxRate: Number(e.target.value) || 0 })
                            }
                            className="w-full border border-surface-200 rounded-lg p-1.5 text-xs text-navy-900"
                          />
                        </td>

                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="0"
                            value={item.discountAmount}
                            onChange={(e) =>
                              updateLineItem(item.id, { discountAmount: Number(e.target.value) || 0 })
                            }
                            className="w-full border border-surface-200 rounded-lg p-1.5 text-xs text-navy-900 font-mono"
                          />
                        </td>

                        <td className="py-2 px-2 text-right font-mono font-bold text-navy-900">
                          ₹{calc.lineTotal.toFixed(2)}
                        </td>

                        <td className="py-2 px-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeLineItem(item.id)}
                            className="p-1 hover:text-red-600 text-navy-400 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                : quote.lineItems.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-50/50 transition">
                      <td className="py-2.5 px-2">
                        <span className="font-semibold text-navy-800 bg-surface-100 px-2 py-0.5 rounded text-[10px]">
                          {item.lineType}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 font-medium text-navy-900">{item.description}</td>
                      <td className="py-2.5 px-2 text-navy-700">{item.quantity}</td>
                      <td className="py-2.5 px-2 font-mono text-navy-700">₹{item.unitPrice.toFixed(2)}</td>
                      <td className="py-2.5 px-2 text-navy-700">{item.taxRate}%</td>
                      <td className="py-2.5 px-2 font-mono text-emerald-700">
                        {item.discountAmount > 0 ? `- ₹${item.discountAmount.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-navy-900">
                        ₹{item.lineTotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div className="pt-4 border-t border-surface-200 flex flex-col items-end">
          <div className="w-full max-w-xs space-y-2 text-xs">
            <div className="flex justify-between text-navy-600">
              <span>Gross Subtotal:</span>
              <span className="font-mono">
                ₹{(isEditing ? subtotalSum : quote.subtotal).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Discounts:</span>
              <span className="font-mono">
                - ₹{(isEditing ? discountSum : quote.discountAmount).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-navy-600">
              <span>Tax (GST):</span>
              <span className="font-mono">
                + ₹{(isEditing ? taxSum : quote.taxAmount).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-base font-bold text-navy-900 pt-2 border-t border-surface-200">
              <span>Grand Total:</span>
              <span className="font-mono text-xl text-amber-600">
                ₹{(isEditing ? totalAmount : quote.totalAmount).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Version History Card */}
      {quote.versions && quote.versions.length > 0 && (
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-surface-100 pb-3">
            <History className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-bold text-navy-900">Immutable Version Snapshots</h2>
          </div>

          <div className="space-y-3">
            {quote.versions.map((ver) => (
              <div
                key={ver.id}
                className="p-4 bg-surface-50 rounded-xl border border-surface-200 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-purple-900 bg-purple-100 px-2 py-0.5 rounded-lg font-mono">
                      Snapshot v{ver.versionNumber}
                    </span>
                    <span className="text-navy-500">
                      Submitted on {new Date(ver.submittedAtUtc).toLocaleString()}
                    </span>
                  </div>

                  <div className="font-mono font-bold text-navy-900">
                    Total: ₹{ver.totalAmount.toFixed(2)}
                  </div>
                </div>

                {ver.garageRemarks && (
                  <p className="text-navy-600 italic">&ldquo;{ver.garageRemarks}&rdquo;</p>
                )}

                <div className="pt-2 flex items-center justify-between text-[11px] text-navy-500">
                  <span>Subtotal: ₹{ver.subtotal.toFixed(2)}</span>
                  <span>Discounts: ₹{ver.discountAmount.toFixed(2)}</span>
                  <span>Tax: ₹{ver.taxAmount.toFixed(2)}</span>
                  <span>Items: {ver.lineItems ? ver.lineItems.length : 0} items</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-navy-900">Withdraw Quotation</h3>
            <p className="text-xs text-navy-600">
              Please state why your workshop is withdrawing this quotation (e.g. parts unavailable, workshop at full capacity).
            </p>

            <textarea
              rows={3}
              value={withdrawReason}
              onChange={(e) => setWithdrawReason(e.target.value)}
              placeholder="Withdrawal reason (required)..."
              className="w-full text-xs border border-surface-200 rounded-xl p-3 text-navy-900 focus:outline-none focus:border-red-500"
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-surface-100">
              <button
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawReason('');
                }}
                className="px-4 py-2 text-xs font-bold text-navy-600 hover:text-navy-800"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdrawQuote}
                disabled={actionLoading || !withdrawReason.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
              >
                Confirm Withdrawal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
