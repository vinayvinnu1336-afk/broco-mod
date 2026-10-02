'use client';

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  Wrench, 
  LogOut, 
  User, 
  ChevronRight,
  Shield, 
  Sparkles,
  ExternalLink
} from 'lucide-react';

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
  portalBadgeColor = 'bg-blue-600/20 text-blue-400 border-blue-500/30',
  navItems,
}: PortalLayoutProps) {
  const pathname = usePathname();
  const { user, logout, quickLogin } = useAuth();

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-navy-900 border-b border-navy-800 text-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Portal Badge */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-electric-500 flex items-center justify-center text-white shadow-md shadow-electric-500/30 group-hover:scale-105 transition-transform">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <span className="text-lg font-black tracking-tight text-white uppercase">BroCo</span>
                <span className="text-lg font-light tracking-widest text-electric-400 uppercase ml-1">Mod</span>
              </div>
            </Link>

            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${portalBadgeColor}`}>
              {portalName}
            </span>
          </div>

          {/* Quick Demo Switcher & User Profile */}
          <div className="flex items-center gap-3">
            {/* Demo Switcher Quick Menu */}
            <div className="hidden lg:flex items-center bg-navy-800/80 rounded-lg p-1 border border-navy-700 text-xs">
              <span className="px-2 text-surface-300 font-medium flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Demo Switch:</span>
              </span>
              <button
                onClick={() => quickLogin('customer')}
                className="px-2.5 py-1 rounded hover:bg-navy-700 text-surface-200 transition"
                title="Log in as Customer"
              >
                Customer
              </button>
              <button
                onClick={() => quickLogin('garage')}
                className="px-2.5 py-1 rounded hover:bg-navy-700 text-surface-200 transition"
                title="Log in as Garage Owner"
              >
                Garage
              </button>
              <button
                onClick={() => quickLogin('advisor')}
                className="px-2.5 py-1 rounded hover:bg-navy-700 text-surface-200 transition"
                title="Log in as Advisor"
              >
                Advisor
              </button>
              <button
                onClick={() => quickLogin('admin')}
                className="px-2.5 py-1 rounded hover:bg-navy-700 text-surface-200 transition"
                title="Log in as Super Admin"
              >
                Admin
              </button>
            </div>

            {/* User Pill */}
            {user && (
              <div className="flex items-center gap-2 pl-3 border-l border-navy-800">
                <div className="w-8 h-8 rounded-full bg-electric-600/30 border border-electric-500/40 text-electric-300 flex items-center justify-center font-bold text-xs">
                  {user.fullName ? user.fullName[0] : 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-semibold text-white leading-tight">{user.fullName}</div>
                  <div className="text-[10px] text-surface-300 font-mono">{user.email}</div>
                </div>
              </div>
            )}

            {/* Logout Button */}
            <button
              onClick={() => logout()}
              className="p-2 text-surface-300 hover:text-white hover:bg-navy-800 rounded-lg transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body with Sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex w-full gap-6">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 hidden md:block">
          <nav className="bg-white rounded-2xl border border-surface-200 p-3 shadow-sm sticky top-24 space-y-1">
            <div className="px-3 py-2 text-[11px] font-bold text-navy-600 uppercase tracking-wider">
              {portalName} Navigation
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                    isActive
                      ? 'bg-electric-500 text-white shadow-sm shadow-electric-500/20'
                      : 'text-navy-700 hover:bg-surface-50 hover:text-navy-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-navy-600'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-surface-200 text-navy-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            <div className="pt-4 mt-4 border-t border-surface-200 px-3">
              <div className="text-[11px] font-semibold text-navy-600 uppercase tracking-wider mb-2">
                Security Policy
              </div>
              <div className="bg-surface-50 rounded-xl p-3 text-[11px] text-navy-600 leading-relaxed border border-surface-200">
                <div className="flex items-center gap-1 font-semibold text-navy-800 mb-1">
                  <Shield className="w-3.5 h-3.5 text-electric-600" />
                  <span>Isolated Data Realm</span>
                </div>
                Zero-trust data isolation enforced at API boundary.
              </div>
            </div>
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
