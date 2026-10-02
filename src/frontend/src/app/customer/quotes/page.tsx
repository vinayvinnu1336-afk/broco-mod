'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { BadgeDollarSign, ShieldCheck, CheckCircle2, Clock, Car, ChevronRight } from 'lucide-react';

interface CustomerQuote {
  id: string;
  serviceRequestId: string;
  vehicleSummary: string;
  customerFacingPrice: number;
  scopeSummary: string;
  advisorNotes: string;
  status: string;
  createdAtUtc: string;
}

export default function CustomerQuotesPage() {
  const [quotes, setQuotes] = useState<CustomerQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadQuotes() {
      const res = await apiFetch<CustomerQuote[]>('/customer/quotes');
      if (res.success && res.data) {
        setQuotes(res.data);
      }
      setLoading(false);
    }
    loadQuotes();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Approved Quotations</h1>
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
        <div className="py-12 text-center text-sm text-navy-600">Loading quotations...</div>
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
                    <Car className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-navy-900">{q.vehicleSummary}</h3>
                    <div className="text-xs text-navy-600">Quotation ID: {q.id.slice(0, 8)}...</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-navy-600 uppercase">Fixed Customer Price</div>
                  <div className="text-2xl font-black text-navy-900">
                    ${q.customerFacingPrice.toFixed(2)}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                    All-Inclusive (Parts + Labor)
                  </span>
                </div>
              </div>

              <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="font-bold text-navy-800 uppercase block mb-1">Approved Work Scope</span>
                  <p className="text-navy-600 bg-surface-50 p-3 rounded-xl border border-surface-200 leading-relaxed">
                    {q.scopeSummary || 'Complete inspection and maintenance as authorized by technical advisor.'}
                  </p>
                </div>
                <div>
                  <span className="font-bold text-navy-800 uppercase block mb-1">Advisor Review Notes</span>
                  <p className="text-navy-600 bg-surface-50 p-3 rounded-xl border border-surface-200 leading-relaxed">
                    {q.advisorNotes || 'Verified garage certification and OEM-grade parts compliance.'}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-surface-100 flex items-center justify-between">
                <span className="text-xs text-navy-600 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Valid for 7 days</span>
                </span>
                <button className="px-4 py-2 bg-electric-500 hover:bg-electric-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition">
                  Accept Proposal
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 bg-white rounded-2xl border border-dashed border-surface-300 text-center p-8">
          <BadgeDollarSign className="w-12 h-12 text-navy-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-900">No Pending Quotations</h3>
          <p className="text-xs text-navy-600 mt-1 max-w-sm mx-auto mb-4">
            When our advisors finish curating and vetting workshop bids for your service requests, the proposals will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
