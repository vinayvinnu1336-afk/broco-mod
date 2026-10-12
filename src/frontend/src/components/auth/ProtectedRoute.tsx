'use client';

import React, { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ShieldAlert, ArrowRight, LogOut, RefreshCw, Wrench } from 'lucide-react';
import { isDemoMode } from '@/lib/demo';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: string[];
  portalName: string;
}

export function homePathForRoles(roles: string[]): string {
  const upper = roles.map((r) => r.toUpperCase());
  if (upper.includes('SUPER_ADMIN')) return '/admin/dashboard';
  if (upper.includes('ADVISOR')) return '/advisor/dashboard';
  if (upper.some((r) => r.startsWith('GARAGE'))) return '/garage/dashboard';
  return '/customer/dashboard';
}

export function ProtectedRoute({ children, allowedRoles, portalName }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading, logout, quickLogin } = useAuth();
  const router = useRouter();
  const signedOut = !isLoading && (!isAuthenticated || !user);

  useEffect(() => {
    if (signedOut) {
      router.replace(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [signedOut, router]);

  if (isLoading || signedOut || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface-50">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-electric-600 text-white shadow-lg shadow-electric-600/30">
          <Wrench className="h-6 w-6" />
        </div>
        <div className="h-1 w-24 overflow-hidden rounded-full bg-surface-200">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-electric-600" />
        </div>
      </div>
    );
  }

  const hasAccess = allowedRoles.some((role) =>
    user.roles.map((r) => r.toUpperCase()).includes(role.toUpperCase())
  );

  if (!hasAccess) {
    const myPortalUrl = homePathForRoles(user.roles);
    const targetRole = portalName.toLowerCase().includes('admin')
      ? 'admin'
      : portalName.toLowerCase().includes('advisor')
      ? 'advisor'
      : portalName.toLowerCase().includes('garage')
      ? 'garage'
      : 'customer';

    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-50 p-4">
        <div className="w-full max-w-md rounded-3xl border border-surface-200 bg-white p-6 text-center shadow-elevated sm:p-8">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-navy-900">This area isn&apos;t for your account</h1>
          <p className="mt-2 text-sm leading-relaxed text-navy-500">
            You&apos;re signed in as <span className="font-medium text-navy-800">{user.email}</span>, which doesn&apos;t
            have access to the {portalName} portal.
          </p>

          <div className="mt-6 space-y-2">
            <button
              onClick={() => router.push(myPortalUrl)}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-electric-600 px-4 font-semibold text-white transition hover:bg-electric-700"
            >
              Go to my portal <ArrowRight className="h-4 w-4" />
            </button>
            <div className={`grid gap-2 ${isDemoMode ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <button
                onClick={() => logout()}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-surface-300 px-3 text-sm font-medium text-navy-700 transition hover:bg-surface-100"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
              {isDemoMode && (
                <button
                  onClick={() => quickLogin(targetRole)}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-navy-900 px-3 text-sm font-medium text-white transition hover:bg-navy-800"
                >
                  <RefreshCw className="h-4 w-4" /> Use {targetRole} demo
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
