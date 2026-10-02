'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Inbox, User, Clock, CheckCircle } from 'lucide-react';

interface AdvisorRequest {
  serviceRequestId: string;
  customerId: string;
  customerName: string;
  vehicleSummary: string;
  description: string;
  quotesReceivedCount: number;
  status: string;
  createdAtUtc: string;
}

export default function AdvisorRequestsPage() {
  const [requests, setRequests] = useState<AdvisorRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRequests() {
      const res = await apiFetch<AdvisorRequest[]>('/advisor/requests');
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
          <h1 className="text-2xl font-bold text-navy-900">Customer Requests Under Review</h1>
          <p className="text-xs text-navy-600 mt-1">
            Review service requests dispatched to workshops and monitor incoming workshop bids.
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
              className="bg-white rounded-2xl border border-surface-200 shadow-sm p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-navy-900 uppercase">{r.vehicleSummary}</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 uppercase">
                    {r.status}
                  </span>
                </div>
                <p className="text-sm text-navy-700">{r.description}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-navy-600">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    <span>Customer ID: {r.customerId.slice(0, 8)}...</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Created: {new Date(r.createdAtUtc).toLocaleDateString()}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                  {r.quotesReceivedCount} Workshop Quotes
                </span>
                <button className="px-3.5 py-1.5 bg-electric-500 hover:bg-electric-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition">
                  Review Quotes
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 bg-white rounded-2xl border border-dashed border-surface-300 text-center p-8">
          <Inbox className="w-12 h-12 text-navy-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-900">No Service Requests In Review</h3>
          <p className="text-xs text-navy-600 mt-1 max-w-sm mx-auto">
            Dispatched customer requests will be routed to your advisor review workbench here.
          </p>
        </div>
      )}
    </div>
  );
}
