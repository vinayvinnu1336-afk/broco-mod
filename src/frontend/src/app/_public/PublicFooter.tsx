import React from 'react';
import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';
import { SUPPORT_EMAIL, SUPPORT_PHONE, telHref } from '@/lib/site';
import { BrandMark } from './PublicHeader';

const columns: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Services',
    links: [
      { href: '/services/car-service', label: 'Car service packages' },
      { href: '/services', label: 'All services' },
      { href: '/track', label: 'Track service' },
      { href: '/#how-it-works', label: 'How BroCo works' },
      { href: '/#faq', label: 'FAQ' },
    ],
  },
  {
    title: 'Account',
    links: [
      { href: '/login', label: 'Log in' },
      { href: '/register', label: 'Create an account' },
      { href: '/forgot-password', label: 'Forgot password' },
    ],
  },
  {
    title: 'Garages',
    links: [
      { href: '/register?role=garage', label: 'Register your garage' },
      { href: '/#garages', label: 'Why partner with BroCo' },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="pb-safe border-t border-navy-900 bg-navy-950 text-sm text-surface-400">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <BrandMark dark tagline />
            <p className="mt-3 max-w-xs text-sm leading-relaxed">
              Car service from verified garages, with clear prices upfront. Pay 10% online to book and the rest at the
              garage.
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-surface-300">
              <MapPin className="h-3.5 w-3.5" aria-hidden /> Now serving Hyderabad
            </p>
            {SUPPORT_PHONE && (
              <a href={telHref(SUPPORT_PHONE)} className="mt-2 flex min-h-[40px] items-center gap-1.5 text-sm text-white hover:text-sky-300">
                <Phone className="h-4 w-4" aria-hidden /> {SUPPORT_PHONE}
              </a>
            )}
            {SUPPORT_EMAIL && (
              <a href={`mailto:${SUPPORT_EMAIL}`} className="flex min-h-[40px] items-center gap-1.5 text-sm text-white hover:text-sky-300">
                <Mail className="h-4 w-4" aria-hidden /> {SUPPORT_EMAIL}
              </a>
            )}
          </div>

          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="font-semibold text-white">{col.title}</p>
              <ul className="mt-2 space-y-0.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="inline-flex min-h-[40px] items-center transition hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-8 space-y-3 border-t border-navy-800 pt-6 text-xs leading-relaxed">
          <p>
            BroCo is an independent car service platform. Car brand names and logos are trademarks of their respective
            owners and are used only to identify vehicles. BroCo is not affiliated with or authorised by any car
            manufacturer.
          </p>
          <p>© {new Date().getFullYear()} BroCo. Made for car owners in India.</p>
        </div>
      </div>
    </footer>
  );
}
