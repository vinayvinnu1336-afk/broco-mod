'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  QuoteComparisonDto,
  CustomerQuotationDto,
  CustomerQuotationLineItemInputDto,
  QuoteLineType,
} from '@/types/customerQuotation';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  Plus,
  Trash2,
  Send,
  AlertCircle,
  ShieldCheck,
  History,
} from 'lucide-react';

export default function CustomerQuotationBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [comparison, setComparison] = useState<QuoteComparisonDto | null>(null);
  const [existingQuote, setExistingQuote] = useState<CustomerQuotationDto | null>(null);

  // Form State
  const [scopeSummary, setScopeSummary] = useState('');
  const [advisorRemarks, setAdvisorRemarks] = useState('');
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [customerDiscount, setCustomerDiscount] = useState<number>(0);
  const [lineItems, setLineItems] = useState<CustomerQuotationLineItemInputDto[]>([]);

  async function loadData() {
    setLoading(true);
    setErrorMsg(null);

    // 1. Fetch Comparison and active assignment
    const compRes = await apiFetch<QuoteComparisonDto>(`/advisor/requests/${requestId}/quotes`);
    if (!compRes.success || !compRes.data) {
      setErrorMsg(compRes.message || 'Failed to load request and assignment data.');
      setLoading(false);
      return;
    }
    setComparison(compRes.data);

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
      setLineItems(
        activeQuote.lineItems.map((li, idx) => ({
          lineType: li.lineType,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          taxRate: li.taxRate,
          discountAmount: li.discountAmount,
          sortOrder: li.sortOrder || idx + 1,
        }))
      );
    } else {
      // Pre-populate template from winning garage quote if assigned
      const assignedQuoteId = compRes.data.activeAssignment?.selectedQuoteId;
      const winningQuote = compRes.data.quotes.find((q) => q.quoteId === assignedQuoteId);

      setScopeSummary(`Standard comprehensive service package for ${compRes.data.vehicleSummary}`);
      setAdvisorRemarks('Includes verified OEM parts and 6-month BroCo Mod craftsmanship warranty.');
      
      if (winningQuote && winningQuote.lineItems.length > 0) {
        setLineItems(
          winningQuote.lineItems.map((li, idx) => ({
            lineType: (li.lineType as QuoteLineType) || 'Service',
            description: li.description,
            quantity: li.quantity,
            // Apply standard customer margin markup (e.g., 15%)
            unitPrice: Math.round(li.unitPrice * 1.15),
            taxRate: li.taxRate || 18,
            discountAmount: 0,
            sortOrder: idx + 1,
          }))
        );
      } else {
        // Fallback starter line item
        setLineItems([
          {
            lineType: 'Service',
            description: 'Comprehensive Diagnostic & Inspection',
            quantity: 1,
            unitPrice: 1500,
            taxRate: 18,
            discountAmount: 0,
            sortOrder: 1,
          },
        ]);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    if (requestId) {
      loadData();
    }
  }, [requestId]);

  // Live Financial Calculations
  const calculatedSubtotal = lineItems.reduce((sum, item) => {
    const gross = (item.quantity || 0) * (item.unitPrice || 0);
    const lineNet = Math.max(0, gross - (item.discountAmount || 0));
    return sum + lineNet;
  }, 0);

  const taxableAfterDiscount = Math.max(0, calculatedSubtotal - customerDiscount);
  const discountRatio = calculatedSubtotal > 0 ? taxableAfterDiscount / calculatedSubtotal : 1;

  const calculatedTax = lineItems.reduce((sum, item) => {
    const gross = (item.quantity || 0) * (item.unitPrice || 0);
    const lineNet = Math.max(0, gross - (item.discountAmount || 0));
    const rawTax = (lineNet * (item.taxRate || 0)) / 100;
    return sum + rawTax * discountRatio;
  }, 0);

  const calculatedTotal = taxableAfterDiscount + calculatedTax;

  function addLineItem() {
    setLineItems([
      ...lineItems,
      {
        lineType: 'Labour',
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxRate: 18,
        discountAmount: 0,
        sortOrder: lineItems.length + 1,
      },
    ]);
  }

  function updateLineItem(index: number, field: keyof CustomerQuotationLineItemInputDto, val: any) {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: val };
    setLineItems(updated);
  }

  function removeLineItem(index: number) {
    setLineItems(lineItems.filter((_, idx) => idx !== index));
  }

  async function handleSaveDraft() {
    if (!scopeSummary.trim()) {
      setErrorMsg('Scope summary is required.');
      return;
    }
    if (lineItems.length === 0) {
      setErrorMsg('At least one commercial line item is required.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const validUntilIso = new Date(validUntil + 'T23:59:59Z').toISOString();

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
        setExistingQuote(res.data);
        setSuccessMsg('Customer quotation draft saved successfully.');
      } else {
        setErrorMsg(res.message || 'Failed to update draft.');
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
        setExistingQuote(res.data);
        setSuccessMsg(`Quotation draft ${res.data.quotationNumber} created successfully!`);
      } else {
        setErrorMsg(res.message || 'Failed to create quotation draft.');
      }
    }
    setSaving(false);
  }

  async function handleMarkReady() {
    if (!existingQuote) {
      await handleSaveDraft();
    }
    if (!existingQuote) return;

    setSaving(true);
    const res = await apiFetch<CustomerQuotationDto>(`/advisor/customer-quotations/${existingQuote.id}/ready`, {
      method: 'POST',
    });

    if (res.success && res.data) {
      setExistingQuote(res.data);
      setSuccessMsg('Quotation marked as Ready to Send. Immutable version snapshot recorded.');
    } else {
      setErrorMsg(res.message || 'Failed to mark quotation ready.');
    }
    setSaving(false);
  }

  async function handleSendToCustomer() {
    if (!existingQuote) return;
    if (!confirm('Are you sure you want to send this finalized quotation to the customer? It will become visible in their portal.')) {
      return;
    }

    setSaving(true);
    const res = await apiFetch<CustomerQuotationDto>(`/advisor/customer-quotations/${existingQuote.id}/send`, {
      method: 'POST',
    });

    if (res.success && res.data) {
      setExistingQuote(res.data);
      setSuccessMsg('Customer quotation sent successfully! Customer has been notified.');
    } else {
      setErrorMsg(res.message || 'Failed to send customer quotation.');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="py-24 text-center text-sm text-navy-500">
        Loading quotation workspace and financial calculators...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href={`/advisor/requests/${requestId}`}
            className="inline-flex items-center gap-1.5 text-xs text-navy-500 hover:text-navy-900 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Quotation Review
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-navy-900 tracking-tight">
              Customer Quotation Builder
            </h1>
            {existingQuote && (
              <span className="font-mono text-xs font-bold px-2.5 py-1 bg-surface-100 rounded-lg text-navy-800">
                {existingQuote.quotationNumber} (v{existingQuote.versionNumber})
              </span>
            )}
            {existingQuote && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {existingQuote.status}
              </span>
            )}
          </div>
          <p className="text-xs text-navy-600">
            Curate the official customer-facing proposal. All workshop wholesale rates and internal notes remain strictly confidential.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {(!existingQuote || existingQuote.status === 'Draft') && (
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveDraft}
              className="px-4 py-2 bg-white hover:bg-surface-50 text-navy-800 border border-surface-300 text-xs font-bold rounded-xl transition shadow-sm"
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
          )}

          {existingQuote && existingQuote.status === 'Draft' && (
            <button
              type="button"
              disabled={saving}
              onClick={handleMarkReady}
              className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold rounded-xl transition shadow-sm"
            >
              Mark Ready to Send
            </button>
          )}

          {existingQuote && (existingQuote.status === 'ReadyToSend' || existingQuote.status === 'Draft') && (
            <button
              type="button"
              disabled={saving}
              onClick={handleSendToCustomer}
              className="flex items-center gap-1.5 px-5 py-2 bg-electric-600 hover:bg-electric-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
            >
              <Send className="w-3.5 h-3.5" /> Send to Customer
            </button>
          )}
        </div>
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

      {/* Security Privacy Callout */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3 text-blue-900 text-xs">
        <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <span>
          <strong>Confidentiality Invariant:</strong> The customer sees ONLY the line items, scope description, and final amounts defined here. Internal garage wholesale bids and partner margins are completely stripped and never transmitted.
        </span>
      </div>

      {/* Proposal Metadata Form */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
          Proposal Scope & Timeline
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-navy-800">Scope Summary (Required)</label>
            <input
              type="text"
              value={scopeSummary}
              onChange={(e) => setScopeSummary(e.target.value)}
              placeholder="E.g., Complete Transmission Overhaul & Clutch Replacement"
              className="w-full text-xs p-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-navy-900 outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-navy-800">Valid Until Date</label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full text-xs p-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-navy-900 outline-none"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-navy-800">Advisor Remarks & Warranty Terms (Optional)</label>
          <textarea
            value={advisorRemarks}
            onChange={(e) => setAdvisorRemarks(e.target.value)}
            placeholder="Special instructions or warranty guarantees to present to the customer..."
            rows={2}
            className="w-full text-xs p-3 border border-surface-200 rounded-xl focus:ring-2 focus:ring-navy-900 outline-none"
          />
        </div>
      </div>

      {/* Customer Line Items Editor */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
            Commercial Line Items ({lineItems.length})
          </h2>
          <button
            type="button"
            onClick={addLineItem}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-100 hover:bg-surface-200 text-navy-800 text-xs font-bold rounded-lg transition"
          >
            <Plus className="w-3.5 h-3.5" /> Add Item
          </button>
        </div>

        <div className="space-y-3">
          {lineItems.map((item, idx) => {
            const itemGross = (item.quantity || 0) * (item.unitPrice || 0);
            const itemNet = Math.max(0, itemGross - (item.discountAmount || 0));
            const itemTax = (itemNet * (item.taxRate || 0)) / 100;
            const itemTotal = itemNet + itemTax;

            return (
              <div
                key={idx}
                className="p-4 bg-surface-50 border border-surface-200 rounded-xl grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
              >
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-navy-600">Type</label>
                  <select
                    value={item.lineType}
                    onChange={(e) => updateLineItem(idx, 'lineType', e.target.value as QuoteLineType)}
                    className="w-full text-xs p-2 bg-white border border-surface-200 rounded-lg outline-none"
                  >
                    <option value="Labour">Labour</option>
                    <option value="Part">Part (OEM)</option>
                    <option value="Service">Service</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="md:col-span-4 space-y-1">
                  <label className="text-[10px] font-bold text-navy-600">Description</label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                    placeholder="Description of parts or labour"
                    className="w-full text-xs p-2 bg-white border border-surface-200 rounded-lg outline-none"
                  />
                </div>

                <div className="md:col-span-1 space-y-1">
                  <label className="text-[10px] font-bold text-navy-600">Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2 bg-white border border-surface-200 rounded-lg text-right outline-none"
                  />
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-navy-600">Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={item.unitPrice}
                    onChange={(e) => updateLineItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2 bg-white border border-surface-200 rounded-lg text-right outline-none font-semibold"
                  />
                </div>

                <div className="md:col-span-1 space-y-1">
                  <label className="text-[10px] font-bold text-navy-600">Tax (%)</label>
                  <input
                    type="number"
                    min="0"
                    value={item.taxRate}
                    onChange={(e) => updateLineItem(idx, 'taxRate', parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2 bg-white border border-surface-200 rounded-lg text-right outline-none"
                  />
                </div>

                <div className="md:col-span-1 space-y-1 text-right">
                  <div className="text-[10px] font-bold text-navy-500">Total</div>
                  <div className="text-xs font-bold text-navy-900 py-2">
                    ₹{Math.round(itemTotal).toLocaleString()}
                  </div>
                </div>

                <div className="md:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeLineItem(idx)}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Financial Summary Box */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="w-full md:w-72 space-y-2">
          <label className="text-xs font-bold text-navy-800">Customer Promotional Discount (₹)</label>
          <input
            type="number"
            min="0"
            value={customerDiscount}
            onChange={(e) => setCustomerDiscount(parseFloat(e.target.value) || 0)}
            className="w-full text-xs p-2.5 border border-surface-200 rounded-xl focus:ring-2 focus:ring-navy-900 outline-none font-semibold text-rose-600"
          />
        </div>

        <div className="w-full md:w-80 space-y-2 text-right">
          <div className="flex justify-between text-xs text-navy-600">
            <span>Subtotal:</span>
            <span className="font-semibold text-navy-900">₹{Math.round(calculatedSubtotal).toLocaleString()}</span>
          </div>
          {customerDiscount > 0 && (
            <div className="flex justify-between text-xs text-rose-600">
              <span>Promotional Discount:</span>
              <span className="font-semibold">-₹{Math.round(customerDiscount).toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-xs text-navy-600">
            <span>Estimated GST / Tax:</span>
            <span className="font-semibold text-navy-900">₹{Math.round(calculatedTax).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-navy-900 border-t border-surface-200 pt-2">
            <span>Total Payable:</span>
            <span className="text-electric-600 text-lg">₹{Math.round(calculatedTotal).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Version Snapshots History */}
      {existingQuote && existingQuote.versions.length > 0 && (
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-navy-500" />
            <span>Immutable Version History ({existingQuote.versions.length})</span>
          </h2>
          <div className="divide-y divide-surface-200">
            {existingQuote.versions.map((v) => (
              <div key={v.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-navy-900">Version {v.versionNumber}</span>
                  <span className="text-navy-400 ml-2">Snapshot taken {new Date(v.createdAtUtc).toLocaleString()}</span>
                </div>
                <div className="font-bold text-navy-900">
                  Total ₹{Math.round(v.customerTotal).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
