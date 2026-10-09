'use client';

import React, { ReactNode } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PortalLayout, NavItem } from '@/components/layout/PortalLayout';
import { LayoutDashboard, ListTodo, Inbox, Calculator, CheckSquare, UserCheck, Wrench } from 'lucide-react';

const advisorNavItems: NavItem[] = [
  { label: 'Overview', href: '/advisor/dashboard', icon: LayoutDashboard, primary: true },
  { label: 'Work queue', shortLabel: 'Queue', href: '/advisor/work-queue', icon: ListTodo, primary: true },
  { label: 'Service requests', shortLabel: 'Requests', href: '/advisor/requests', icon: Inbox, primary: true },
  { label: 'Garage quotes', shortLabel: 'Quotes', href: '/advisor/quotes', icon: Calculator, primary: true },
  { label: 'Assignments', href: '/advisor/assignments', icon: CheckSquare },
  { label: 'Service jobs', href: '/advisor/jobs', icon: Wrench },
  { label: 'Profile', href: '/advisor/profile', icon: UserCheck },
];

export default function AdvisorPortalRootLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['ADVISOR', 'SUPER_ADMIN']} portalName="Advisor">
      <PortalLayout
        portalName="Advisor"
        portalBadgeColor="bg-purple-50 text-purple-700 border-purple-200"
        navItems={advisorNavItems}
      >
        {children}
      </PortalLayout>
    </ProtectedRoute>
  );
}