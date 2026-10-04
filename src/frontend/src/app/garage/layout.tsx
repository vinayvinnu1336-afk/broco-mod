'use client';

import React, { ReactNode } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PortalLayout, NavItem } from '@/components/layout/PortalLayout';
import { LayoutDashboard, Radio, FileSpreadsheet, Building2, Wrench, DollarSign } from 'lucide-react';

const garageNavItems: NavItem[] = [
  { label: 'Workshop Overview', href: '/garage/dashboard', icon: LayoutDashboard },
  { label: 'Dispatched Requests', href: '/garage/requests', icon: Radio },
  { label: 'Our Quotations', href: '/garage/quotes', icon: FileSpreadsheet },
  { label: 'Service Jobs', href: '/garage/jobs', icon: Wrench },
  { label: 'Finance & Payouts', href: '/garage/finance', icon: DollarSign },
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
        portalBadgeColor="bg-amber-50 text-amber-700 border-amber-200"
        navItems={garageNavItems}
      >
        {children}
      </PortalLayout>
    </ProtectedRoute>
  );
}
