'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { CustomerFacingQuotationDto } from '@/types/customerQuotation';
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export default function CustomerQuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.id as string;

  const [quote, setQuote] = useState<CustomerFacingQuotationDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadQuote() {
      setLoading(true);
      setErrorMsg(null);
      const res = await apiFetch<CustomerFacingQuotationDto>(`/customer/quotes/${quoteId}`);
      if (res.success && res.data) {
        setQuote(res.data);
      } else {
        setErrorMsg(res.message || 'Quotation not found or not yet approved for viewing.');
      }
      setLoading(false);
    }
    if (quoteId) {
      loadQuote();
    }
  }, [quoteId]);

  if (loading) {
    return (
      <div className="py-24 text-center text-sm text-navy-500">
        Loading commercial proposal...
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-navy-900">Quotation Unavailable</h2>
        <p className="text-xs text-navy-600">
          {errorMsg || 'This quotation is either not found or has not yet been sent by your technical advisor.'}
        </p>
        <Link
          href="/customer/quotes"
          className="inline-flex items-center gap-2 px-4 py-2 bg-navy-900 text-white rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Quotations
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Back button & Header */}
      <div className="space-y-1">
        <Link
          href="/customer/quotes"
          className="inline-flex items-center gap-1.5 text-xs text-navy-500 hover:text-navy-900 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to All Quotations
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-navy-900 tracking-tight">
              Quotation Proposal {quote.quotationNumber}
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {quote.status}
            </span>
          </div>
          <div className="text-xs text-navy-500">
            Linked to Request <span className="font-mono font-bold text-navy-900">#{quote.requestNumber}</span>
          </div>
        </div>
      </div>

      {/* Trust & Guarantee Banner */}
      <div className="p-4 bg-navy-900 rounded-2xl text-white flex items-start gap-3 border border-navy-800 shadow-sm">
        <ShieldCheck className="w-5 h-5 text-electric-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-surface-200">
          <strong className="text-white block text-sm mb-0.5">BroCo Mod Certified Warranty Guarantee</strong>
          This quotation has been reviewed and verified by a BroCo Mod Technical Advisor. All OEM parts, labour rates, and taxes are fixed and guaranteed against surprise additional charges.
        </div>
      </div>

      {/* Scope & Details Card */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
          Scope of Work
        </h2>
        <p className="text-xs text-navy-700 bg-surface-50 p-4 rounded-xl border border-surface-200 leading-relaxed font-medium">
          {quote.scopeSummary}
        </p>

        {quote.advisorRemarks && (
          <div className="space-y-1">
            <div className="text-xs font-bold text-navy-800">Advisor Remarks & Coverage</div>
            <p className="text-xs text-navy-600 bg-surface-50 p-3 rounded-xl border border-surface-200">
              {quote.advisorRemarks}
            </p>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-navy-500 pt-1">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-navy-400" />
            <span>Valid until {new Date(quote.validUntilUtc).toLocaleDateString()}</span>
          </span>
          {quote.sentAtUtc && (
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-navy-400" />
              <span>Received {new Date(quote.sentAtUtc).toLocaleDateString()}</span>
            </span>
          )}
        </div>
      </div>

      {/* Commercial Line Items Table */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
          Approved Items & Service Breakdown
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-surface-50 text-navy-600 border-b border-surface-200">
              <tr>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-3 text-right">Discount</th>
                <th className="py-2.5 px-3 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 text-navy-800 font-medium">
              {quote.lineItems.map((li) => (
                <tr key={li.id}>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 bg-surface-100 border border-surface-200 rounded text-[10px] font-bold text-navy-700">
                      {li.lineType}
                    </span>
                  </td>
                  <td className="py-3 px-3">{li.description}</td>
                  <td className="py-3 px-3 text-right">{li.quantity}</td>
                  <td className="py-3 px-3 text-right">₹{li.unitPrice.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right text-rose-600">
                    {li.discountAmount > 0 ? `-₹${li.discountAmount.toLocaleString()}` : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-bold">₹{li.lineTotal.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1 max-w-sm">
          <div className="text-xs font-bold text-navy-900 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-navy-400" />
            <span>Transparent Pricing Policy</span>
          </div>
          <p className="text-[11px] text-navy-500 leading-relaxed">
            All prices include certified partner workshop labor, genuine OEM parts, and statutory GST. No hidden fees or unauthorized additions upon delivery.
          </p>
        </div>

        <div className="w-full sm:w-72 space-y-2 text-right">
          <div className="flex justify-between text-xs text-navy-600">
            <span>Items Subtotal:</span>
            <span className="font-semibold text-navy-900">₹{quote.customerSubtotal.toLocaleString()}</span>
          </div>
          {quote.customerDiscount > 0 && (
            <div className="flex justify-between text-xs text-rose-600 font-semibold">
              <span>Promotional Discount:</span>
              <span>-₹{quote.customerDiscount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-xs text-navy-600">
            <span>Taxes & GST:</span>
            <span className="font-semibold text-navy-900">₹{quote.customerTax.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-navy-900 border-t border-surface-200 pt-2">
            <span>Total Payable:</span>
            <span className="text-electric-600 text-xl font-black">₹{quote.customerTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Milestone 7 Notice & Action Placeholder */}
      <div className="p-5 bg-surface-50 border border-surface-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="text-xs font-bold text-navy-900">
            Quotation Acceptance & Scheduling
          </div>
          <div className="text-xs text-navy-500">
            Customer acceptance, appointment confirmation, and advance payment checkout will be activated in Milestone 7.
          </div>
        </div>
        <button
          type="button"
          disabled
          className="px-5 py-2.5 bg-electric-600 text-white rounded-xl text-xs font-bold tracking-wide opacity-50 cursor-not-allowed flex-shrink-0"
        >
          Accept Quotation (Milestone 7)
        </button>
      </div>
    </div>
  );
}
