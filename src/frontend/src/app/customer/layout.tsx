'use client';

import React, { ReactNode } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PortalLayout, NavItem } from '@/components/layout/PortalLayout';
import { Home, Car, ClipboardList, FileCheck2, User, CreditCard, Receipt, Plus } from 'lucide-react';

const customerNavItems: NavItem[] = [
  { label: 'Home', href: '/customer/dashboard', icon: Home, primary: true },
  { label: 'My requests', shortLabel: 'Requests', href: '/customer/requests', icon: ClipboardList, primary: true },
  { label: 'Quotes', href: '/customer/quotes', icon: FileCheck2, primary: true },
  { label: 'My vehicles', href: '/customer/vehicles', icon: Car },
  { label: 'Payments', href: '/customer/payments', icon: CreditCard },
  { label: 'Invoices', href: '/customer/invoices', icon: Receipt },
  { label: 'Profile', href: '/customer/profile', icon: User },
];

export default function CustomerPortalRootLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['CUSTOMER', 'SUPER_ADMIN']} portalName="Customer">
      <PortalLayout
        portalName="Customer"
        portalBadgeColor="bg-electric-50 text-electric-700 border-electric-200"
        navItems={customerNavItems}
        primaryAction={{ label: 'Book', href: '/customer/requests/new', icon: Plus }}
      >
        {children}
      </PortalLayout>
    </ProtectedRoute>
  );
}