'use client';

import React, { ReactNode } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PortalLayout, NavItem } from '@/components/layout/PortalLayout';
import { LayoutDashboard, Inbox, Calculator, CheckSquare, UserCheck } from 'lucide-react';

const advisorNavItems: NavItem[] = [
  { label: 'Advisor Console', href: '/advisor/dashboard', icon: LayoutDashboard },
  { label: 'Requests Review', href: '/advisor/requests', icon: Inbox },
  { label: 'Quotes & Margins', href: '/advisor/quotes', icon: Calculator },
  { label: 'Garage Assignments', href: '/advisor/assignments', icon: CheckSquare },
  { label: 'Advisor Profile', href: '/advisor/profile', icon: UserCheck },
];

export default function AdvisorPortalRootLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['ADVISOR', 'SUPER_ADMIN']} portalName="Advisor">
      <PortalLayout
        portalName="Advisor Portal"
        portalBadgeColor="bg-purple-600/20 text-purple-300 border-purple-500/30"
        navItems={advisorNavItems}
      >
        {children}
      </PortalLayout>
    </ProtectedRoute>
  );
}
