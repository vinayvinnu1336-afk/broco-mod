'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { CheckSquare, Building2, Car, Clock } from 'lucide-react';

interface AdvisorAssignment {
  serviceRequestId: string;
  garageId: string;
  garageName: string;
  customerFacingPrice: number;
  status: string;
  assignedAtUtc: string;
}

export default function AdvisorAssignmentsPage() {
  const [assignments, setAssignments] = useState<AdvisorAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAssignments() {
      const res = await apiFetch<AdvisorAssignment[]>('/advisor/assignments');
      if (res.success && res.data) {
        setAssignments(res.data);
      }
      setLoading(false);
    }
    loadAssignments();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Garage Job Assignments</h1>
          <p className="text-xs text-navy-600 mt-1">
            Confirmed repair and modification contracts assigned to partner workshops.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-navy-600">Loading assignments...</div>
      ) : assignments.length > 0 ? (
        <div className="space-y-4">
          {assignments.map((a) => (
            <div
              key={a.serviceRequestId}
              className="bg-white rounded-2xl border border-surface-200 shadow-sm p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-navy-900">Assigned: {a.garageName}</h3>
                  <div className="text-xs text-navy-600">Request ID: {a.serviceRequestId.slice(0, 8)}...</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-bold text-navy-600 uppercase">Customer Contract Value</div>
                <div className="text-lg font-black text-navy-900">${a.customerFacingPrice.toFixed(2)}</div>
                <span className="text-[10px] uppercase font-bold text-emerald-600">{a.status}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 bg-white rounded-2xl border border-dashed border-surface-300 text-center p-8">
          <CheckSquare className="w-12 h-12 text-navy-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-900">No Active Assignments</h3>
          <p className="text-xs text-navy-600 mt-1 max-w-sm mx-auto">
            Once customers accept approved quotations, workshop dispatch assignments will be tracked here.
          </p>
        </div>
      )}
    </div>
  );
}
