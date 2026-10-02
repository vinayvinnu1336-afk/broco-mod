'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Building2, MapPin, Phone, Mail, Users, CheckCircle } from 'lucide-react';

interface AdminGarage {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  address: string;
  isActive: boolean;
  totalStaffCount: number;
  createdAtUtc: string;
}

export default function AdminGaragesPage() {
  const [garages, setGarages] = useState<AdminGarage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGarages() {
      const res = await apiFetch<AdminGarage[]>('/admin/garages');
      if (res.success && res.data) {
        setGarages(res.data);
      }
      setLoading(false);
    }
    loadGarages();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Partner Workshop Registry</h1>
          <p className="text-xs text-navy-600 mt-1">
            Registered certified repair and tuning workshops participating in 10 KM proximity dispatches.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-navy-600">Loading garages network...</div>
      ) : garages.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {garages.map((g) => (
            <div
              key={g.id}
              className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-navy-900">{g.name}</h3>
                  <div className="text-xs text-navy-600 font-mono">Garage ID: {g.id.slice(0, 8)}...</div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Certified Active
                </span>
              </div>

              <div className="space-y-2 text-xs text-navy-700 pt-2 border-t border-surface-100">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-navy-600 flex-shrink-0" />
                  <span>{g.address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-navy-600 flex-shrink-0" />
                  <span>{g.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-navy-600 flex-shrink-0" />
                  <span>{g.phoneNumber}</span>
                </div>
                <div className="flex items-center gap-2 text-electric-600 font-semibold pt-1">
                  <Users className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{g.totalStaffCount} Authorized Staff Members</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 bg-white rounded-2xl border border-dashed border-surface-300 text-center p-8">
          <Building2 className="w-12 h-12 text-navy-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-900">No Garages Registered</h3>
        </div>
      )}
    </div>
  );
}
