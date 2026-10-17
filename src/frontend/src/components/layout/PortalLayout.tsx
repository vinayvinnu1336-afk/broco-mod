'use client';

import React, { useState, ReactNode, useMemo } from 'react';
import { BroCoMark } from '@/components/brand/BroCoLogo';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { LogOut, MoreHorizontal, Plus, Sparkles, ChevronRight } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { isDemoMode } from '@/lib/demo';
import { LEGAL_LINKS } from '@/content/legal/business';

export interface NavItem {
  label: string;
  /** Short label for the phone tab bar (max ~10 characters). Defaults to `label`. */
  shortLabel?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  /** Shown in the phone tab bar. Up to 4 items; the rest go under "More". */
  primary?: boolean;
  /** Sidebar group heading on desktop. */
  section?: string;
}

export interface PortalAction {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface PortalLayoutProps {
  children: ReactNode;
  portalName: string;
  /** Accent for the portal chip, e.g. 'bg-amber-50 text-amber-700 border-amber-200'. */
  portalBadgeColor?: string;
  navItems: NavItem[];
  /** The one thing users of this portal do most (customer: Book service). Raised centre tab on phones. */
  primaryAction?: PortalAction;
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalLayout({
  children,
  portalName,
  portalBadgeColor = 'bg-electric-50 text-electric-700 border-electric-200',
  navItems,
  primaryAction,
}: PortalLayoutProps) {
  const pathname = usePathname() ?? '';
  const { user, logout, quickLogin } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const { tabItems, overflowItems } = useMemo(() => {
    const flagged = navItems.filter((i) => i.primary);
    // Five slots at most: tabs + optional centre action + "More".
    const tabs = (flagged.length ? flagged : navItems).slice(0, primaryAction ? 3 : 4);
    const overflow = navItems.filter((i) => !tabs.includes(i));
    return { tabItems: tabs, overflowItems: overflow };
  }, [navItems, primaryAction]);

  // Longest matching href wins so /customer/requests/new does not also light up /customer/requests.
  const activeHref = useMemo(() => {
    const candidates = [...navItems.map((i) => i.href), ...(primaryAction ? [primaryAction.href] : [])];
    return candidates
      .filter((href) => isActivePath(pathname, href))
      .sort((a, b) => b.length - a.length)[0];
  }, [navItems, primaryAction, pathname]);

  const overflowActive = overflowItems.some((i) => i.href === activeHref);
  const portalShortName = portalName.replace(/\s*Portal$/i, '');

  const sections = useMemo(() => {
    const groups: { title?: string; items: NavItem[] }[] = [];
    for (const item of navItems) {
      const last = groups[groups.length - 1];
      if (last && last.title === item.section) last.items.push(item);
      else groups.push({ title: item.section, items: [item] });
    }
    return groups;
  }, [navItems]);

  const renderBadge = (badge: NavItem['badge'], active: boolean) =>
    badge !== undefined && badge !== 0 && badge !== '' ? (
      <span
        className={`min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold leading-none ${
          active ? 'bg-white/20 text-white' : 'bg-electric-50 text-electric-700'
        }`}
      >
        {badge}
      </span>
    ) : null;

  const DemoSwitcher = ({ compact = false }: { compact?: boolean }) =>
    isDemoMode ? (
      <div className={compact ? 'space-y-2' : 'flex items-center gap-1 rounded-xl border border-navy-700/80 bg-navy-800/90 p-1 text-xs'}>
        {compact ? (
          <>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-navy-500">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Demo accounts
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['customer', 'garage', 'advisor', 'admin'] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => quickLogin(role)}
                  className="min-h-[40px] rounded-xl border border-surface-200 bg-surface-50 text-sm font-medium capitalize text-navy-700 hover:bg-surface-100"
                >
                  {role}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5 px-2 font-semibold text-white">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Demo
            </span>
            {(['customer', 'garage', 'advisor', 'admin'] as const).map((role) => (
              <button
                key={role}
                onClick={() => quickLogin(role)}
                className="rounded-lg px-2.5 py-1 font-medium capitalize text-surface-200 transition hover:bg-navy-700"
              >
                {role}
              </button>
            ))}
          </>
        )}
      </div>
    ) : null;

