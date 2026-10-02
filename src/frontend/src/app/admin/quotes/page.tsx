'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminGarageQuoteSummaryDto, AdminGarageQuoteDetailDto } from '@/types/garageQuote';
import {
  FileSpreadsheet,
  Building2,
  Search,
  Eye,
  ShieldAlert,
  Calendar,
  Clock,
  History,
  AlertCircle,
  FileCheck,
} from 'lucide-react';

export default function AdminGarageQuotesPage() {
  const [quotes, setQuotes] = useState<AdminGarageQuoteSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Detail Modal
  const [selectedQuote, setSelectedQuote] = useState<AdminGarageQuoteDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    loadQuotes();
  }, []);

  async function loadQuotes() {
    setLoading(true);
    const res = await apiFetch<AdminGarageQuoteSummaryDto[]>('/admin/garage-quotes');
    if (res.success && res.data) {
      setQuotes(res.data);
    }
    setLoading(false);
  }

  async function viewDetail(quoteId: string) {
    setDetailLoading(true);
    const res = await apiFetch<AdminGarageQuoteDetailDto>(`/admin/garage-quotes/${quoteId}`);
    if (res.success && res.data) {
      setSelectedQuote(res.data);
    }
    setDetailLoading(false);
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

  const filteredQuotes = quotes.filter((q) => {
    const matchesSearch =
      q.quoteNumber.toLowerCase().includes(search.toLowerCase()) ||
      q.garageName.toLowerCase().includes(search.toLowerCase()) ||
      q.serviceRequestNumber.toLowerCase().includes(search.toLowerCase()) ||
      q.vehicleSummary.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || q.status.toUpperCase() === statusFilter.toUpperCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Partner Workshop Quotations Audit</h1>
          <p className="text-xs text-navy-600 mt-1">
            Global administrative supervision of commercial quotations across the entire partner network.
          </p>
        </div>
      </div>

      {/* Admin Privilege Banner */}
      <div className="p-4 bg-red-50 rounded-2xl border border-red-200 text-xs text-red-900 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="block mb-0.5 font-bold">Privileged Administrative Audit Scope:</strong>
          Super Administrators can inspect all internal bids, cost breakdowns, and immutable version snapshots for compliance and quality control.
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-navy-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Quote #, Workshop, Req #, Vehicle..."
            className="w-full pl-9 pr-3 py-2 border border-surface-200 rounded-xl text-xs text-navy-900 focus:outline-none focus:border-red-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['ALL', 'SUBMITTED', 'UNDERREVIEW', 'DRAFT', 'WITHDRAWN', 'EXPIRED'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                statusFilter === s
                  ? 'bg-navy-900 text-white'
                  : 'bg-surface-50 text-navy-600 hover:bg-surface-100 border border-surface-200'
              }`}
            >
              {s === 'ALL' ? 'All Statuses' : s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-navy-600">Loading quotation ledger...</div>
      ) : filteredQuotes.length > 0 ? (
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-50 border-b border-surface-200 text-[10px] font-bold uppercase text-navy-500 tracking-wider">
                <tr>
                  <th className="py-3 px-4">Quote Ref</th>
                  <th className="py-3 px-4">Workshop</th>
                  <th className="py-3 px-4">Service Request</th>
                  <th className="py-3 px-4">Vehicle</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {filteredQuotes.map((q) => (
                  <tr key={q.id} className="hover:bg-surface-50/50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-navy-900">{q.quoteNumber}</td>
                    <td className="py-3 px-4 font-semibold text-navy-800">{q.garageName}</td>
                    <td className="py-3 px-4 font-mono text-navy-600">{q.serviceRequestNumber}</td>
                    <td className="py-3 px-4 text-navy-700">{q.vehicleSummary}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getStatusBadge(
                          q.status
                        )}`}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-navy-900">
                      ₹{q.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-navy-600">
                      {q.submittedAtUtc ? new Date(q.submittedAtUtc).toLocaleDateString() : 'Draft'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => viewDetail(q.id)}
                        className="p-1.5 hover:bg-surface-100 rounded-lg text-navy-600 transition"
                        title="Audit Line Items & Snapshots"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="py-16 bg-white rounded-2xl border border-dashed border-surface-300 text-center p-8">
          <FileSpreadsheet className="w-12 h-12 text-navy-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-900">No Quotations Found</h3>
          <p className="text-xs text-navy-600 mt-1 max-w-sm mx-auto">
            {search ? 'No quotations matched your search criteria.' : 'No partner garage quotations found in the platform database.'}
          </p>
        </div>
      )}

      {/* DETAIL AUDIT MODAL */}
      {selectedQuote && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-surface-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-navy-900 bg-surface-100 px-2 py-0.5 rounded-lg border border-surface-200">
                    {selectedQuote.quoteNumber}
                  </span>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getStatusBadge(
                      selectedQuote.status
                    )}`}
                  >
                    {selectedQuote.status}
                  </span>
                </div>
                <h3 className="text-base font-bold text-navy-900 mt-1">
                  {selectedQuote.garageName} • {selectedQuote.vehicleSummary}
                </h3>
                <p className="text-xs text-navy-500 font-mono">
                  Service Request: {selectedQuote.serviceRequestNumber}
                </p>
              </div>

              <button
                onClick={() => setSelectedQuote(null)}
                className="text-navy-400 hover:text-navy-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* General Information */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-[10px] font-bold text-navy-400 uppercase block">Valid Until</span>
                <span className="font-semibold text-navy-800">
                  {new Date(selectedQuote.validUntil).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-navy-400 uppercase block">Estimated Duration</span>
                <span className="font-semibold text-navy-800">
                  {selectedQuote.estimatedCompletionDays ? `${selectedQuote.estimatedCompletionDays} Days` : ''}{' '}
                  {selectedQuote.estimatedCompletionHours ? `(${selectedQuote.estimatedCompletionHours} Hrs)` : ''}
                  {!selectedQuote.estimatedCompletionDays && !selectedQuote.estimatedCompletionHours && 'Standard'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-navy-400 uppercase block">Submitted At</span>
                <span className="font-semibold text-navy-800">
                  {selectedQuote.submittedAtUtc ? new Date(selectedQuote.submittedAtUtc).toLocaleString() : 'Draft'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-navy-400 uppercase block">Grand Total</span>
                <span className="font-mono font-bold text-sm text-navy-900">
                  ₹{selectedQuote.totalAmount.toFixed(2)}
                </span>
              </div>

              {selectedQuote.garageRemarks && (
                <div className="col-span-2 sm:col-span-4 bg-surface-50 p-3 rounded-xl border border-surface-200">
                  <span className="text-[10px] font-bold text-navy-400 uppercase block mb-0.5">Workshop Remarks</span>
                  <p className="text-navy-700">{selectedQuote.garageRemarks}</p>
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <div>
              <h4 className="text-xs font-bold text-navy-900 uppercase mb-2">Itemized Breakdown</h4>
              <div className="overflow-x-auto border border-surface-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-50 text-[10px] font-bold uppercase text-navy-500">
                    <tr>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Description</th>
                      <th className="py-2 px-3">Qty</th>
                      <th className="py-2 px-3">Unit Price</th>
                      <th className="py-2 px-3">GST (%)</th>
                      <th className="py-2 px-3">Disc</th>
                      <th className="py-2 px-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {selectedQuote.lineItems.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2 px-3 font-semibold text-[10px] text-navy-700">{item.lineType}</td>
                        <td className="py-2 px-3 font-medium text-navy-900">{item.description}</td>
                        <td className="py-2 px-3 text-navy-700">{item.quantity}</td>
                        <td className="py-2 px-3 font-mono text-navy-700">₹{item.unitPrice.toFixed(2)}</td>
                        <td className="py-2 px-3 text-navy-700">{item.taxRate}%</td>
                        <td className="py-2 px-3 font-mono text-emerald-700">
                          {item.discountAmount > 0 ? `- ₹${item.discountAmount.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-navy-900">
                          ₹{item.lineTotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Version History */}
            {selectedQuote.versions && selectedQuote.versions.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-navy-900 uppercase mb-2 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-purple-600" /> Version Audit Trail
                </h4>
                <div className="space-y-2">
                  {selectedQuote.versions.map((ver) => (
                    <div
                      key={ver.id}
                      className="p-3 bg-surface-50 rounded-xl border border-surface-200 text-xs flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-purple-900 bg-purple-100 px-2 py-0.5 rounded font-mono text-[10px]">
                          v{ver.versionNumber}
                        </span>
                        <span className="text-navy-500">
                          {new Date(ver.submittedAtUtc).toLocaleString()}
                        </span>
                      </div>
                      <div className="font-mono font-bold text-navy-900">
                        ₹{ver.totalAmount.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-surface-100">
              <button
                onClick={() => setSelectedQuote(null)}
                className="px-4 py-2 bg-navy-900 text-white text-xs font-bold rounded-xl hover:bg-navy-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
