'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { 
  Car, 
  FileText, 
  BadgeDollarSign, 
  PlusCircle, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface CustomerDashboardData {
  customerId: string;
  customerName: string;
  activeRequestsCount: number;
  availableQuotesCount: number;
  registeredVehiclesCount: number;
  recentRequests: Array<{
    id: string;
    vehicleMake: string;
    vehicleModel: string;
    vehicleYear: number;
    description: string;
    status: string;
    createdAtUtc: string;
    quotesReceivedCount: number;
  }>;
  pendingQuotes: Array<{
    id: string;
    serviceRequestId: string;
    vehicleSummary: string;
    customerFacingPrice: number;
    scopeSummary: string;
    status: string;
    createdAtUtc: string;
  }>;
}

export default function CustomerDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<CustomerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const res = await apiFetch<CustomerDashboardData>('/customer/dashboard');
      if (res.success && res.data) {
        setData(res.data);
      }
      setLoading(false);
    }
    loadDashboard();
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Hero Card */}
      <div className="bg-gradient-to-r from-navy-900 to-navy-800 rounded-2xl p-6 sm:p-8 text-white shadow-sm border border-navy-700 relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-electric-500/20 text-electric-300 border border-electric-500/30 text-xs font-semibold uppercase tracking-wider mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verified Customer Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            Welcome back, {user?.fullName || data?.customerName || 'Valued Client'}
          </h1>
          <p className="text-surface-300 text-sm leading-relaxed mb-6">
            Review service requests, view curated vehicle modification proposals from verified workshops within 10 KM, and track your vehicle maintenance history.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/customer/vehicles"
              className="px-4 py-2.5 bg-electric-500 hover:bg-electric-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-md shadow-electric-500/30 transition"
            >
              <Car className="w-4 h-4" />
              <span>Manage Vehicles</span>
            </Link>
            <Link
              href="/customer/quotes"
              className="px-4 py-2.5 bg-navy-700 hover:bg-navy-600 text-surface-100 rounded-xl text-sm font-semibold flex items-center gap-2 transition"
            >
              <BadgeDollarSign className="w-4 h-4" />
              <span>View Quotations</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-surface-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-navy-600 uppercase tracking-wider">Registered Vehicles</div>
            <div className="text-3xl font-extrabold text-navy-900 mt-1">
              {loading ? '—' : data?.registeredVehiclesCount ?? 1}
            </div>
            <div className="text-xs text-navy-600 mt-1 flex items-center gap-1">
              <span>Primary: BMW M340i</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-electric-600 flex items-center justify-center">
            <Car className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-surface-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-navy-600 uppercase tracking-wider">Active Service Requests</div>
            <div className="text-3xl font-extrabold text-navy-900 mt-1">
              {loading ? '—' : data?.activeRequestsCount ?? 0}
            </div>
            <div className="text-xs text-navy-600 mt-1">Within 10 KM Workshop Radius</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-surface-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-navy-600 uppercase tracking-wider">Approved Quotations</div>
            <div className="text-3xl font-extrabold text-navy-900 mt-1">
              {loading ? '—' : data?.availableQuotesCount ?? 0}
            </div>
            <div className="text-xs text-navy-600 mt-1">Sanitized Customer Pricing</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <BadgeDollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Split Section: Recent Requests & Available Quotes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Requests */}
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-navy-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-electric-600" />
              <span>Recent Service Requests</span>
            </h2>
            <Link href="/customer/requests" className="text-xs font-semibold text-electric-600 hover:underline flex items-center gap-1">
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-navy-600">Loading requests...</div>
          ) : data?.recentRequests && data.recentRequests.length > 0 ? (
            <div className="divide-y divide-surface-100">
              {data.recentRequests.map((req) => (
                <Link
                  key={req.id}
                  href={`/customer/requests/${req.id}`}
                  className="py-3 flex items-center justify-between hover:bg-surface-50 transition-colors px-2 -mx-2 rounded-xl group"
                >
                  <div>
                    <div className="text-sm font-bold text-navy-900 group-hover:text-electric-600 transition-colors">
                      {req.vehicleYear} {req.vehicleMake} {req.vehicleModel}
                    </div>
                    <div className="text-xs text-navy-600 line-clamp-1">{req.description}</div>
                  </div>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700">
                    {req.status}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-navy-600 bg-surface-50 rounded-xl border border-dashed border-surface-300">
              No active service requests right now. Create one to receive matched garage proposals.
            </div>
          )}
        </div>

        {/* Customer Quotations */}
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-navy-900 flex items-center gap-2">
              <BadgeDollarSign className="w-5 h-5 text-amber-600" />
              <span>Pending Customer Quotations</span>
            </h2>
            <Link href="/customer/quotes" className="text-xs font-semibold text-electric-600 hover:underline flex items-center gap-1">
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-navy-700 mb-4 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-electric-600 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Pricing Integrity Guaranteed:</strong> All quotations presented here represent advisor-verified final customer pricing with complete scope clarity. Internal workshop costs remain isolated.
            </span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-navy-600">Loading quotations...</div>
          ) : data?.pendingQuotes && data.pendingQuotes.length > 0 ? (
            <div className="divide-y divide-surface-100">
              {data.pendingQuotes.map((q) => (
                <div key={q.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-navy-900">{q.vehicleSummary}</div>
                    <div className="text-xs text-navy-600 line-clamp-1">{q.scopeSummary}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-extrabold text-navy-900">
                      ${q.customerFacingPrice.toFixed(2)}
                    </div>
                    <span className="text-[10px] uppercase font-bold text-amber-600">{q.status}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-navy-600 bg-surface-50 rounded-xl border border-dashed border-surface-300">
              No quotations awaiting your review. Once advisors curate quotes from eligible garages, they will appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
