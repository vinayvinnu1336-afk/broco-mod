'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  CreateGarageQuoteRequest,
  CreateQuoteLineItemRequest,
  GarageQuoteDetailDto,
  QuoteLineType,
} from '@/types/garageQuote';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  ArrowLeft,
  ShieldAlert,
  Send,
  Save,
  Clock,
  Calendar,
  AlertCircle,
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

function NewQuoteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const garageRequestId = searchParams.get('requestId') || '';

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Header Fields
  const [currency] = useState('INR');
  const [estimatedHours, setEstimatedHours] = useState<number | ''>(6);
  const [estimatedDays, setEstimatedDays] = useState<number | ''>(1);
  const [validUntil, setValidUntil] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [garageRemarks, setGarageRemarks] = useState('');

  // Line Items
  const [lineItems, setLineItems] = useState<LocalLineItem[]>([
    {
      id: '1',
      lineType: 'Labour',
      description: 'Diagnostic inspection and assessment',
      quantity: 1,
      unitPrice: 800,
      taxRate: 18,
      discountAmount: 0,
    },
    {
      id: '2',
      lineType: 'Part',
      description: 'OEM Replacement Parts',
      quantity: 1,
      unitPrice: 2500,
      taxRate: 18,
      discountAmount: 0,
    },
  ]);

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

  // Real-time calculation previews
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

  async function handleSave(submitImmediately = false) {
    setErrorMsg(null);

    if (!garageRequestId) {
      setErrorMsg('No Garage Request ID specified. Please create quote from a dispatched request.');
      return;
    }

    if (lineItems.length === 0) {
      setErrorMsg('Please add at least one line item.');
      return;
    }

    for (const item of lineItems) {
      if (!item.description.trim()) {
        setErrorMsg('All line items must have a description.');
        return;
      }
      if (item.quantity <= 0) {
        setErrorMsg('Quantity must be greater than zero.');
        return;
      }
      if (item.unitPrice < 0) {
        setErrorMsg('Unit price cannot be negative.');
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
        setErrorMsg(res.message || 'Failed to save quote draft.');
        setSaving(false);
        setSubmitting(false);
        return;
      }

      const quoteId = res.data.id;

      if (submitImmediately) {
        const submitRes = await apiFetch<GarageQuoteDetailDto>(
          `/garage/quotes/${quoteId}/submit`,
          {
            method: 'POST',
            body: JSON.stringify({ idempotencyKey: `idemp-create-${Date.now()}` }),
          }
        );

        if (!submitRes.success) {
          setErrorMsg(submitRes.message || 'Saved as draft, but submission failed.');
          setSubmitting(false);
          router.push(`/garage/quotes/${quoteId}`);
          return;
        }
      }

      router.push(`/garage/quotes/${quoteId}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
      setSaving(false);
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/garage/requests"
            className="p-2 rounded-xl border border-surface-200 hover:bg-surface-100 transition"
          >
            <ArrowLeft className="w-4 h-4 text-navy-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-navy-900">Commercial Quotation Builder</h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Draft formal workshop proposal with itemized labor, parts, and taxes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSave(false)}
            disabled={saving || submitting}
            className="flex items-center gap-1.5 px-4 py-2 border border-surface-300 bg-white hover:bg-surface-50 text-navy-800 rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || submitting}
            className="flex items-center gap-1.5 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" /> {submitting ? 'Submitting...' : 'Submit to Advisor'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Confidential Pricing Warning */}
      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="block mb-0.5 font-bold">Confidential Commercial Pricing Guarantee:</strong>
          These line items and workshop pricing values are strictly confidential. Customers will never see your workshop unit prices, labor margins, or discount structures.
        </div>
      </div>

      {/* Quotation Header Card */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-6">
        <h2 className="text-sm font-bold text-navy-900 border-b border-surface-100 pb-3">
          1. General Quotation Terms
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-navy-500 uppercase mb-1">
              Valid Until Date *
            </label>
            <div className="relative">
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full text-xs border border-surface-200 rounded-xl px-3 py-2 text-navy-900 focus:outline-none focus:border-amber-500"
              />
            </div>
            <p className="text-[10px] text-navy-400 mt-1">Must be a future expiration date.</p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-navy-500 uppercase mb-1">
              Estimated Completion (Hours)
            </label>
            <input
              type="number"
              min="1"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full text-xs border border-surface-200 rounded-xl px-3 py-2 text-navy-900 focus:outline-none focus:border-amber-500"
              placeholder="e.g. 6"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-navy-500 uppercase mb-1">
              Estimated Completion (Days)
            </label>
            <input
              type="number"
              min="1"
              value={estimatedDays}
              onChange={(e) => setEstimatedDays(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full text-xs border border-surface-200 rounded-xl px-3 py-2 text-navy-900 focus:outline-none focus:border-amber-500"
              placeholder="e.g. 1"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-navy-500 uppercase mb-1">
            Garage Remarks / Diagnostic Notes
          </label>
          <textarea
            rows={2}
            value={garageRemarks}
            onChange={(e) => setGarageRemarks(e.target.value)}
            className="w-full text-xs border border-surface-200 rounded-xl p-3 text-navy-900 focus:outline-none focus:border-amber-500"
            placeholder="Describe technical diagnosis, manufacturer parts utilized, warranty details, etc."
          />
        </div>
      </div>

      {/* Line Items Card */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-surface-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-navy-900">2. Itemized Quotation Breakdown</h2>
            <p className="text-[11px] text-navy-500">
              Break down parts, labor, and services with applicable GST and discounts.
            </p>
          </div>

          <button
            type="button"
            onClick={addLineItem}
            className="flex items-center gap-1 px-3 py-1.5 bg-surface-100 hover:bg-surface-200 text-navy-800 rounded-xl text-xs font-bold transition"
          >
            <Plus className="w-3.5 h-3.5 text-navy-600" /> Add Line Item
          </button>
        </div>

        {/* Table of Line Items */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-200 text-[10px] font-bold uppercase text-navy-500 tracking-wider">
                <th className="py-2 px-2 w-28">Type</th>
                <th className="py-2 px-2">Description</th>
                <th className="py-2 px-2 w-20">Qty</th>
                <th className="py-2 px-2 w-28">Unit Price (₹)</th>
                <th className="py-2 px-2 w-20">GST (%)</th>
                <th className="py-2 px-2 w-24">Disc (₹)</th>
                <th className="py-2 px-2 w-28 text-right">Line Total (₹)</th>
                <th className="py-2 px-1 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {lineItems.map((item, idx) => {
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
                        placeholder="Item or service description"
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
                        step="1"
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
                        step="10"
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
                        title="Remove Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Calculation Totals Summary Box */}
        <div className="pt-4 border-t border-surface-200 flex flex-col items-end">
          <div className="w-full max-w-xs space-y-2 text-xs">
            <div className="flex justify-between text-navy-600">
              <span>Gross Subtotal:</span>
              <span className="font-mono">₹{subtotalSum.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Discounts Applied:</span>
              <span className="font-mono">- ₹{discountSum.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-navy-600">
              <span>Estimated Tax (GST):</span>
              <span className="font-mono">+ ₹{taxSum.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-navy-900 pt-2 border-t border-surface-200">
              <span>Grand Total:</span>
              <span className="font-mono text-xl text-amber-600">
                ₹{totalAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewGarageQuotePage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm text-navy-600">Loading quote builder...</div>}>
      <NewQuoteForm />
    </Suspense>
  );
}
