'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Settings, Shield, MapPin, KeyRound, Lock, Clock } from 'lucide-react';

interface AdminSettings {
  defaultSearchRadiusKm: number;
  maxSearchRadiusKm: number;
  maxFailedLoginAttempts: number;
  accountLockoutMinutes: number;
  jwtExpiryMinutes: number;
  refreshTokenExpiryDays: number;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      const res = await apiFetch<AdminSettings>('/admin/settings');
      if (res.success && res.data) {
        setSettings(res.data);
      }
      setLoading(false);
    }
    loadSettings();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">System Parameters & Security Policies</h1>
        <p className="text-xs text-navy-600 mt-1">
          Configurable operational parameters and identity protection rules.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        {/* Proximity Matching Settings */}
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-surface-100">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-electric-600 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-navy-900">Geospatial Radial Dispatch</h3>
              <p className="text-xs text-navy-600">PostGIS proximity algorithms</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-3 bg-surface-50 rounded-xl border border-surface-200">
              <span className="text-navy-700 font-medium">Default Matching Perimeter</span>
              <span className="font-bold text-navy-900 font-mono">
                {settings?.defaultSearchRadiusKm ?? 10.0} KM
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-surface-50 rounded-xl border border-surface-200">
              <span className="text-navy-700 font-medium">Maximum Expandable Perimeter</span>
              <span className="font-bold text-navy-900 font-mono">
                {settings?.maxSearchRadiusKm ?? 50.0} KM
              </span>
            </div>
          </div>
        </div>

        {/* Security & Authentication Policies */}
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-surface-100">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-navy-900">Brute-Force & Lockout Controls</h3>
              <p className="text-xs text-navy-600">Account defense policies</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-3 bg-surface-50 rounded-xl border border-surface-200">
              <span className="text-navy-700 font-medium">Max Failed Login Attempts</span>
              <span className="font-bold text-navy-900 font-mono">
                {settings?.maxFailedLoginAttempts ?? 5} Attempts
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-surface-50 rounded-xl border border-surface-200">
              <span className="text-navy-700 font-medium">Account Lockout Penalty</span>
              <span className="font-bold text-navy-900 font-mono">
                {settings?.accountLockoutMinutes ?? 15} Minutes
              </span>
            </div>
          </div>
        </div>

        {/* Token Lifecycles */}
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4 col-span-1 md:col-span-2">
          <div className="flex items-center gap-3 pb-3 border-b border-surface-100">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-navy-900">Cryptographic Token Lifecycles</h3>
              <p className="text-xs text-navy-600">HMAC-SHA256 JWT & SHA256 hashed refresh rotation</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex justify-between items-center p-3 bg-surface-50 rounded-xl border border-surface-200">
              <span className="text-navy-700 font-medium">Access Token Validity</span>
              <span className="font-bold text-navy-900 font-mono">
                {settings?.jwtExpiryMinutes ?? 60} Minutes
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-surface-50 rounded-xl border border-surface-200">
              <span className="text-navy-700 font-medium">Refresh Token Family Validity</span>
              <span className="font-bold text-navy-900 font-mono">
                {settings?.refreshTokenExpiryDays ?? 7} Days
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
