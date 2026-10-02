'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { CustomerFacingQuotationDto } from '@/types/customerQuotation';
import {
  BadgeDollarSign,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Car,
  ChevronRight,
  FileText,
  Calendar,
  AlertCircle,
} from 'lucide-react';

export default function CustomerQuotesPage() {
  const [quotes, setQuotes] = useState<CustomerFacingQuotationDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadQuotes() {
      const res = await apiFetch<CustomerFacingQuotationDto[]>('/customer/quotes');
      if (res.success && res.data) {
        setQuotes(res.data);
      }
      setLoading(false);
    }
    loadQuotes();
  }, []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Approved Quotations</h1>
          <p className="text-xs text-navy-600 mt-1">
            Curated quotations approved by your dedicated technical advisor with certified warranty protection.
          </p>
        </div>
      </div>

      {/* Pricing Isolation Banner */}
      <div className="p-4 bg-navy-900 rounded-2xl text-white flex items-start gap-3 border border-navy-800 shadow-sm">
        <ShieldCheck className="w-5 h-5 text-electric-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-surface-200">
          <strong className="text-white block text-sm mb-0.5">BroCo Mod Pricing Security Guarantee</strong>
          Every price listed here is an all-inclusive, fixed customer proposal vetted by BroCo Mod Technical Advisors.
          Workshop internal parts cost breakdown and commercial negotiations are securely segregated on the server.
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-navy-500">Loading approved quotations...</div>
      ) : quotes.length > 0 ? (
        <div className="space-y-4">
          {quotes.map((q) => (
            <div
              key={q.id}
              className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 hover:border-electric-300 transition"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-surface-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-electric-600 flex items-center justify-center font-bold">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-navy-900 bg-surface-100 px-2 py-0.5 rounded-lg">
                        {q.quotationNumber}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                        q.status === 'Accepted'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : q.status === 'Rejected'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : q.status === 'Expired'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {q.status}
                      </span>
                    </div>
                    <div className="text-xs text-navy-500 mt-1">
                      Request #{q.requestNumber} • Sent {q.sentAtUtc ? new Date(q.sentAtUtc).toLocaleDateString() : 'Recently'}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-navy-500 uppercase">Fixed Customer Price</div>
                  <div className="text-2xl font-black text-navy-900">
                    ₹{q.customerTotal.toLocaleString()}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                    All-Inclusive (Parts + Labour + GST)
                  </span>
                </div>
              </div>

              <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="font-bold text-navy-800 uppercase block mb-1">Approved Work Scope</span>
                  <p className="text-navy-600 bg-surface-50 p-3 rounded-xl border border-surface-200 leading-relaxed">
                    {q.scopeSummary || 'Complete service and maintenance as authorized by technical advisor.'}
                  </p>
                </div>
                <div>
                  <span className="font-bold text-navy-800 uppercase block mb-1">Advisor Review Remarks</span>
                  <p className="text-navy-600 bg-surface-50 p-3 rounded-xl border border-surface-200 leading-relaxed">
                    {q.advisorRemarks || 'Verified workshop certification and OEM-grade parts compliance.'}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-surface-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs text-navy-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-navy-400" />
                  <span>Valid until {new Date(q.validUntilUtc).toLocaleDateString()}</span>
                </span>
                <Link
                  href={`/customer/quotes/${q.id}`}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <span>View Complete Proposal</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 bg-white rounded-2xl border border-dashed border-surface-300 text-center p-8">
          <BadgeDollarSign className="w-12 h-12 text-navy-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-900">No Approved Quotations Yet</h3>
          <p className="text-xs text-navy-600 mt-1 max-w-sm mx-auto mb-4">
            When our advisors finish curating and vetting workshop bids for your service requests, the proposals will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
