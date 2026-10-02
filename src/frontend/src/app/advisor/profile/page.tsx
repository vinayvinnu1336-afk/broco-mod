'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { UserCheck, Mail, Award, Shield, CheckCircle2 } from 'lucide-react';

interface AdvisorProfileData {
  advisorId: string;
  userId: string;
  fullName: string;
  email: string;
  employeeCode: string;
  specialization: string;
  maxAssignedRequests: number;
}

export default function AdvisorProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<AdvisorProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const res = await apiFetch<AdvisorProfileData>('/advisor/profile');
      if (res.success && res.data) {
        setProfile(res.data);
      }
      setLoading(false);
    }
    loadProfile();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Technical Advisor Profile</h1>
          <p className="text-xs text-navy-600 mt-1">
            Credentialed advisor specialization, employee identity, and assignment workload capacity.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 max-w-3xl space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-surface-200">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-2xl border border-purple-200">
            <UserCheck className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-navy-900">{profile?.fullName || user?.fullName || 'Alex Vance'}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                Lead Technical Advisor
              </span>
              <span className="text-xs text-navy-600 font-mono">Code: {profile?.employeeCode || 'ADV-1001'}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-surface-50 border border-surface-200">
            <div className="text-xs font-semibold text-navy-600 uppercase mb-1 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-navy-600" />
              <span>Official Email</span>
            </div>
            <div className="text-sm font-semibold text-navy-900">{profile?.email || user?.email || 'advisor@brocomod.com'}</div>
          </div>

          <div className="p-4 rounded-xl bg-surface-50 border border-surface-200">
            <div className="text-xs font-semibold text-navy-600 uppercase mb-1 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-navy-600" />
              <span>Domain Specialization</span>
            </div>
            <div className="text-sm font-semibold text-navy-900">{profile?.specialization || 'European Performance Tuning'}</div>
          </div>

          <div className="p-4 rounded-xl bg-surface-50 border border-surface-200">
            <div className="text-xs font-semibold text-navy-600 uppercase mb-1 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-navy-600" />
              <span>Max Concurrent Requests</span>
            </div>
            <div className="text-sm font-semibold text-navy-900">{profile?.maxAssignedRequests || 50} Requests</div>
          </div>

          <div className="p-4 rounded-xl bg-surface-50 border border-surface-200">
            <div className="text-xs font-semibold text-navy-600 uppercase mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-navy-600" />
              <span>Vetting Authority</span>
            </div>
            <div className="text-sm font-semibold text-navy-900">Customer Quote Authorization</div>
          </div>
        </div>
      </div>
    </div>
  );
}
