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
  ShieldAlert,
  Wrench,
  AlertTriangle,
  Bell,
  Activity,
  DollarSign,
  CreditCard
} from 'lucide-react';

const adminNavItems: NavItem[] = [
  { label: 'Admin Command', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Finance Control', href: '/admin/finance', icon: DollarSign },
  { label: 'Platform Payments', href: '/admin/payments', icon: CreditCard },
  { label: 'Attention Queue', href: '/admin/attention', icon: AlertTriangle },
  { label: 'Platform Requests', href: '/admin/requests', icon: FileText },
  { label: 'Workshop Network', href: '/admin/garages', icon: Building2 },
  { label: 'Technical Advisors', href: '/admin/advisors', icon: UserCheck },
  { label: 'Customer Accounts', href: '/admin/customers', icon: Users },
  { label: 'Service Execution', href: '/admin/jobs', icon: Wrench },
  { label: 'Notification Health', href: '/admin/notifications', icon: Bell },
  { label: 'System Health', href: '/admin/system-health', icon: Activity },
  { label: 'Security Audit Trail', href: '/admin/audit', icon: ShieldAlert },
  { label: 'Vehicle Master DB', href: '/admin/vehicle-master', icon: CarFront },
  { label: 'System Settings', href: '/admin/settings', icon: Settings },
];

export default function AdminPortalRootLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN']} portalName="Super Admin">
      <PortalLayout
        portalName="Super Admin Portal"
        portalBadgeColor="bg-red-50 text-red-700 border-red-200"
        navItems={adminNavItems}
      >
        {children}
      </PortalLayout>
    </ProtectedRoute>
  );
}
