'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { 
  Users, 
  Building2, 
  UserCheck, 
  FileText, 
  ShieldAlert, 
  ArrowRight,
  Shield,
  Activity,
  Sliders
} from 'lucide-react';

interface AdminDashboardData {
  totalUsersCount: number;
  totalCustomersCount: number;
  totalGaragesCount: number;
  totalAdvisorsCount: number;
  totalRequestsCount: number;
  recentUsers: Array<{
    id: string;
    email: string;
    fullName: string;
    phoneNumber: string;
    roles: string[];
    isActive: boolean;
    createdAtUtc: string;
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    userEmail: string;
    entityName: string;
    entityId: string;
    details: string;
    ipAddress: string;
    timestampUtc: string;
  }>;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const res = await apiFetch<AdminDashboardData>('/admin/dashboard');
      if (res.success && res.data) {
        setData(res.data);
      }
      setLoading(false);
    }
    loadDashboard();
  }, []);

  return (
    <div className="space-y-6">
      {/* Super Admin Welcome */}
      <div className="bg-gradient-to-r from-navy-900 via-navy-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-sm border border-navy-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-semibold uppercase tracking-wider mb-3">
              <Shield className="w-3.5 h-3.5" />
              <span>Super Administrator Command</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
              System Administration Console
            </h1>
            <p className="text-surface-300 text-sm max-w-xl">
              Platform governance terminal. Audit user sessions, manage partner garages, tune 10 KM dispatch parameters, and oversee security policies.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/settings"
              className="px-4 py-2.5 bg-electric-500 hover:bg-electric-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition"
            >
              <Sliders className="w-4 h-4" />
              <span>System Settings</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-surface-200 shadow-sm">
          <div className="text-xs font-bold text-navy-600 uppercase tracking-wider">Total Users</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-navy-900 mt-1">
            {loading ? '—' : data?.totalUsersCount ?? 0}
          </div>
          <div className="text-[11px] text-navy-600 mt-1">Platform-Wide Accounts</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-surface-200 shadow-sm">
          <div className="text-xs font-bold text-navy-600 uppercase tracking-wider">Garages Network</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-navy-900 mt-1">
            {loading ? '—' : data?.totalGaragesCount ?? 1}
          </div>
          <div className="text-[11px] text-navy-600 mt-1">Certified Workshops</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-surface-200 shadow-sm">
          <div className="text-xs font-bold text-navy-600 uppercase tracking-wider">Technical Advisors</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-navy-900 mt-1">
            {loading ? '—' : data?.totalAdvisorsCount ?? 1}
          </div>
          <div className="text-[11px] text-navy-600 mt-1">Vetted Automotive Leads</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-surface-200 shadow-sm">
          <div className="text-xs font-bold text-navy-600 uppercase tracking-wider">Total Requests</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-navy-900 mt-1">
            {loading ? '—' : data?.totalRequestsCount ?? 0}
          </div>
          <div className="text-[11px] text-navy-600 mt-1">10 KM PostGIS Dispatches</div>
        </div>
      </div>

      {/* Split: Recent Users & Recent Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-navy-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-electric-600" />
              <span>Platform Users</span>
            </h2>
            <Link href="/admin/customers" className="text-xs font-semibold text-electric-600 hover:underline flex items-center gap-1">
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-navy-600">Loading users...</div>
          ) : data?.recentUsers && data.recentUsers.length > 0 ? (
            <div className="divide-y divide-surface-100">
              {data.recentUsers.map((u) => (
                <div key={u.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-navy-900">{u.fullName}</div>
                    <div className="text-xs text-navy-600 font-mono">{u.email}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-navy-800 bg-surface-100 px-2 py-0.5 rounded mr-2">
                      {u.roles.join(', ')}
                    </span>
                    <span className={`text-[10px] font-bold uppercase ${u.isActive ? 'text-emerald-600' : 'text-red-600'}`}>
                      {u.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-navy-600">No users found.</div>
          )}
        </div>

        {/* Security Audit Trail */}
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-navy-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              <span>Security Audit Trail</span>
            </h2>
            <Link href="/admin/audit" className="text-xs font-semibold text-electric-600 hover:underline flex items-center gap-1">
              <span>Full Log</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-navy-600">Loading audit trail...</div>
          ) : data?.recentAuditLogs && data.recentAuditLogs.length > 0 ? (
            <div className="divide-y divide-surface-100 text-xs">
              {data.recentAuditLogs.map((log) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-navy-900 bg-surface-100 px-1.5 py-0.5 rounded text-[11px]">
                      {log.action}
                    </span>
                    <span className="text-navy-600 ml-2">{log.userEmail || 'System'}</span>
                  </div>
                  <span className="text-navy-600 text-[10px]">
                    {new Date(log.timestampUtc).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-navy-600">No audit events recorded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
