'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { GarageQuoteSummaryDto } from '@/types/garageQuote';
import {
  FileSpreadsheet,
  ShieldAlert,
  Clock,
  Tag,
  PlusCircle,
  Eye,
  CheckCircle2,
  Calendar,
  AlertCircle,
  FileCheck,
  Building2,
} from 'lucide-react';

export default function GarageQuotesPage() {
  const [quotes, setQuotes] = useState<GarageQuoteSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    loadQuotes();
  }, [statusFilter]);

  async function loadQuotes() {
    setLoading(true);
    const query = statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
    const res = await apiFetch<GarageQuoteSummaryDto[]>(`/garage/quotes${query}`);
    if (res.success && res.data) {
      setQuotes(res.data);
    }
    setLoading(false);
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

  const tabs = [
    { id: 'ALL', label: 'All Quotations' },
    { id: 'Draft', label: 'Drafts' },
    { id: 'Submitted', label: 'Submitted' },
    { id: 'UnderReview', label: 'Under Review' },
    { id: 'Withdrawn', label: 'Withdrawn' },
    { id: 'Expired', label: 'Expired' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Workshop Quotations Workbench</h1>
          <p className="text-xs text-navy-600 mt-1">
            Build, revise, and manage your partner garage bids with full line-item breakdowns.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/garage/requests"
            className="flex items-center gap-1.5 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Quote from Dispatched Request
          </Link>
        </div>
      </div>

      {/* Confidentiality Warning Card */}
      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="block mb-0.5 font-bold">Confidential Commercial Pricing Guarantee:</strong>
          These quotations and line-item cost breakdowns are strictly private between your workshop and BroCo Mod Technical Advisors. Neither customers nor competitor garages can ever inspect your internal rates or margins.
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-surface-200 text-xs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3 py-1.5 font-semibold rounded-lg transition whitespace-nowrap ${
              statusFilter === tab.id
                ? 'bg-navy-900 text-white shadow-sm'
                : 'bg-white text-navy-600 hover:bg-surface-100 border border-surface-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-navy-600">Loading quotations workbench...</div>
      ) : quotes.length > 0 ? (
        <div className="space-y-4">
          {quotes.map((q) => (
            <div
              key={q.id}
              className="bg-white rounded-2xl border border-surface-200 shadow-sm p-5 hover:border-surface-300 transition"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-surface-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-navy-900 bg-surface-100 px-2.5 py-0.5 rounded-lg border border-surface-200">
                      {q.quoteNumber}
                    </span>
                    <span className="font-mono text-xs font-semibold text-navy-500">
                      v{q.versionNumber}
                    </span>
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getStatusBadge(
                        q.status
                      )}`}
                    >
                      {q.status}
                    </span>
                  </div>

                  <div className="text-xs text-navy-700 font-medium">
                    Service Request:{' '}
                    <strong className="text-navy-900 font-mono">{q.requestNumber || 'Direct BQ'}</strong>{' '}
                    • {q.vehicleSummary}
                  </div>
                </div>

                <div className="flex items-center gap-6 self-end md:self-center">
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-navy-500 uppercase tracking-wider">
                      Quote Total ({q.currency})
                    </div>
                    <div className="text-2xl font-black text-navy-900">
                      ₹{q.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <Link
                    href={`/garage/quotes/${q.id}`}
                    className="flex items-center gap-1.5 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5" /> View / Edit
                  </Link>
                </div>
              </div>

              <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-navy-600">
                <div>
                  <span className="text-[10px] font-bold text-navy-400 uppercase block">Valid Until</span>
                  <span className="font-semibold text-navy-800">
                    {new Date(q.validUntil).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-navy-400 uppercase block">Estimated Days</span>
                  <span className="font-semibold text-navy-800">
                    {q.estimatedCompletionDays != null ? `${q.estimatedCompletionDays} Days` : 'Not specified'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-navy-400 uppercase block">Created On</span>
                  <span className="font-semibold text-navy-800">
                    {new Date(q.createdAtUtc).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-navy-400 uppercase block">Submitted At</span>
                  <span className="font-semibold text-navy-800">
                    {q.submittedAtUtc ? new Date(q.submittedAtUtc).toLocaleDateString() : 'Not yet submitted'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 bg-white rounded-2xl border border-dashed border-surface-300 text-center p-8">
          <FileSpreadsheet className="w-12 h-12 text-navy-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-900">No Quotations Found</h3>
          <p className="text-xs text-navy-600 mt-1 max-w-sm mx-auto">
            {statusFilter === 'ALL'
              ? 'You have not created any quotations yet. Check your dispatched service requests to submit a quote.'
              : `No quotations found with status "${statusFilter}".`}
          </p>
          <div className="mt-4">
            <Link
              href="/garage/requests"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5" /> View Nearby Requests
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
