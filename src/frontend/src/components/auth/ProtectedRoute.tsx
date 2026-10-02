'use client';

import React, { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ShieldAlert, ArrowRight, LogOut, RefreshCw } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: string[];
  portalName: string;
}

export function ProtectedRoute({ children, allowedRoles, portalName }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading, logout, quickLogin } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-electric-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-surface-300 font-medium">Verifying platform credentials...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    if (typeof window !== 'undefined') {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
    }
    return null;
  }

  const hasAccess = allowedRoles.some((role) =>
    user.roles.map((r) => r.toUpperCase()).includes(role.toUpperCase())
  );

  if (!hasAccess) {
    // 403 Forbidden view with data isolation rationale
    const currentRolesDisplay = user.roles.join(', ');
    const myPortalUrl = user.roles.includes('SUPER_ADMIN')
      ? '/admin/dashboard'
      : user.roles.includes('ADVISOR')
      ? '/advisor/dashboard'
      : user.roles.some((r) => r.startsWith('GARAGE'))
      ? '/garage/dashboard'
      : '/customer/dashboard';

    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-surface-200 p-8 text-center">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-9 h-9" />
          </div>

          <span className="inline-block px-3 py-1 bg-red-100 text-red-700 text-xs font-bold uppercase tracking-wider rounded-full mb-3">
            403 — Data Isolation Policy Enforcement
          </span>

          <h1 className="text-2xl font-bold text-navy-900 mb-2">Access Restricted</h1>

          <p className="text-navy-600 text-sm mb-6 leading-relaxed">
            Your current account role (<strong className="text-navy-900">{currentRolesDisplay}</strong>) is strictly forbidden from accessing the <strong className="text-navy-900">{portalName} Portal</strong>.
            BroCo Mod enforces zero-trust role segregation between Customers, Garages, Advisors, and Platform Admins.
          </p>

          <div className="bg-surface-50 rounded-xl p-4 border border-surface-200 mb-6 text-left text-xs text-navy-700 space-y-2">
            <div className="font-semibold text-navy-900">Why was this blocked?</div>
            <p>• Customers cannot view internal workshop pricing or management consoles.</p>
            <p>• Workshop partners cannot inspect competitor bids, advisor margins, or external portals.</p>
            <p>• Advisors cannot access super administrative governance settings.</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => router.push(myPortalUrl)}
              className="w-full py-3 px-4 bg-electric-500 hover:bg-electric-600 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition"
            >
              <span>Go to Your Authorized Portal</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="pt-2 border-t border-surface-200 grid grid-cols-2 gap-2">
              <button
                onClick={() => logout()}
                className="py-2.5 px-3 border border-surface-300 hover:bg-surface-100 text-navy-700 text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>

              <button
                onClick={() => {
                  const targetRole = portalName.toLowerCase().includes('admin')
                    ? 'admin'
                    : portalName.toLowerCase().includes('advisor')
                    ? 'advisor'
                    : portalName.toLowerCase().includes('garage')
                    ? 'garage'
                    : 'customer';
                  quickLogin(targetRole as any);
                }}
                className="py-2.5 px-3 bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Switch to {portalName} Demo</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
