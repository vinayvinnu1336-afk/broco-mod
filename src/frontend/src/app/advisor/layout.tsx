'use client';

import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PortalLayout, NavItem } from '@/components/layout/PortalLayout';
import { LayoutDashboard, ListTodo, Inbox, Calculator, CheckSquare, UserCheck, Wrench, HandCoins } from 'lucide-react';
import { useGarageDuesOverview } from '@/components/commissions/useGarageDuesOverview';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const advisorNavItems: NavItem[] = [
  { label: 'Overview', href: '/advisor/dashboard', icon: LayoutDashboard, primary: true },
  { label: 'Work queue', shortLabel: 'Queue', href: '/advisor/work-queue', icon: ListTodo, primary: true },
  { label: 'Service requests', shortLabel: 'Requests', href: '/advisor/requests', icon: Inbox, primary: true },
  { label: 'Garage quotes', shortLabel: 'Quotes', href: '/advisor/quotes', icon: Calculator, primary: true },
  { label: 'Assignments', href: '/advisor/assignments', icon: CheckSquare },
  { label: 'Service jobs', href: '/advisor/jobs', icon: Wrench },
  { label: 'Garage dues', href: '/advisor/garage-dues', icon: HandCoins },
  { label: 'Profile', href: '/advisor/profile', icon: UserCheck },
];

/** The city the signed-in advisor works in (they only see its bookings); none for admins. */
function useAdvisorCity(): string | null {
  const { user } = useAuth();
  const isAdvisor = !!user?.roles?.includes('ADVISOR') && !user?.roles?.includes('SUPER_ADMIN');
  const [city, setCity] = useState<string | null>(null);
  useEffect(() => {
    if (!isAdvisor) return;
    let alive = true;
    apiFetch<{ city?: string }>('/advisor/profile').then((res) => {
      if (alive && res.success && res.data?.city) setCity(res.data.city);
    });
    return () => {
      alive = false;
    };
  }, [isAdvisor]);
  return isAdvisor ? city : null;
}

/** Nav with the overdue garage-dues count on "Garage dues". */
function AdvisorPortal({ children }: { children: ReactNode }) {
  const { overview } = useGarageDuesOverview('advisor');
  const city = useAdvisorCity();
  const overdue = overview?.overdueCount ?? 0;
  const navItems = useMemo(
    () => advisorNavItems.map((item) => (item.href === '/advisor/garage-dues' && overdue > 0 ? { ...item, badge: overdue } : item)),
    [overdue]
  );
  return (
    <PortalLayout
      portalName={city ? `Advisor · ${city}` : 'Advisor'}
      portalBadgeColor="bg-purple-50 text-purple-700 border-purple-200"
      navItems={navItems}
    >
      {children}
    </PortalLayout>
  );
}

export default function AdvisorPortalRootLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['ADVISOR', 'SUPER_ADMIN']} portalName="Advisor">
      <AdvisorPortal>{children}</AdvisorPortal>
    </ProtectedRoute>
  );
}
