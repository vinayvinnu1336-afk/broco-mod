'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Calculator, ShieldCheck, ArrowRight, Building2, DollarSign } from 'lucide-react';

interface AdvisorQuote {
  quoteId: string;
  serviceRequestId: string;
  garageId: string;
  garageName: string;
  garageInternalPrice: number;
  internalCostBreakdown: string;
  recommendedCustomerPrice: number;
  status: string;
  submittedAtUtc: string;
}

export default function AdvisorQuotesPage() {
  const [quotes, setQuotes] = useState<AdvisorQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadQuotes() {
      const res = await apiFetch<AdvisorQuote[]>('/advisor/quotes');
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
          <h1 className="text-2xl font-bold text-navy-900">Workshop Bids & Margin Formulation</h1>
          <p className="text-xs text-navy-600 mt-1">
            Evaluate workshop cost structures, apply platform markup, and synthesize customer quotations.
          </p>
        </div>
      </div>

      <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 text-xs text-purple-900 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Confidential Transformation Barrier:</strong> You are viewing privileged workshop internal bids (<code className="bg-purple-100 px-1 py-0.5 rounded font-mono">GarageInternalPrice</code>). When you formulate a customer proposal, the internal breakdown is completely stripped by the backend DTO projection before delivery to the customer.
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-navy-600">Loading bids...</div>
      ) : quotes.length > 0 ? (
        <div className="space-y-4">
          {quotes.map((q) => (
            <div
              key={q.quoteId}
              className="bg-white rounded-2xl border border-surface-200 shadow-sm p-5 hover:border-purple-300 transition"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-surface-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-navy-900">{q.garageName}</h3>
                    <div className="text-xs text-navy-600">Quote ID: {q.quoteId.slice(0, 8)}...</div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-[11px] font-bold text-navy-600 uppercase">Workshop Cost</div>
                    <div className="text-lg font-bold text-navy-800">
                      ${q.garageInternalPrice.toFixed(2)}
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-purple-400" />

                  <div className="text-right">
                    <div className="text-[11px] font-bold text-purple-700 uppercase">Customer Retail Proposal</div>
                    <div className="text-2xl font-black text-purple-900">
                      ${q.recommendedCustomerPrice.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="font-bold text-navy-800 uppercase block mb-1">Confidential Cost Breakdown</span>
                  <p className="text-navy-600 bg-surface-50 p-2.5 rounded-xl border border-surface-200 font-mono text-[11px]">
                    {q.internalCostBreakdown || 'Parts: OEM Spec, Labor: Standard Diagnostic'}
                  </p>
                </div>
                <div>
                  <span className="font-bold text-navy-800 uppercase block mb-1">Advisor Calculation</span>
                  <p className="text-navy-600 bg-surface-50 p-2.5 rounded-xl border border-surface-200">
                    Recommended 15% margin applied. Retail package includes warranty backing and quality assurance.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-surface-100 flex items-center justify-end gap-3">
                <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition">
                  Formulate Customer Proposal
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 bg-white rounded-2xl border border-dashed border-surface-300 text-center p-8">
          <Calculator className="w-12 h-12 text-navy-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-900">No Workshop Bids to Review</h3>
          <p className="text-xs text-navy-600 mt-1 max-w-sm mx-auto">
            When partner garages submit quotes on dispatched requests, they will populate here for margin analysis.
          </p>
        </div>
      )}
    </div>
  );
}
