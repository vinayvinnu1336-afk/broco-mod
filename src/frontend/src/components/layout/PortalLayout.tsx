'use client';

import React, { useState, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  Wrench, 
  LogOut, 
  Menu,
  Shield, 
  Sparkles,
  ChevronRight,
  Bell
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Drawer } from '@/components/ui/Drawer';
import { Badge } from '@/components/ui/Badge';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

interface PortalLayoutProps {
  children: ReactNode;
  portalName: string;
  portalBadgeColor?: string;
  navItems: NavItem[];
}

export function PortalLayout({
  children,
  portalName,
  portalBadgeColor = 'bg-electric-50 text-electric-700 border-electric-200',
  navItems,
}: PortalLayoutProps) {
  const pathname = usePathname();
  const { user, logout, quickLogin } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const renderNavLinks = (onItemClick?: () => void) => (
    <div className="space-y-1">
      <div className="px-3 py-2 text-[11px] font-bold text-navy-400 uppercase tracking-wider">
        {portalName} Menu
      </div>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
              isActive
                ? 'bg-electric-600 text-white shadow-sm shadow-electric-600/20'
                : 'text-navy-700 hover:bg-surface-100 hover:text-navy-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-navy-500'}`} />
              <span>{item.label}</span>
            </div>
            {item.badge !== undefined && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-surface-200 text-navy-700'
                }`}
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col font-sans text-navy-900">
      {/* Top Header */}
      <header className="bg-navy-900 border-b border-navy-800 text-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Mobile hamburger & Logo & Portal Badge */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden p-2 text-surface-300 hover:text-white hover:bg-navy-800 rounded-lg transition"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-electric-600 flex items-center justify-center text-white shadow-md shadow-electric-600/30 group-hover:scale-105 transition-transform">
                <Wrench className="w-5 h-5" />
              </div>
              <div className="hidden xs:block sm:block">
                <span className="text-lg font-black tracking-tight text-white uppercase">BroCo</span>
                <span className="text-lg font-light tracking-widest text-electric-400 uppercase ml-1">Mod</span>
              </div>
            </Link>

            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${portalBadgeColor}`}>
              {portalName}
            </span>
          </div>

          {/* Quick Demo Switcher & User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Demo Switcher Quick Menu */}
            <div className="hidden xl:flex items-center bg-navy-800/90 rounded-xl p-1 border border-navy-700/80 text-xs">
              <span className="px-2.5 text-surface-300 font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold text-white">Demo:</span>
              </span>
              <button
                onClick={() => quickLogin('customer')}
                className="px-2.5 py-1 rounded-lg hover:bg-navy-700 text-surface-200 transition font-medium"
                title="Log in as Customer"
              >
                Customer
              </button>
              <button
                onClick={() => quickLogin('garage')}
                className="px-2.5 py-1 rounded-lg hover:bg-navy-700 text-surface-200 transition font-medium"
                title="Log in as Garage Owner"
              >
                Garage
              </button>
              <button
                onClick={() => quickLogin('advisor')}
                className="px-2.5 py-1 rounded-lg hover:bg-navy-700 text-surface-200 transition font-medium"
                title="Log in as Advisor"
              >
                Advisor
              </button>
              <button
                onClick={() => quickLogin('admin')}
                className="px-2.5 py-1 rounded-lg hover:bg-navy-700 text-surface-200 transition font-medium"
                title="Log in as Super Admin"
              >
                Admin
              </button>
            </div>

            {/* User Pill */}
            {user && (
              <div className="flex items-center gap-2.5 pl-2 sm:pl-3 sm:border-l sm:border-navy-800">
                <Avatar name={user.fullName || user.email} size="sm" />
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-bold text-white leading-tight">{user.fullName || 'User'}</div>
                  <div className="text-[11px] text-surface-400 font-mono leading-tight truncate max-w-[140px]">
                    {user.email}
                  </div>
                </div>
              </div>
            )}

            {/* Logout Button */}
            <button
              onClick={() => logout()}
              className="p-2 text-surface-300 hover:text-white hover:bg-navy-800 rounded-xl transition"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body with Sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex w-full gap-6">
        {/* Desktop Sidebar */}
        <aside className="w-64 flex-shrink-0 hidden md:block">
          <nav className="bg-white rounded-2xl border border-surface-200 p-3 shadow-card sticky top-24 space-y-1">
            {renderNavLinks()}

            <div className="pt-4 mt-4 border-t border-surface-200 px-3">
              <div className="text-[11px] font-semibold text-navy-400 uppercase tracking-wider mb-2">
                Security & Isolation
              </div>
              <div className="bg-surface-50 rounded-xl p-3 text-xs text-navy-600 leading-relaxed border border-surface-200">
                <div className="flex items-center gap-1.5 font-bold text-navy-900 mb-1">
                  <Shield className="w-4 h-4 text-electric-600" />
                  <span>Isolated Data Realm</span>
                </div>
                Zero-trust data isolation enforced at API boundary.
              </div>
            </div>
          </nav>
        </aside>

        {/* Mobile Navigation Drawer */}
        <Drawer
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          title={
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-electric-600 flex items-center justify-center text-white">
                <Wrench className="w-4 h-4" />
              </div>
              <span className="font-bold text-navy-900">{portalName}</span>
            </div>
          }
          position="left"
          size="sm"
        >
          <div className="py-2">
            {renderNavLinks(() => setMobileNavOpen(false))}
          </div>
        </Drawer>

        {/* Content Area */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
