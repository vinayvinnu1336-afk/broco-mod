'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { FileText, Clock, MapPin, CheckCircle, Plus } from 'lucide-react';

interface CustomerRequest {
  id: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  description: string;
  status: string;
  createdAtUtc: string;
  quotesReceivedCount: number;
}

export default function CustomerRequestsPage() {
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRequests() {
      const res = await apiFetch<CustomerRequest[]>('/customer/requests');
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
          <h1 className="text-2xl font-bold text-navy-900">Service & Tuning Requests</h1>
          <p className="text-xs text-navy-600 mt-1">
            Active repair and modification requests broadcast to verified garages within 10 KM.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-navy-600">Loading service requests...</div>
      ) : requests.length > 0 ? (
        <div className="space-y-4">
          {requests.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-2xl border border-surface-200 shadow-sm p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-electric-600 uppercase">
                    {r.vehicleYear} {r.vehicleMake} {r.vehicleModel}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 uppercase">
                    {r.status}
                  </span>
                </div>
                <p className="text-sm font-medium text-navy-900">{r.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-navy-600">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Submitted {new Date(r.createdAtUtc).toLocaleDateString()}</span>
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>{r.quotesReceivedCount} Workshop Quotes Received</span>
                  </span>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <span className="px-3 py-1.5 bg-surface-100 text-navy-800 text-xs font-semibold rounded-xl inline-block">
                  Under Technical Review
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 bg-white rounded-2xl border border-dashed border-surface-300 text-center p-8">
          <FileText className="w-12 h-12 text-navy-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-900">No Service Requests Active</h3>
          <p className="text-xs text-navy-600 mt-1 max-w-sm mx-auto mb-4">
            Once you submit a service request, it will be dispatched to nearby garages within the 10 KM radius.
          </p>
        </div>
      )}
    </div>
  );
}
