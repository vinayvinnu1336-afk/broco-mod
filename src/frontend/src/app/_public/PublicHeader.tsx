'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, LayoutDashboard, Menu, Phone, Store, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { homePathForRoles } from '@/components/auth/ProtectedRoute';
import { BroCoLogo } from '@/components/brand/BroCoLogo';
import { SUPPORT_PHONE, telHref } from '@/lib/site';
import { SERVICE_CATEGORIES, isCustomer, serviceHref } from './services';

/** Logo linking home. `dark` = for navy backgrounds. */
export function BrandMark({ dark = false, tagline = false }: { dark?: boolean; tagline?: boolean }) {
  return (
    <Link href="/" className="flex min-h-[44px] min-w-0 items-center" aria-label="BroCo home">
      <BroCoLogo size={38} tone={dark ? 'dark' : 'light'} tagline={tagline} />
    </Link>
  );
}

const MAIN_NAV: { href: string; label: string; wideOnly?: boolean }[] = [
  { href: '/', label: 'Home' },
  { href: '/track', label: 'Track Service' },
  { href: '/#why', label: 'Why BroCo' },
  { href: '/#how-it-works', label: 'How it works', wideOnly: true },
  { href: '/#support', label: 'Support' },
];

/** Sticky dark header used by every public (signed-out) page. */
export function PublicHeader() {
  const { user, isAuthenticated } = useAuth();
  const signedIn = isAuthenticated && !!user;
  const customer = signedIn && isCustomer(user?.roles);
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const servicesRef = useRef<HTMLDivElement>(null);

  // Close menus on navigation, outside click and Escape.
  useEffect(() => {
    setMenuOpen(false);
    setServicesOpen(false);
  }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setServicesOpen(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (servicesRef.current && !servicesRef.current.contains(e.target as Node)) setServicesOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, []);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const featuredServices = SERVICE_CATEGORIES.slice(0, 6);
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname?.startsWith(href.replace(/#.*$/, '')) && !href.includes('#'));

  return (
    <header className="pt-safe sticky top-0 z-40 print:hidden bg-navy-950/95 text-white shadow-[0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-[72px] lg:px-8">
        {/* No tagline here: the hero headline already says it. */}
        <BrandMark dark />

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-1 text-[14px] font-medium lg:flex" aria-label="Main">
          <Link href="/" className={navLink(isActive('/'))}>
            Home
          </Link>
          <div ref={servicesRef} className="relative">
            <button
              type="button"
              onClick={() => setServicesOpen((v) => !v)}
              aria-expanded={servicesOpen}
              aria-haspopup="true"
              className={`${navLink(pathname?.startsWith('/services') ?? false)} inline-flex items-center gap-1`}
            >
              Services <ChevronDown className={`h-4 w-4 transition-transform ${servicesOpen ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {servicesOpen && (
              <div className="absolute left-1/2 top-full z-50 mt-2 w-[520px] -translate-x-1/2 rounded-2xl border border-surface-200 bg-white p-3 text-navy-900 shadow-dropdown animate-pop-in">
                <div className="grid grid-cols-2 gap-1">
                  {featuredServices.map((s) => (
                    <Link
                      key={s.name}
                      href={serviceHref(s, customer)}
                      className="flex items-start gap-3 rounded-xl p-2.5 transition hover:bg-surface-50"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-electric-50 text-electric-600">
                        <s.icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{s.periodic ? 'Car service packages' : s.name}</span>
                        <span className="line-clamp-2 block text-xs text-navy-500">{s.desc}</span>
                      </span>
                    </Link>
                  ))}
                </div>
                <Link
                  href="/services"
                  className="mt-2 flex min-h-[44px] items-center justify-center rounded-xl bg-surface-50 text-sm font-semibold text-electric-700 hover:bg-surface-100"
                >
                  View all services
                </Link>
              </div>
            )}
          </div>
          {MAIN_NAV.slice(1).map((item) => (
            <Link key={item.href} href={item.href} className={`${navLink(isActive(item.href))} ${item.wideOnly ? 'hidden xl:inline-flex' : ''}`}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {SUPPORT_PHONE && (
            <a
              href={telHref(SUPPORT_PHONE)}
              className="hidden min-h-[44px] items-center gap-2 rounded-xl px-2 text-sm font-semibold text-white/90 hover:text-white xl:inline-flex"
            >
              <Phone className="h-4 w-4" aria-hidden /> {SUPPORT_PHONE}
            </a>
          )}
          {signedIn && user ? (
            <Link
              href={homePathForRoles(user.roles ?? [])}
              className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl bg-electric-600 px-3.5 text-sm font-semibold text-white transition hover:bg-electric-500"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden />
              <span className="hidden xs:inline">My dashboard</span>
              <span className="xs:hidden">Dashboard</span>
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-xl px-3 text-sm font-semibold text-white/90 transition hover:bg-white/10 hover:text-white lg:hidden"
              >
                Log in
              </Link>
              <Link
                href="/login"
                className="hidden min-h-[44px] items-center whitespace-nowrap rounded-xl bg-electric-600 px-4 text-sm font-semibold text-white shadow-md shadow-electric-600/30 transition hover:bg-electric-500 lg:inline-flex"
              >
                Login / Sign Up
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="public-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-white transition hover:bg-white/10 lg:hidden"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Phone / tablet menu */}
      {menuOpen && (
        <div id="public-menu" className="fixed inset-x-0 bottom-0 top-[calc(4rem+env(safe-area-inset-top))] z-40 overflow-y-auto bg-navy-950 px-4 pb-8 pt-2 animate-fade-in lg:hidden">
          <nav aria-label="Menu" className="divide-y divide-white/10">
            {MAIN_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="flex min-h-[52px] items-center text-base font-semibold text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-surface-400">Services</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {featuredServices.map((s) => (
              <Link
                key={s.name}
                href={serviceHref(s, customer)}
                onClick={() => setMenuOpen(false)}
                className="flex min-h-[56px] items-center gap-2.5 rounded-xl bg-white/5 px-3 text-sm font-medium text-white"
              >
                <s.icon className="h-5 w-5 shrink-0 text-sky-300" />
                <span className="min-w-0 leading-tight">{s.periodic ? 'Service packages' : s.name}</span>
              </Link>
            ))}
          </div>
          <Link href="/services" onClick={() => setMenuOpen(false)} className="mt-2 flex min-h-[48px] items-center justify-center rounded-xl border border-white/15 text-sm font-semibold text-white">
            View all services
          </Link>
          {!signedIn && (
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Link href="/login" className="flex min-h-[48px] items-center justify-center rounded-xl border border-white/20 text-sm font-semibold text-white">
                Log in
              </Link>
              <Link href="/register" className="flex min-h-[48px] items-center justify-center rounded-xl bg-electric-600 text-sm font-semibold text-white">
                Sign up
              </Link>
              <Link
                href="/register/garage"
                className="col-span-2 flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-white/5 text-sm font-semibold text-white"
              >
                <Store className="h-4 w-4 text-sky-300" aria-hidden /> Own a garage? Register it
              </Link>
            </div>
          )}
          {SUPPORT_PHONE && (
            <a href={telHref(SUPPORT_PHONE)} className="mt-4 flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-white/5 text-sm font-semibold text-white">
              <Phone className="h-4 w-4" aria-hidden /> Call {SUPPORT_PHONE}
            </a>
          )}
        </div>
      )}
    </header>
  );
}

function navLink(active: boolean) {
  return `relative inline-flex min-h-[44px] items-center whitespace-nowrap rounded-lg px-2.5 transition xl:px-3 ${
    active ? 'text-white after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-electric-500' : 'text-white/75 hover:text-white'
  }`;
}
