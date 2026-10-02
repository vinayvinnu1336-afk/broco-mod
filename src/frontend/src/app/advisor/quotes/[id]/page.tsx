'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { AdvisorGarageQuoteDetailDto } from '@/types/garageQuote';
import {
  ArrowLeft,
  Building2,
  Phone,
  MapPin,
  Clock,
  ShieldCheck,
  History,
  FileSpreadsheet,
  AlertCircle,
  CarFront,
  Lock,
} from 'lucide-react';

export default function AdvisorQuoteDetailPage() {
  const params = useParams();
  const quoteId = params.id as string;

  const [quote, setQuote] = useState<AdvisorGarageQuoteDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadQuote() {
      setLoading(true);
      const res = await apiFetch<AdvisorGarageQuoteDetailDto>(`/advisor/garage-quotes/${quoteId}`);
      if (res.success && res.data) {
        setQuote(res.data);
      } else {
        setErrorMsg(res.message || 'Failed to load quotation details.');
      }
      setLoading(false);
    }
    loadQuote();
  }, [quoteId]);

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
        <Link href="/advisor/quotes" className="text-xs text-purple-600 font-bold hover:underline">
          Return to Received Quotations
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/advisor/quotes"
            className="p-2 rounded-xl border border-surface-200 hover:bg-surface-100 transition"
          >
            <ArrowLeft className="w-4 h-4 text-navy-600" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-navy-900 font-mono">{quote.quoteNumber}</h1>
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

        {/* Milestone Boundary Notice Action */}
        <div className="flex items-center gap-2">
          <button
            disabled
            className="flex items-center gap-1.5 px-4 py-2 bg-surface-100 text-navy-400 border border-surface-200 rounded-xl text-xs font-bold cursor-not-allowed"
            title="Garage assignment is locked until Milestone 6"
          >
            <Lock className="w-3.5 h-3.5" /> Garage Selection (Milestone 6)
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Scope Disclaimer Banner */}
      <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 text-xs text-purple-900 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="block mb-0.5 font-bold">Confidential Commercial Inspection Only:</strong>
          You are reviewing privileged workshop pricing. In Milestone 5, Advisors can audit line-item costs and validity periods. Garage selection, customer markup formulation, and customer quotation creation will be available in subsequent milestones.
        </div>
      </div>

      {/* Workshop Profile & Logistics */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-bold text-navy-900 border-b border-surface-100 pb-3">
          Partner Workshop Profile
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-[10px] font-bold text-navy-400 uppercase block">Workshop Name</span>
            <span className="font-bold text-navy-900 text-sm">{quote.garageName}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-navy-400 uppercase block">Workshop Phone</span>
            <span className="font-semibold text-navy-800">{quote.garagePhone}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-navy-400 uppercase block">Distance to Customer</span>
            <span className="font-bold text-emerald-700">{quote.garageDistanceKm} KM</span>
          </div>
          <div className="sm:col-span-3">
            <span className="text-[10px] font-bold text-navy-400 uppercase block">Workshop Address</span>
            <span className="font-medium text-navy-700">{quote.garageAddress}</span>
          </div>
        </div>
      </div>

      {/* Quotation Terms & Notes */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-bold text-navy-900 border-b border-surface-100 pb-3">
          Terms & Diagnostic Assessment
        </h2>

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
            <span className="text-[10px] font-bold text-navy-400 uppercase block">Submitted On</span>
            <span className="font-semibold text-navy-900">
              {quote.submittedAtUtc ? new Date(quote.submittedAtUtc).toLocaleString() : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-navy-400 uppercase block">Customer Problem</span>
            <span className="font-semibold text-navy-900 truncate block" title={quote.problemSummary}>
              {quote.problemSummary || 'Standard Service'}
            </span>
          </div>

          {quote.garageRemarks && (
            <div className="col-span-2 sm:col-span-4 bg-surface-50 p-3 rounded-xl border border-surface-200">
              <span className="text-[10px] font-bold text-navy-400 uppercase block mb-1">
                Workshop Technical Notes
              </span>
              <p className="text-navy-700 whitespace-pre-wrap">{quote.garageRemarks}</p>
            </div>
          )}
        </div>
      </div>

      {/* Itemized Breakdown Table */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4">
        <div className="border-b border-surface-100 pb-3">
          <h2 className="text-sm font-bold text-navy-900">Itemized Cost Structure</h2>
          <p className="text-[11px] text-navy-500">
            Confidential workshop part and labor breakdown.
          </p>
        </div>

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
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {quote.lineItems.map((item) => (
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
              <span className="font-mono">₹{quote.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Discounts:</span>
              <span className="font-mono">- ₹{quote.discountAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-navy-600">
              <span>Tax (GST):</span>
              <span className="font-mono">+ ₹{quote.taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-navy-900 pt-2 border-t border-surface-200">
              <span>Total Bid Amount:</span>
              <span className="font-mono text-xl text-purple-700">
                ₹{quote.totalAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Versions */}
      {quote.versions && quote.versions.length > 0 && (
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-surface-100 pb-3">
            <History className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-bold text-navy-900">Immutable Version Audit Trail</h2>
          </div>

          <div className="space-y-3">
            {quote.versions.map((ver) => (
              <div
                key={ver.id}
                className="p-4 bg-surface-50 rounded-xl border border-surface-200 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-900 bg-purple-100 px-2 py-0.5 rounded-lg font-mono">
                    Version Snapshot v{ver.versionNumber}
                  </span>
                  <span className="text-navy-500">
                    Submitted {new Date(ver.submittedAtUtc).toLocaleString()}
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-between text-[11px] text-navy-500">
                  <span>Subtotal: ₹{ver.subtotal.toFixed(2)}</span>
                  <span>Discounts: ₹{ver.discountAmount.toFixed(2)}</span>
                  <span>Tax: ₹{ver.taxAmount.toFixed(2)}</span>
                  <span className="font-mono font-bold text-navy-800">
                    Total: ₹{ver.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
