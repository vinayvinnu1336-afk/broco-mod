'use client';

import React, { ReactNode } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PortalLayout, NavItem } from '@/components/layout/PortalLayout';
import { LayoutDashboard, Car, FileText, BadgeDollarSign, User, CreditCard, Receipt } from 'lucide-react';

const customerNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/customer/dashboard', icon: LayoutDashboard },
  { label: 'My Vehicles', href: '/customer/vehicles', icon: Car },
  { label: 'Service Requests', href: '/customer/requests', icon: FileText },
  { label: 'Quotations', href: '/customer/quotes', icon: BadgeDollarSign },
  { label: 'Payments', href: '/customer/payments', icon: CreditCard },
  { label: 'Invoices', href: '/customer/invoices', icon: Receipt },
  { label: 'My Profile', href: '/customer/profile', icon: User },
];

export default function CustomerPortalRootLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['CUSTOMER', 'SUPER_ADMIN']} portalName="Customer">
      <PortalLayout
        portalName="Customer Portal"
        portalBadgeColor="bg-blue-600/20 text-blue-300 border-blue-500/30"
        navItems={customerNavItems}
      >
        {children}
      </PortalLayout>
    </ProtectedRoute>
  );
}
