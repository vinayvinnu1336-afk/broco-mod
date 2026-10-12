'use client';

import React, { ReactNode } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PortalLayout, NavItem } from '@/components/layout/PortalLayout';
import { CommissionBanner } from '@/components/garage/CommissionBanner';
import { LayoutDashboard, Inbox, FileSpreadsheet, Building2, Wrench, Wallet, IndianRupee } from 'lucide-react';

// Phone tab bar shows the four `primary` items; the rest sit under "More".
const garageNavItems: NavItem[] = [
  { label: 'Overview', href: '/garage/dashboard', icon: LayoutDashboard, primary: true },
  { label: 'New requests', shortLabel: 'Requests', href: '/garage/requests', icon: Inbox, primary: true },
  { label: 'Our quotes', shortLabel: 'Quotes', href: '/garage/quotes', icon: FileSpreadsheet, primary: true },
  { label: 'Service jobs', shortLabel: 'Jobs', href: '/garage/jobs', icon: Wrench, primary: true },
  { label: 'BroCo commission', shortLabel: 'Commission', href: '/garage/commission', icon: IndianRupee },
  { label: 'Past payouts', href: '/garage/finance', icon: Wallet },
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
        <CommissionBanner />
        {children}
      </PortalLayout>
    </ProtectedRoute>
  );
}
