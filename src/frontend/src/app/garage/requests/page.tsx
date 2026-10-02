'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Radio, MapPin, Clock, ArrowRight, ShieldCheck } from 'lucide-react';

interface GarageRequest {
  serviceRequestId: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  description: string;
  distanceKm: number;
  createdAtUtc: string;
  status: string;
}

export default function GarageRequestsPage() {
  const [requests, setRequests] = useState<GarageRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRequests() {
      const res = await apiFetch<GarageRequest[]>('/garage/requests');
      if (res.success && res.data) {
        setRequests(res.data);
      }
      setLoading(false);
    }
    loadRequests();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Dispatched Nearby Requests</h1>
          <p className="text-xs text-navy-600 mt-1">
            Service and modification requests matching your certified workshop capabilities within 10 KM.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-navy-600">Loading requests...</div>
      ) : requests.length > 0 ? (
        <div className="space-y-4">
          {requests.map((r) => (
            <div
              key={r.serviceRequestId}
              className="bg-white rounded-2xl border border-surface-200 shadow-sm p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-electric-300 transition"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-electric-600 uppercase">
                    {r.vehicleYear} {r.vehicleMake} {r.vehicleModel}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 uppercase">
                    {r.distanceKm} KM Away
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-navy-900">{r.description}</h3>
                <div className="flex items-center gap-3 mt-2 text-xs text-navy-600">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Dispatched {new Date(r.createdAtUtc).toLocaleDateString()}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="px-4 py-2 bg-electric-500 hover:bg-electric-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition">
                  Create Workshop Quote
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 bg-white rounded-2xl border border-dashed border-surface-300 text-center p-8">
          <Radio className="w-12 h-12 text-navy-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-900">No Nearby Requests Pending</h3>
          <p className="text-xs text-navy-600 mt-1 max-w-sm mx-auto">
            Dispatches from vehicle owners within your 10 KM geographic perimeter will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
