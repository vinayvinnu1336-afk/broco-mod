'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { 
  Inbox, 
  Calculator, 
  CheckSquare, 
  ShieldCheck, 
  Clock, 
  ArrowRight,
  TrendingUp,
  UserCheck
} from 'lucide-react';

interface AdvisorDashboardData {
  advisorId: string;
  advisorName: string;
  pendingReviewsCount: number;
  activeRequestsCount: number;
  assignedGaragesCount: number;
  requestsUnderReview: Array<{
    serviceRequestId: string;
    customerId: string;
    customerName: string;
    vehicleSummary: string;
    description: string;
    quotesReceivedCount: number;
    status: string;
    createdAtUtc: string;
  }>;
  pendingQuoteApprovals: Array<{
    quoteId: string;
    serviceRequestId: string;
    garageId: string;
    garageName: string;
    garageInternalPrice: number;
    internalCostBreakdown: string;
    recommendedCustomerPrice: number;
    status: string;
    submittedAtUtc: string;
  }>;
}

export default function AdvisorDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AdvisorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const res = await apiFetch<AdvisorDashboardData>('/advisor/dashboard');
      if (res.success && res.data) {
        setData(res.data);
      }
      setLoading(false);
    }
    loadDashboard();
  }, []);

  return (
    <div className="space-y-6">
      {/* Advisor Welcome */}
      <div className="bg-gradient-to-r from-navy-900 to-navy-800 rounded-2xl p-6 sm:p-8 text-white shadow-sm border border-navy-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold uppercase tracking-wider mb-3">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Technical Advisor Console</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
              Advisor {user?.fullName || data?.advisorName || 'Alex Vance'}
            </h1>
            <p className="text-surface-300 text-sm max-w-xl">
              Centralized advisor clearinghouse. Evaluate incoming repair requests, compare workshop bids, formulate customer quotations, and manage garage assignments.
            </p>
          </div>

          <div className="bg-navy-800/80 p-4 rounded-xl border border-navy-700 text-xs text-surface-200">
            <span className="text-surface-300 block mb-0.5">Specialization Focus</span>
            <span className="font-bold text-white text-sm block">European Performance</span>
            <span className="text-purple-400 font-mono text-[11px] block">ADV-1001 • Max Cap: 50</span>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-surface-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-navy-600 uppercase tracking-wider">Pending Quote Reviews</div>
            <div className="text-3xl font-extrabold text-navy-900 mt-1">
              {loading ? '—' : data?.pendingReviewsCount ?? 0}
            </div>
            <div className="text-xs text-navy-600 mt-1">Requiring Margin Application</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Calculator className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-surface-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-navy-600 uppercase tracking-wider">Active Requests</div>
            <div className="text-3xl font-extrabold text-navy-900 mt-1">
              {loading ? '—' : data?.activeRequestsCount ?? 0}
            </div>
            <div className="text-xs text-navy-600 mt-1">Dispatched to Garages</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-electric-600 flex items-center justify-center">
            <Inbox className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-surface-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-navy-600 uppercase tracking-wider">Available Garages</div>
            <div className="text-3xl font-extrabold text-navy-900 mt-1">
              {loading ? '—' : data?.assignedGaragesCount ?? 1}
            </div>
            <div className="text-xs text-navy-600 mt-1">In Certified Network</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckSquare className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Two-Tier Architecture Notice */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-xs text-purple-900 flex items-start gap-3">
        <TrendingUp className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Quotation Transformation Protocol:</strong> As an Advisor, you possess privileged visibility into the workshop&apos;s internal pricing (<code className="bg-purple-100 px-1 py-0.5 rounded font-mono">GarageQuote</code>). Your responsibility is to review technical feasibility, apply standard advisor markup, and issue the public sanitized customer proposal (<code className="bg-purple-100 px-1 py-0.5 rounded font-mono">CustomerQuotation</code>).
        </div>
      </div>

      {/* Tables Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requests Review */}
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-navy-900 flex items-center gap-2">
              <Inbox className="w-5 h-5 text-purple-600" />
              <span>Customer Requests In Review</span>
            </h2>
            <Link href="/advisor/requests" className="text-xs font-semibold text-electric-600 hover:underline flex items-center gap-1">
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-navy-600">Loading requests...</div>
          ) : data?.requestsUnderReview && data.requestsUnderReview.length > 0 ? (
            <div className="divide-y divide-surface-100">
              {data.requestsUnderReview.map((r) => (
                <div key={r.serviceRequestId} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-navy-900">{r.vehicleSummary}</div>
                    <div className="text-xs text-navy-600 line-clamp-1">{r.description}</div>
                  </div>
                  <span className="text-xs font-bold text-navy-700 bg-surface-100 px-2 py-0.5 rounded">
                    {r.quotesReceivedCount} Quotes Received
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-navy-600 bg-surface-50 rounded-xl border border-dashed border-surface-300">
              No service requests pending review.
            </div>
          )}
        </div>

        {/* Quotes & Margins */}
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-navy-900 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-electric-600" />
              <span>Workshop Bids for Margin Review</span>
            </h2>
            <Link href="/advisor/quotes" className="text-xs font-semibold text-electric-600 hover:underline flex items-center gap-1">
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-navy-600">Loading bids...</div>
          ) : data?.pendingQuoteApprovals && data.pendingQuoteApprovals.length > 0 ? (
            <div className="divide-y divide-surface-100">
              {data.pendingQuoteApprovals.map((q) => (
                <div key={q.quoteId} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-navy-900">{q.garageName}</div>
                    <div className="text-xs text-navy-600">
                      Internal: ${q.garageInternalPrice.toFixed(2)} → Recommended: ${q.recommendedCustomerPrice.toFixed(2)}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-50 text-purple-700">
                    {q.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-navy-600 bg-surface-50 rounded-xl border border-dashed border-surface-300">
              No workshop quotations requiring margin application.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
