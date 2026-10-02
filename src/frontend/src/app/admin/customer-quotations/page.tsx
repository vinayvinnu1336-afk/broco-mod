'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { CustomerQuotationSummaryDto } from '@/types/customerQuotation';
import {
  FileText,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Search,
  Building2,
  ShieldAlert,
} from 'lucide-react';

export default function AdminCustomerQuotationsPage() {
  const [quotations, setQuotations] = useState<CustomerQuotationSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadQuotations() {
      setLoading(true);
      const res = await apiFetch<CustomerQuotationSummaryDto[]>('/admin/customer-quotations');
      if (res.success && res.data) {
        setQuotations(res.data);
      }
      setLoading(false);
    }
    loadQuotations();
  }, []);

  const filtered = quotations.filter((q) => {
    const term = search.toLowerCase();
    return (
      q.quotationNumber.toLowerCase().includes(term) ||
      q.requestNumber.toLowerCase().includes(term) ||
      q.assignedGarageName.toLowerCase().includes(term) ||
      q.status.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight">
            Customer Proposals Audit
          </h1>
          <p className="text-xs text-navy-600 mt-1">
            Global administrative overview of all customer quotations, pricing models, and dispatch lifecycle statuses.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-navy-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quote #, request, workshop..."
            className="w-full text-xs pl-9 pr-3 py-2.5 bg-white border border-surface-200 rounded-xl outline-none focus:ring-2 focus:ring-navy-900"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-navy-500">Loading customer proposals audit...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 bg-white rounded-2xl border border-dashed border-surface-300 text-center p-8">
          <FileText className="w-12 h-12 text-navy-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-900">No Customer Proposals Found</h3>
          <p className="text-xs text-navy-600 mt-1">
            No customer quotations match your current filter criteria.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-50 text-navy-600 border-b border-surface-200">
                <tr>
                  <th className="py-3 px-4">Quotation #</th>
                  <th className="py-3 px-4">Request #</th>
                  <th className="py-3 px-4">Fulfillment Workshop</th>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4 text-right">Customer Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Valid Until</th>
                  <th className="py-3 px-4">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-navy-800 font-medium">
                {filtered.map((q) => (
                  <tr key={q.id} className="hover:bg-surface-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-electric-600">{q.quotationNumber}</td>
                    <td className="py-3 px-4 font-mono">{q.requestNumber}</td>
                    <td className="py-3 px-4 font-bold">{q.assignedGarageName}</td>
                    <td className="py-3 px-4">v{q.versionNumber}</td>
                    <td className="py-3 px-4 text-right font-black text-navy-900">
                      ₹{q.customerTotal.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          q.status === 'Sent'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : q.status === 'Accepted'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : q.status === 'ReadyToSend'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-surface-100 text-navy-700 border border-surface-200'
                        }`}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-navy-500">
                      {new Date(q.validUntilUtc).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-navy-500">
                      {new Date(q.createdAtUtc).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
