import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { BadgeIndianRupee, CreditCard, MessageSquareQuote, Store } from 'lucide-react';
import { PublicHeader } from '../_public/PublicHeader';
import { PublicFooter } from '../_public/PublicFooter';
import { ServiceGrid } from '../_public/ServiceGrid';

export const metadata: Metadata = {
  title: 'Car services in Hyderabad',
  description:
    'Periodic service packages, AC, batteries, tyres, denting and painting, detailing, clutch, suspension and more from verified garages in Hyderabad.',
};

const pricing = [
  {
    icon: BadgeIndianRupee,
    title: 'Service packages',
    desc: 'Basic, Standard and Premium periodic service have a fixed price for your car model and fuel.',
  },
  {
    icon: MessageSquareQuote,
    title: 'Everything else',
    desc: 'Tell us what your car needs and verified garages send you quotes to choose from.',
  },
  {
    icon: CreditCard,
    title: 'Pay 10% to book',
    desc: 'Either way, you pay just 10% online to confirm the booking.',
  },
  {
    icon: Store,
    title: 'Rest at the garage',
    desc: 'Pay the remaining 90% directly at the garage after the service.',
  },
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-surface-50 text-navy-900">
      <PublicHeader />
      <main>
        <section className="border-b border-surface-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
            <nav aria-label="Breadcrumb" className="text-xs text-navy-400">
              <Link href="/" className="hover:text-navy-700">Home</Link>
              <span className="mx-1.5">/</span>
              <span className="text-navy-600">Services</span>
            </nav>
            <h1 className="mt-2 text-xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">All car services</h1>
            <p className="mt-1 max-w-2xl text-sm text-navy-500 sm:text-base">
              From routine service to repairs, done by verified garages in Hyderabad.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8" aria-label="Service categories">
          <ServiceGrid variant="detailed" />
        </section>

        <section className="border-t border-surface-200 bg-white py-8 sm:py-12" aria-labelledby="pricing-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 id="pricing-heading" className="text-xl font-extrabold tracking-tight text-navy-900 sm:text-2xl">
              How pricing works
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {pricing.map((p) => {
                const Icon = p.icon;
                return (
                  <li key={p.title} className="flex gap-3.5 rounded-2xl border border-surface-200 bg-surface-50 p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-electric-600 text-white">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-navy-900">{p.title}</h3>
                      <p className="mt-0.5 text-sm leading-relaxed text-navy-500">{p.desc}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
