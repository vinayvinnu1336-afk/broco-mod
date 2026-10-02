'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { AdvisorGarageQuoteSummaryDto } from '@/types/garageQuote';
import {
  FileSpreadsheet,
  ShieldCheck,
  ArrowRight,
  Building2,
  MapPin,
  Clock,
  Eye,
  Info,
  CarFront,
} from 'lucide-react';

export default function AdvisorQuotesPage() {
  const [quotes, setQuotes] = useState<AdvisorGarageQuoteSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadQuotes() {
      setLoading(true);
      const res = await apiFetch<AdvisorGarageQuoteSummaryDto[]>('/advisor/garage-quotes');
      if (res.success && res.data) {
        setQuotes(res.data);
      }
      setLoading(false);
    }
    loadQuotes();
  }, []);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Received Workshop Quotations</h1>
        <p className="text-xs text-navy-600 mt-1">
          Review commercial bids submitted by partner garages for dispatched service requests.
        </p>
      </div>

      {/* Scope Disclaimer Banner */}
      <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 text-xs text-purple-900 flex items-start gap-3">
        <Info className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="block mb-0.5 font-bold">Advisor Inspection Only (Milestone 5 Scope Boundary):</strong>
          In Milestone 5, Advisors can view and audit all incoming garage bids and line-item breakdowns. Garage selection, garage assignment, customer markup calculation, and customer proposal dispatch will be implemented in subsequent milestones.
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-navy-600">Loading received quotations...</div>
      ) : quotes.length > 0 ? (
        <div className="space-y-4">
          {quotes.map((q) => (
            <div
              key={q.id}
              className="bg-white rounded-2xl border border-surface-200 shadow-sm p-5 hover:border-purple-300 transition"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-surface-100">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-navy-900">{q.garageName}</h3>
                      <span className="font-mono text-xs font-bold text-navy-700 bg-surface-100 px-2 py-0.5 rounded-lg border border-surface-200">
                        {q.quoteNumber}
                      </span>
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getStatusBadge(
                          q.status
                        )}`}
                      >
                        {q.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-navy-600 mt-1">
                      <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                        <MapPin className="w-3.5 h-3.5" /> {q.garageDistanceKm} KM away
                      </span>
                      <span>•</span>
                      <span className="font-mono font-semibold text-navy-800">
                        Req #{q.serviceRequestNumber}
                      </span>
                      <span>•</span>
                      <span>{q.vehicleSummary}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 self-end md:self-center">
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-navy-500 uppercase tracking-wider">
                      Partner Bid Total ({q.currency})
                    </div>
                    <div className="text-2xl font-black text-navy-900">
                      ₹{q.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <Link
                    href={`/advisor/quotes/${q.id}`}
                    className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5" /> Inspect Bid
                  </Link>
                </div>
              </div>

              <div className="pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-navy-600">
                <div>
                  <span className="text-[10px] font-bold text-navy-400 uppercase block">Valid Until</span>
                  <span className="font-semibold text-navy-800">
                    {new Date(q.validUntil).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-navy-400 uppercase block">Estimated Days</span>
                  <span className="font-semibold text-navy-800">
                    {q.estimatedCompletionDays != null ? `${q.estimatedCompletionDays} Days` : 'Standard'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-navy-400 uppercase block">Submitted At</span>
                  <span className="font-semibold text-navy-800">
                    {q.submittedAtUtc ? new Date(q.submittedAtUtc).toLocaleString() : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-navy-400 uppercase block">Problem</span>
                  <span className="font-semibold text-navy-800 truncate block max-w-xs" title={q.problemSummary}>
                    {q.problemSummary || 'Standard service'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 bg-white rounded-2xl border border-dashed border-surface-300 text-center p-8">
          <FileSpreadsheet className="w-12 h-12 text-navy-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-900">No Workshop Quotations Received</h3>
          <p className="text-xs text-navy-600 mt-1 max-w-sm mx-auto">
            When partner garages submit quotations for dispatched service requests, they will appear here for technical inspection.
          </p>
        </div>
      )}
    </div>
  );
}
