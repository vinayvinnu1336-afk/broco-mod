'use client';

import React from 'react';
import Link from 'next/link';
import { LayoutDashboard, Wrench } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { homePathForRoles } from '@/components/auth/ProtectedRoute';

export function BrandMark({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="flex min-h-[44px] min-w-0 items-center gap-2.5" aria-label="BroCo home">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-electric-600 text-white shadow-md shadow-electric-600/30">
        <Wrench className="h-[18px] w-[18px]" />
      </span>
      <span className={`text-lg font-extrabold tracking-tight ${dark ? 'text-white' : 'text-navy-900'}`}>
        Bro<span className={dark ? 'text-electric-400' : 'text-electric-600'}>Co</span>
      </span>
    </Link>
  );
}

const NAV = [
  { href: '/services/car-service', label: 'Car service' },
  { href: '/services', label: 'All services' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#faq', label: 'FAQ' },
];

/** Sticky header used by every public (signed-out) page. */
export function PublicHeader() {
  const { user, isAuthenticated } = useAuth();
  const signedIn = isAuthenticated && !!user;

  return (
    <header className="pt-safe sticky top-0 z-40 border-b border-surface-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:h-16 sm:px-6 lg:px-8">
        <BrandMark />

        <nav className="hidden items-center gap-6 text-sm font-medium text-navy-600 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-electric-600">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {signedIn && user ? (
            <Link
              href={homePathForRoles(user.roles ?? [])}
              className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl bg-navy-900 px-3.5 text-sm font-semibold text-white transition hover:bg-navy-800"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden />
              Go to my dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-xl px-3 text-sm font-semibold text-navy-700 transition hover:bg-surface-100 hover:text-navy-900"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-xl bg-electric-600 px-3.5 text-sm font-semibold text-white shadow-sm shadow-electric-600/20 transition hover:bg-electric-700"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
