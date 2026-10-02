'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Building2, MapPin, Phone, Mail, Users, CheckCircle } from 'lucide-react';

interface GarageProfileData {
  garageId: string;
  name: string;
  email: string;
  phoneNumber: string;
  address: string;
  longitude: number;
  latitude: number;
  isActive: boolean;
  teamMembers: Array<{
    userId: string;
    fullName: string;
    email: string;
    roleName: string;
    title: string;
  }>;
}

export default function GarageProfilePage() {
  const [profile, setProfile] = useState<GarageProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const res = await apiFetch<GarageProfileData>('/garage/profile');
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
          <h1 className="text-2xl font-bold text-navy-900">Workshop Organization Profile</h1>
          <p className="text-xs text-navy-600 mt-1">
            Registered facility location, contact details, and authorized staff members.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 max-w-4xl space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-surface-200">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-2xl border border-amber-200">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-navy-900">{profile?.name || 'Central Metro Motors'}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Certified Partner Garage
              </span>
              <span className="text-xs text-navy-600 font-mono">ID: {profile?.garageId?.slice(0, 8)}...</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-surface-50 border border-surface-200">
            <div className="text-xs font-semibold text-navy-600 uppercase mb-1 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              <span>Workshop Email</span>
            </div>
            <div className="text-sm font-semibold text-navy-900">{profile?.email || 'info@centralmetro.com'}</div>
          </div>

          <div className="p-4 rounded-xl bg-surface-50 border border-surface-200">
            <div className="text-xs font-semibold text-navy-600 uppercase mb-1 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              <span>Contact Hotline</span>
            </div>
            <div className="text-sm font-semibold text-navy-900">{profile?.phoneNumber || '+1 555 987 6543'}</div>
          </div>

          <div className="p-4 rounded-xl bg-surface-50 border border-surface-200">
            <div className="text-xs font-semibold text-navy-600 uppercase mb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              <span>Physical Facility Address</span>
            </div>
            <div className="text-sm font-semibold text-navy-900">{profile?.address || '100 Performance Way, Metro City'}</div>
          </div>

          <div className="p-4 rounded-xl bg-surface-50 border border-surface-200">
            <div className="text-xs font-semibold text-navy-600 uppercase mb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              <span>PostGIS Spatial Coordinates</span>
            </div>
            <div className="text-sm font-mono font-semibold text-navy-900">
              Lng: {profile?.longitude.toFixed(4) || '77.5946'}, Lat: {profile?.latitude.toFixed(4) || '12.9716'}
            </div>
          </div>
        </div>

        {/* Authorized Team Members */}
        <div className="pt-4 border-t border-surface-200">
          <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-electric-600" />
            <span>Authorized Workshop Team</span>
          </h3>

          <div className="divide-y divide-surface-100 border border-surface-200 rounded-xl overflow-hidden">
            {profile?.teamMembers && profile.teamMembers.length > 0 ? (
              profile.teamMembers.map((m) => (
                <div key={m.userId} className="p-3.5 bg-surface-50 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-navy-900">{m.fullName}</div>
                    <div className="text-xs text-navy-600">{m.email}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-navy-800 bg-white px-2.5 py-1 rounded border border-surface-200 block">
                      {m.roleName}
                    </span>
                    <span className="text-[10px] text-navy-600 block mt-0.5">{m.title}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-xs text-navy-600 bg-surface-50">
                1 active team member: Marcus Sterling (Owner & Master Tech)
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
