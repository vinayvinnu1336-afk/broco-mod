'use client';

import React, { ReactNode } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PortalLayout, NavItem } from '@/components/layout/PortalLayout';
import { LayoutDashboard, Radio, FileSpreadsheet, Building2 } from 'lucide-react';

const garageNavItems: NavItem[] = [
  { label: 'Workshop Overview', href: '/garage/dashboard', icon: LayoutDashboard },
  { label: 'Dispatched Requests', href: '/garage/requests', icon: Radio },
  { label: 'Our Quotations', href: '/garage/quotes', icon: FileSpreadsheet },
  { label: 'Workshop Profile', href: '/garage/profile', icon: Building2 },
];

export default function GaragePortalRootLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute
      allowedRoles={['GARAGE_OWNER', 'GARAGE_MANAGER', 'GARAGE_STAFF', 'SUPER_ADMIN']}
      portalName="Garage"
    >
      <PortalLayout
        portalName="Garage Portal"
        portalBadgeColor="bg-amber-500/20 text-amber-300 border-amber-500/30"
        navItems={garageNavItems}
      >
        {children}
      </PortalLayout>
    </ProtectedRoute>
  );
}
