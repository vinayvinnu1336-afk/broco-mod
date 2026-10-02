'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { UserCheck, Award, Mail, Shield, CheckCircle } from 'lucide-react';

interface AdminAdvisor {
  id: string;
  fullName: string;
  email: string;
  employeeCode: string;
  specialization: string;
  isActive: boolean;
  createdAtUtc: string;
}

export default function AdminAdvisorsPage() {
  const [advisors, setAdvisors] = useState<AdminAdvisor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAdvisors() {
      const res = await apiFetch<AdminAdvisor[]>('/admin/advisors');
      if (res.success && res.data) {
        setAdvisors(res.data);
      }
      setLoading(false);
    }
    loadAdvisors();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Technical Service Advisors</h1>
          <p className="text-xs text-navy-600 mt-1">
            Certified technical advisors curating and vetting customer proposals.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-navy-600">Loading advisors roster...</div>
      ) : advisors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {advisors.map((a) => (
            <div
              key={a.id}
              className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-navy-900">{a.fullName}</h3>
                  <div className="text-xs text-navy-600 font-mono">Code: {a.employeeCode}</div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">
                  Certified Lead
                </span>
              </div>

              <div className="space-y-2 text-xs text-navy-700 pt-2 border-t border-surface-100">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-navy-600 flex-shrink-0" />
                  <span>{a.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="w-3.5 h-3.5 text-navy-600 flex-shrink-0" />
                  <span>Specialization: {a.specialization}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 bg-white rounded-2xl border border-dashed border-surface-300 text-center p-8">
          <UserCheck className="w-12 h-12 text-navy-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-900">No Advisors Registered</h3>
        </div>
      )}
    </div>
  );
}
