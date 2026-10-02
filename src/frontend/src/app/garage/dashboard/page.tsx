'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { 
  Building2, 
  Radio, 
  FileSpreadsheet, 
  Wrench, 
  ShieldAlert, 
  CheckCircle2, 
  MapPin, 
  ArrowRight 
} from 'lucide-react';

interface GarageDashboardData {
  garageId: string;
  garageName: string;
  newRequestsCount: number;
  submittedQuotesCount: number;
  activeJobsCount: number;
  availableRequests: Array<{
    serviceRequestId: string;
    vehicleMake: string;
    vehicleModel: string;
    vehicleYear: number;
    description: string;
    distanceKm: number;
    createdAtUtc: string;
    status: string;
  }>;
  submittedQuotes: Array<{
    id: string;
    serviceRequestId: string;
    garageInternalPrice: number;
    internalCostBreakdown: string;
    garageNotes: string;
    estimatedDurationHours: number;
    status: string;
    createdAtUtc: string;
  }>;
}

export default function GarageDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<GarageDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const res = await apiFetch<GarageDashboardData>('/garage/dashboard');
      if (res.success && res.data) {
        setData(res.data);
      }
      setLoading(false);
    }
    loadDashboard();
  }, []);

  return (
    <div className="space-y-6">
      {/* Workshop Header */}
      <div className="bg-gradient-to-r from-navy-900 to-navy-800 rounded-2xl p-6 sm:p-8 text-white shadow-sm border border-navy-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold uppercase tracking-wider mb-3">
              <Building2 className="w-3.5 h-3.5" />
              <span>Verified Partner Workshop</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
              {data?.garageName || 'Central Metro Motors'}
            </h1>
            <p className="text-surface-300 text-sm max-w-xl">
              Certified Workshop Operating Terminal. View requests dispatched within your 10 KM coverage area and submit direct internal workshop quotations.
            </p>
          </div>

          <div className="bg-navy-800/80 p-4 rounded-xl border border-navy-700 text-xs text-surface-200">
            <span className="text-surface-300 block mb-0.5">Workshop Operator</span>
            <span className="font-bold text-white text-sm block">{user?.fullName}</span>
            <span className="text-amber-400 font-mono text-[11px] block">{user?.garageRole || 'GARAGE_OWNER'}</span>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-surface-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-navy-600 uppercase tracking-wider">Dispatched Requests</div>
            <div className="text-3xl font-extrabold text-navy-900 mt-1">
              {loading ? '—' : data?.newRequestsCount ?? 0}
            </div>
            <div className="text-xs text-navy-600 mt-1">Within 10 KM Proximity</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-electric-600 flex items-center justify-center">
            <Radio className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-surface-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-navy-600 uppercase tracking-wider">Submitted Quotations</div>
            <div className="text-3xl font-extrabold text-navy-900 mt-1">
              {loading ? '—' : data?.submittedQuotesCount ?? 0}
            </div>
            <div className="text-xs text-navy-600 mt-1">Under Advisor Review</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-surface-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-navy-600 uppercase tracking-wider">Confirmed Repair Jobs</div>
            <div className="text-3xl font-extrabold text-navy-900 mt-1">
              {loading ? '—' : data?.activeJobsCount ?? 0}
            </div>
            <div className="text-xs text-navy-600 mt-1">Advisor Assigned</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Wrench className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Workshop Data Isolation Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Strict Workshop Data Isolation:</strong> You are strictly authenticated to view only requests and quotations belonging to <strong>{data?.garageName || 'your workshop'}</strong>. Competitor bids, customer identity tokens, and platform broker margins are strictly restricted.
        </div>
      </div>

      {/* Tables Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Nearby Requests */}
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-navy-900 flex items-center gap-2">
              <Radio className="w-5 h-5 text-electric-600" />
              <span>Available 10 KM Requests</span>
            </h2>
            <Link href="/garage/requests" className="text-xs font-semibold text-electric-600 hover:underline flex items-center gap-1">
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-navy-600">Loading requests...</div>
          ) : data?.availableRequests && data.availableRequests.length > 0 ? (
            <div className="divide-y divide-surface-100">
              {data.availableRequests.map((req) => (
                <div key={req.serviceRequestId} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-navy-900">
                      {req.vehicleYear} {req.vehicleMake} {req.vehicleModel}
                    </div>
                    <div className="text-xs text-navy-600 line-clamp-1">{req.description}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-navy-700 bg-surface-100 px-2 py-0.5 rounded">
                      {req.distanceKm} KM
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-navy-600 bg-surface-50 rounded-xl border border-dashed border-surface-300">
              No new requests available within your immediate radius.
            </div>
          )}
        </div>

        {/* Submitted Quotes */}
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-navy-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-amber-600" />
              <span>Our Internal Quotations</span>
            </h2>
            <Link href="/garage/quotes" className="text-xs font-semibold text-electric-600 hover:underline flex items-center gap-1">
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-navy-600">Loading quotes...</div>
          ) : data?.submittedQuotes && data.submittedQuotes.length > 0 ? (
            <div className="divide-y divide-surface-100">
              {data.submittedQuotes.map((q) => (
                <div key={q.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-navy-900">
                      Internal Cost: ${q.garageInternalPrice.toFixed(2)}
                    </div>
                    <div className="text-xs text-navy-600 line-clamp-1">{q.internalCostBreakdown}</div>
                  </div>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700">
                    {q.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-navy-600 bg-surface-50 rounded-xl border border-dashed border-surface-300">
              No quotations submitted yet. Review available customer requests to submit workshop bids.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
