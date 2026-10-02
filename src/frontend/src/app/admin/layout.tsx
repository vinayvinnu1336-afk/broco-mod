'use client';

import React, { ReactNode } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PortalLayout, NavItem } from '@/components/layout/PortalLayout';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  UserCheck, 
  FileText, 
  CarFront, 
  Settings, 
  ShieldAlert 
} from 'lucide-react';

const adminNavItems: NavItem[] = [
  { label: 'Admin Command', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Customer Accounts', href: '/admin/customers', icon: Users },
  { label: 'Workshop Network', href: '/admin/garages', icon: Building2 },
  { label: 'Technical Advisors', href: '/admin/advisors', icon: UserCheck },
  { label: 'Platform Requests', href: '/admin/requests', icon: FileText },
  { label: 'Vehicle Master DB', href: '/admin/vehicle-master', icon: CarFront },
  { label: 'System Settings', href: '/admin/settings', icon: Settings },
  { label: 'Security Audit Trail', href: '/admin/audit', icon: ShieldAlert },
];

export default function AdminPortalRootLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN']} portalName="Super Admin">
      <PortalLayout
        portalName="Super Admin Portal"
        portalBadgeColor="bg-red-500/20 text-red-300 border-red-500/30"
        navItems={adminNavItems}
      >
        {children}
      </PortalLayout>
    </ProtectedRoute>
  );
}
