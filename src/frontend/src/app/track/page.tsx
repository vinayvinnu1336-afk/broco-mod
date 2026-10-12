'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Bell, CalendarCheck, CarFront, ClipboardCheck, KeyRound, Wrench } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PublicHeader } from '../_public/PublicHeader';
import { PublicFooter } from '../_public/PublicFooter';
import { isCustomer } from '../_public/services';

const STAGES = [
  { icon: CalendarCheck, title: 'Booking confirmed', desc: 'Your 10% advance is paid and a verified garage is assigned.' },
  { icon: CarFront, title: 'Car received', desc: 'The garage records the odometer reading when your car arrives.' },
  { icon: ClipboardCheck, title: 'Inspection', desc: 'Findings and anything extra are shared with you before work starts.' },
  { icon: Wrench, title: 'Work in progress', desc: 'Updates as the service moves along. Nothing extra is done without your OK.' },
  { icon: KeyRound, title: 'Ready & handed over', desc: 'Pay the balance at the garage and drive away.' },
];

export default function TrackPage() {
  const { user, isAuthenticated } = useAuth();
  const customer = isAuthenticated && isCustomer(user?.roles);
  const target = '/customer/requests';

  return (
    <div className="min-h-screen bg-surface-50 text-navy-900">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-14">
        <p className="text-sm font-semibold text-electric-600">Track service</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-4xl">Follow your car at every step</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-navy-500 sm:text-lg">
          Every BroCo booking has a live status page and you get a notification at each stage.
        </p>

        <div className="mt-6 rounded-2xl border border-surface-200 bg-white p-5 shadow-card sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-electric-50 text-electric-600">
              <Bell className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold">{customer ? 'Your bookings' : 'Log in to track your booking'}</h2>
              <p className="mt-0.5 text-sm text-navy-500">
                {customer
                  ? 'Open a booking to see its status, the garage and what you have paid.'
                  : 'Use the account you booked with. Your booking number starts with BM-.'}
              </p>
            </div>
          </div>
          <Link
            href={customer ? target : `/login?next=${encodeURIComponent(target)}`}
            className="mt-4 inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-electric-600 px-5 text-base font-bold text-white shadow-md shadow-electric-600/25 transition hover:bg-electric-700 sm:w-auto"
          >
            {customer ? 'See my bookings' : 'Log in to track'} <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        </div>

        <h2 className="mt-10 text-lg font-bold">What you&apos;ll see</h2>
        <ol className="relative mt-4 space-y-5 border-l-2 border-dashed border-electric-200 pl-6">
          {STAGES.map((s, i) => (
            <li key={s.title} className="relative">
              <span className="absolute -left-[39px] flex h-7 w-7 items-center justify-center rounded-full bg-electric-600 text-xs font-bold text-white ring-4 ring-surface-50">
                {i + 1}
              </span>
              <p className="flex items-center gap-2 font-semibold">
                <s.icon className="h-4 w-4 text-electric-600" aria-hidden /> {s.title}
              </p>
              <p className="mt-0.5 text-sm text-navy-500">{s.desc}</p>
            </li>
          ))}
        </ol>
      </main>
      <PublicFooter />
    </div>
  );
}
