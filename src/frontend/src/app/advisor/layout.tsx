'use client';

import React, { ReactNode, useMemo } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PortalLayout, NavItem } from '@/components/layout/PortalLayout';
import { LayoutDashboard, ListTodo, Inbox, Calculator, CheckSquare, UserCheck, Wrench, HandCoins } from 'lucide-react';
import { useGarageDuesOverview } from '@/components/commissions/useGarageDuesOverview';

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

/** Nav with the overdue garage-dues count on "Garage dues". */
function AdvisorPortal({ children }: { children: ReactNode }) {
  const { overview } = useGarageDuesOverview('advisor');
  const overdue = overview?.overdueCount ?? 0;
  const navItems = useMemo(
    () => advisorNavItems.map((item) => (item.href === '/advisor/garage-dues' && overdue > 0 ? { ...item, badge: overdue } : item)),
    [overdue]
  );
  return (
    <PortalLayout
      portalName="Advisor"
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
