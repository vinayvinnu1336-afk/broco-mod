'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { FileSpreadsheet, ShieldAlert, Clock, Tag } from 'lucide-react';

interface GarageQuote {
  id: string;
  serviceRequestId: string;
  garageInternalPrice: number;
  internalCostBreakdown: string;
  garageNotes: string;
  estimatedDurationHours: number;
  status: string;
  createdAtUtc: string;
}

export default function GarageQuotesPage() {
  const [quotes, setQuotes] = useState<GarageQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadQuotes() {
      const res = await apiFetch<GarageQuote[]>('/garage/quotes');
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
          <h1 className="text-2xl font-bold text-navy-900">Submitted Workshop Quotations</h1>
          <p className="text-xs text-navy-600 mt-1">
            Internal pricing bids submitted to BroCo Mod Technical Advisors.
          </p>
        </div>
      </div>

      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Confidential Commercial Bids:</strong> These quotations and your workshop part/labor cost breakdown are strictly private between your garage and BroCo Mod Technical Advisors. Neither customers nor competitor garages can ever view your internal margins.
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-navy-600">Loading submitted quotations...</div>
      ) : quotes.length > 0 ? (
        <div className="space-y-4">
          {quotes.map((q) => (
            <div
              key={q.id}
              className="bg-white rounded-2xl border border-surface-200 shadow-sm p-5 hover:border-surface-300 transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-100">
                <div>
                  <div className="text-xs text-navy-600 font-mono">Quotation #{q.id.slice(0, 8)}</div>
                  <div className="text-xs text-navy-600 mt-0.5">
                    Estimated Duration: <strong className="text-navy-900">{q.estimatedDurationHours} Hours</strong>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-navy-600 uppercase">Internal Workshop Bid</div>
                  <div className="text-2xl font-black text-navy-900">
                    ${q.garageInternalPrice.toFixed(2)}
                  </div>
                  <span className="text-[10px] font-bold uppercase rounded bg-amber-50 text-amber-700 px-2 py-0.5">
                    {q.status}
                  </span>
                </div>
              </div>

              <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="font-bold text-navy-800 uppercase block mb-1">Cost Breakdown</span>
                  <p className="text-navy-600 bg-surface-50 p-2.5 rounded-xl border border-surface-200">
                    {q.internalCostBreakdown || 'Parts: OEM Spec, Labor: Standard Diagnostic'}
                  </p>
                </div>
                <div>
                  <span className="font-bold text-navy-800 uppercase block mb-1">Technician Notes</span>
                  <p className="text-navy-600 bg-surface-50 p-2.5 rounded-xl border border-surface-200">
                    {q.garageNotes || 'No specific notes entered.'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 bg-white rounded-2xl border border-dashed border-surface-300 text-center p-8">
          <FileSpreadsheet className="w-12 h-12 text-navy-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-900">No Workshop Quotations Submitted</h3>
          <p className="text-xs text-navy-600 mt-1 max-w-sm mx-auto">
            Review dispatched service requests and submit your internal cost estimations to BroCo Mod advisors.
          </p>
        </div>
      )}
    </div>
  );
}
