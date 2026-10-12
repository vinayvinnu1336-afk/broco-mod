'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, BadgeIndianRupee, MessageSquareQuote } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { loadBookingIntent, saveBookingIntent } from '@/lib/catalogue';
import { SERVICE_CATEGORIES, ServiceCategory, isCustomer, serviceHref } from './services';

function rememberCategory(category: ServiceCategory) {
  if (category.periodic) return;
  const current = loadBookingIntent();
  saveBookingIntent({ ...(current ?? {}), city: current?.city || 'Hyderabad', serviceCategory: category.name, packageCode: undefined });
}

/**
 * The service categories. `compact` = icon tiles (home page); `detailed` = cards with descriptions (/services).
 * "Car Services" is shown as a wide featured tile because it is the one with fixed prices.
 */
export function ServiceGrid({ variant = 'compact' }: { variant?: 'compact' | 'detailed' }) {
  const { user, isAuthenticated } = useAuth();
  const customer = isAuthenticated && isCustomer(user?.roles);
  const [featured, ...others] = SERVICE_CATEGORIES;
  const FeaturedIcon = featured.icon;

  return (
    <div className="space-y-3">
      <Link
        href={serviceHref(featured, customer)}
        className="group flex items-center gap-4 rounded-2xl border border-electric-200 bg-gradient-to-br from-electric-50 to-white p-4 shadow-card transition hover:border-electric-300 hover:shadow-elevated sm:p-5"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-electric-600 text-white shadow-sm shadow-electric-600/30">
          <FeaturedIcon className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-base font-semibold text-navy-900">{featured.name}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              <BadgeIndianRupee className="h-3 w-3" aria-hidden /> Fixed prices
            </span>
          </span>
          <span className="mt-0.5 block text-sm leading-snug text-navy-500">{featured.desc}</span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-electric-600 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>

      {variant === 'compact' ? (
        <ul className="grid grid-cols-3 gap-2.5 sm:gap-3 lg:grid-cols-9">
          {others.map((cat) => {
            const Icon = cat.icon;
            return (
              <li key={cat.name}>
                <Link
                  href={serviceHref(cat, customer)}
                  onClick={() => rememberCategory(cat)}
                  className="group flex h-full min-h-[104px] flex-col items-center justify-center gap-2 rounded-2xl border border-surface-200 bg-white p-2.5 text-center shadow-card transition hover:border-electric-200 hover:shadow-elevated active:scale-[0.98]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-100 text-navy-700 transition group-hover:bg-electric-50 group-hover:text-electric-600">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[12.5px] font-semibold leading-tight text-navy-800 sm:text-[13px]">{cat.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((cat) => {
            const Icon = cat.icon;
            return (
              <li key={cat.name}>
                <Link
                  href={serviceHref(cat, customer)}
                  onClick={() => rememberCategory(cat)}
                  className="group flex h-full items-start gap-3.5 rounded-2xl border border-surface-200 bg-white p-4 shadow-card transition hover:border-electric-200 hover:shadow-elevated sm:p-5"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-100 text-navy-700 transition group-hover:bg-electric-50 group-hover:text-electric-600">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-navy-900">{cat.name}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-navy-500">{cat.desc}</span>
                    <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-electric-600">
                      <MessageSquareQuote className="h-4 w-4" aria-hidden /> Get quotes
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