  return (
    <div className="min-h-screen bg-surface-50 font-sans text-navy-900">
      {/* ===== Top bar ===== */}
      <header className="sticky top-0 z-40 border-b border-surface-200 bg-white/90 pt-safe backdrop-blur md:border-navy-800 md:bg-navy-900 md:text-white md:backdrop-blur-none">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 md:h-16 lg:px-8">
          <Link href={navItems[0]?.href ?? '/'} className="flex min-w-0 items-center gap-2.5">
            <BroCoMark size={36} />
            <span className="min-w-0 leading-tight">
              <span className="block text-[15px] font-extrabold tracking-tight md:text-lg">
                Bro<span className="text-electric-600 md:text-electric-400">Co</span>
              </span>
              <span className="block truncate text-[11px] font-medium text-navy-400 md:hidden">{portalShortName}</span>
            </span>
            <span className={`ml-1 hidden rounded-full border px-2.5 py-0.5 text-xs font-semibold md:inline-flex ${portalBadgeColor}`}>
              {portalName}
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden xl:block">
              <DemoSwitcher />
            </div>

            {user && (
              <button
                onClick={() => setAccountOpen(true)}
                className="flex items-center gap-2.5 rounded-full p-0.5 md:rounded-xl md:border-l md:border-navy-800 md:pl-3 md:pr-1"
                aria-label="Account menu"
              >
                <Avatar name={user.fullName || user.email} size="sm" />
                <span className="hidden text-left md:block">
                  <span className="block text-xs font-bold leading-tight text-white">{user.fullName || 'User'}</span>
                  <span className="block max-w-[160px] truncate text-[11px] leading-tight text-surface-400">{user.email}</span>
                </span>
              </button>
            )}

            <button
              onClick={() => logout()}
              className="hidden rounded-xl p-2 text-surface-300 transition hover:bg-navy-800 hover:text-white md:inline-flex"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 pt-4 sm:px-6 md:pt-6 lg:px-8">
        {/* ===== Desktop sidebar ===== */}
        <aside className="hidden w-60 shrink-0 md:block lg:w-64">
          <div className="sticky top-24 space-y-3">
            <nav className="space-y-4 rounded-2xl border border-surface-200 bg-white p-3 shadow-card" aria-label={`${portalName} navigation`}>
              {sections.map((section, idx) => (
                <div key={section.title ?? idx} className="space-y-0.5">
                  {section.title && (
                    <div className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-navy-400">{section.title}</div>
                  )}
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = item.href === activeHref;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                          active
                            ? 'bg-electric-600 text-white shadow-sm shadow-electric-600/20'
                            : 'text-navy-700 hover:bg-surface-100 hover:text-navy-900'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-navy-400'}`} />
                          {item.label}
                        </span>
                        {renderBadge(item.badge, active)}
                      </Link>
                    );
                  })}
                </div>
              ))}
              {primaryAction && (
                <Link
                  href={primaryAction.href}
                  className="flex items-center justify-center gap-2 rounded-xl bg-navy-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800"
                >
                  {primaryAction.icon ? <primaryAction.icon className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {primaryAction.label}
                </Link>
              )}
            </nav>
            <LegalLinks className="px-3" />
          </div>
        </aside>

        {/* ===== Content ===== */}
        <main className="min-w-0 flex-1 pb-bottom-nav">{children}</main>
      </div>

      {/* ===== Phone tab bar ===== */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-200 bg-white/95 pb-safe backdrop-blur md:hidden"
        aria-label={`${portalName} navigation`}
      >
        <div className="mx-auto flex h-16 max-w-lg items-stretch justify-around px-1">
          {(() => {
            const tabs: ReactNode[] = tabItems.map((item) => {
              const Icon = item.icon;
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className="relative flex flex-1 flex-col items-center justify-center gap-0.5 touch-manipulation"
                >
                  <span className={`flex h-7 w-12 items-center justify-center rounded-full transition ${active ? 'bg-electric-50 text-electric-600' : 'text-navy-400'}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className={`max-w-full truncate px-0.5 text-[11px] leading-tight ${active ? 'font-semibold text-electric-700' : 'font-medium text-navy-500'}`}>
                    {item.shortLabel ?? item.label}
                  </span>
                  {item.badge !== undefined && item.badge !== 0 && item.badge !== '' && (
                    <span className="absolute right-[22%] top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                  )}
                </Link>
              );
            });

            if (primaryAction) {
              const ActionIcon = primaryAction.icon ?? Plus;
              tabs.splice(
                Math.ceil(tabs.length / 2),
                0,
                <Link
                  key="primary-action"
                  href={primaryAction.href}
                  className="flex flex-1 flex-col items-center justify-center gap-0.5 touch-manipulation"
                >
                  <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-electric-600 text-white shadow-lg shadow-electric-600/40 ring-4 ring-white transition active:scale-95">
                    <ActionIcon className="h-6 w-6" />
                  </span>
                  <span className="text-[11px] font-semibold leading-tight text-electric-700">{primaryAction.label}</span>
                </Link>
              );
            }

            if (overflowItems.length > 0) {
              tabs.push(
                <button
                  key="more"
                  type="button"
                  onClick={() => setMoreOpen(true)}
                  className="flex flex-1 flex-col items-center justify-center gap-0.5 touch-manipulation"
                  aria-haspopup="dialog"
                >
                  <span className={`flex h-7 w-12 items-center justify-center rounded-full ${overflowActive ? 'bg-electric-50 text-electric-600' : 'text-navy-400'}`}>
                    <MoreHorizontal className="h-5 w-5" />
                  </span>
                  <span className={`text-[11px] leading-tight ${overflowActive ? 'font-semibold text-electric-700' : 'font-medium text-navy-500'}`}>More</span>
                </button>
              );
            }
            return tabs;
          })()}
        </div>
      </nav>

      {/* ===== "More" sheet (phones) ===== */}
      <Modal isOpen={moreOpen} onClose={() => setMoreOpen(false)} title={portalShortName} size="sm">
        <div className="-mx-2 space-y-0.5">
          {overflowItems.map((item) => {
            const Icon = item.icon;
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={`flex min-h-[52px] items-center gap-3 rounded-xl px-3 transition ${active ? 'bg-electric-50 text-electric-700' : 'text-navy-800 hover:bg-surface-50'}`}
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-electric-600 text-white' : 'bg-surface-100 text-navy-500'}`}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="flex-1 text-[15px] font-medium">{item.label}</span>
                {renderBadge(item.badge, false)}
                <ChevronRight className="h-4 w-4 text-surface-400" />
              </Link>
            );
          })}
        </div>
      </Modal>

      {/* ===== Account sheet ===== */}
      <Modal isOpen={accountOpen} onClose={() => setAccountOpen(false)} title="Account" size="sm">
        {user && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Avatar name={user.fullName || user.email} size="lg" />
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-navy-900">{user.fullName || 'User'}</div>
                <div className="truncate text-sm text-navy-500">{user.email}</div>
                <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${portalBadgeColor}`}>{portalName}</span>
              </div>
            </div>
            <DemoSwitcher compact />
            <button
              onClick={() => logout()}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-700 transition hover:bg-red-100"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
            <LegalLinks className="justify-center text-center" onNavigate={() => setAccountOpen(false)} />
          </div>
        )}
      </Modal>
    </div>
  );
}

/** Small policy links (sidebar on desktop, account sheet on phones). */
function LegalLinks({ className = '', onNavigate }: { className?: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Legal" className={`flex flex-wrap gap-x-3 gap-y-1 text-xs text-navy-400 ${className}`}>
      {LEGAL_LINKS.map((l) => (
        <Link key={l.href} href={l.href} onClick={onNavigate} className="py-1 transition hover:text-navy-700 hover:underline">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
