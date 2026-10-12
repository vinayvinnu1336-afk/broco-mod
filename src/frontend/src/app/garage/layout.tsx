'use client';

import React, { ReactNode } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PortalLayout, NavItem } from '@/components/layout/PortalLayout';
import { LayoutDashboard, Inbox, FileSpreadsheet, Building2, Wrench, Wallet } from 'lucide-react';

const garageNavItems: NavItem[] = [
  { label: 'Overview', href: '/garage/dashboard', icon: LayoutDashboard, primary: true },
  { label: 'New requests', shortLabel: 'Requests', href: '/garage/requests', icon: Inbox, primary: true },
  { label: 'Our quotes', shortLabel: 'Quotes', href: '/garage/quotes', icon: FileSpreadsheet, primary: true },
  { label: 'Service jobs', shortLabel: 'Jobs', href: '/garage/jobs', icon: Wrench, primary: true },
  { label: 'Payouts', href: '/garage/finance', icon: Wallet },
  { label: 'Workshop profile', href: '/garage/profile', icon: Building2 },
];

export default function GaragePortalRootLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute
      allowedRoles={['GARAGE_OWNER', 'GARAGE_MANAGER', 'GARAGE_STAFF', 'SUPER_ADMIN']}
      portalName="Garage"
    >
      <PortalLayout
        portalName="Garage"
        portalBadgeColor="bg-amber-50 text-amber-700 border-amber-200"
        navItems={garageNavItems}
      >
        {children}
      </PortalLayout>
    </ProtectedRoute>
  );
}