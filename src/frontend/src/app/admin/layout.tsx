'use client';

import React, { ReactNode, useMemo } from 'react';
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
  IndianRupee,
  CreditCard,
  FileCheck2,
  Calculator,
  CheckSquare,
  HandCoins,
  Inbox,
  PackageCheck,
} from 'lucide-react';
import { useGarageDuesOverview } from '@/components/commissions/useGarageDuesOverview';

const adminNavItems: NavItem[] = [
  { label: 'Overview', href: '/admin/dashboard', icon: LayoutDashboard, primary: true, section: 'Operations' },
  { label: 'Needs attention', shortLabel: 'Attention', href: '/admin/attention', icon: AlertTriangle, primary: true, section: 'Operations' },
  { label: 'Service requests', shortLabel: 'Requests', href: '/admin/requests', icon: FileText, primary: true, section: 'Operations' },
  { label: 'Garage quotes', href: '/admin/quotes', icon: Calculator, section: 'Operations' },
  { label: 'Customer quotations', href: '/admin/customer-quotations', icon: FileCheck2, section: 'Operations' },
  { label: 'Assignments', href: '/admin/assignments', icon: CheckSquare, section: 'Operations' },
  { label: 'Service jobs', href: '/admin/jobs', icon: Wrench, section: 'Operations' },
  { label: 'Website enquiries', shortLabel: 'Enquiries', href: '/admin/leads', icon: Inbox, section: 'Operations' },
  { label: 'Finance', href: '/admin/finance', icon: IndianRupee, primary: true, section: 'Money' },
  { label: 'Commissions', href: '/admin/commissions', icon: HandCoins, section: 'Money' },
  { label: 'Payments', href: '/admin/payments', icon: CreditCard, section: 'Money' },
  { label: 'Garages', href: '/admin/garages', icon: Building2, section: 'Network' },
  { label: 'Advisors', href: '/admin/advisors', icon: UserCheck, section: 'Network' },
  { label: 'Customers', href: '/admin/customers', icon: Users, section: 'Network' },
  { label: 'Vehicle catalogue', href: '/admin/vehicle-master', icon: CarFront, section: 'Catalogue' },
  { label: 'Packages & prices', href: '/admin/packages', icon: PackageCheck, section: 'Catalogue' },
  { label: 'Notifications', href: '/admin/notifications', icon: Bell, section: 'Platform' },
  { label: 'System health', href: '/admin/system-health', icon: Activity, section: 'Platform' },
  { label: 'Audit trail', href: '/admin/audit', icon: ShieldAlert, section: 'Platform' },
  { label: 'Settings', href: '/admin/settings', icon: Settings, section: 'Platform' },
];

/** Nav with the overdue garage-dues count on "Commissions". */
function AdminPortal({ children }: { children: ReactNode }) {
  const { overview } = useGarageDuesOverview('admin');
  const overdue = overview?.overdueCount ?? 0;
  const navItems = useMemo(
    () => adminNavItems.map((item) => (item.href === '/admin/commissions' && overdue > 0 ? { ...item, badge: overdue } : item)),
    [overdue]
  );
  return (
    <PortalLayout
      portalName="Admin"
      portalBadgeColor="bg-red-50 text-red-700 border-red-200"
      navItems={navItems}
    >
      {children}
    </PortalLayout>
  );
}

export default function AdminPortalRootLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN']} portalName="Super Admin">
      <AdminPortal>{children}</AdminPortal>
    </ProtectedRoute>
  );
}