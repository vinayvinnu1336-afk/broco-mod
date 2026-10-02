'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { User, Mail, Phone, MapPin, ShieldCheck, Calendar } from 'lucide-react';

interface CustomerProfileData {
  customerId: string;
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string;
  preferredContactMethod: string;
}

export default function CustomerProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CustomerProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const res = await apiFetch<CustomerProfileData>('/customer/profile');
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
          <h1 className="text-2xl font-bold text-navy-900">Customer Account Profile</h1>
          <p className="text-xs text-navy-600 mt-1">Manage personal contact details and communication preferences.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 max-w-3xl">
        <div className="flex items-center gap-4 pb-6 border-b border-surface-200">
          <div className="w-16 h-16 rounded-2xl bg-electric-500/10 text-electric-600 flex items-center justify-center font-bold text-2xl border border-electric-500/20">
            {profile?.fullName ? profile.fullName[0] : user?.fullName ? user.fullName[0] : 'C'}
          </div>
          <div>
            <h2 className="text-lg font-bold text-navy-900">{profile?.fullName || user?.fullName || 'Customer'}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active Client
              </span>
              <span className="text-xs text-navy-600 font-mono">ID: {profile?.customerId?.slice(0, 8)}...</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-6">
          <div className="p-4 rounded-xl bg-surface-50 border border-surface-200">
            <div className="text-xs font-semibold text-navy-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-navy-600" />
              <span>Email Address</span>
            </div>
            <div className="text-sm font-semibold text-navy-900">{profile?.email || user?.email}</div>
          </div>

          <div className="p-4 rounded-xl bg-surface-50 border border-surface-200">
            <div className="text-xs font-semibold text-navy-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-navy-600" />
              <span>Contact Number</span>
            </div>
            <div className="text-sm font-semibold text-navy-900">{profile?.phoneNumber || user?.phoneNumber || '+1 555 000 0004'}</div>
          </div>

          <div className="p-4 rounded-xl bg-surface-50 border border-surface-200">
            <div className="text-xs font-semibold text-navy-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-navy-600" />
              <span>Primary Address</span>
            </div>
            <div className="text-sm font-semibold text-navy-900">{profile?.address || '45 Skyline Boulevard, Suite 12'}</div>
          </div>

          <div className="p-4 rounded-xl bg-surface-50 border border-surface-200">
            <div className="text-xs font-semibold text-navy-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-navy-600" />
              <span>Preferred Contact Method</span>
            </div>
            <div className="text-sm font-semibold text-navy-900">{profile?.preferredContactMethod || 'Email'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
