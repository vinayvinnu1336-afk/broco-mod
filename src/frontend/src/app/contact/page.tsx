import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { Building2, ChevronRight, Clock, FileText, Mail, MapPin, MessageCircle, Phone, UserCheck } from 'lucide-react';
import { BUSINESS, LEGAL_LINKS, SERVICE_CITIES } from '@/content/legal/business';
import { telHref } from '@/lib/site';
import { PublicHeader } from '../_public/PublicHeader';
import { PublicFooter } from '../_public/PublicFooter';
import { BusinessValue } from '../_public/legalText';

export const metadata: Metadata = {
  title: 'Contact us',
  description:
    'Contact BRO Co Mobility Solutions (BroCo): customer support phone, WhatsApp and email, business address, Grievance Officer, and the cities we serve: Hyderabad, Bengaluru and Mancherial.',
};

/** 919876543210 -> +91 98765 43210 */
function formatWhatsapp(digits: string) {
  if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return `+${digits}`;
}

function Row({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-electric-50 text-electric-600 print:hidden">
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-navy-400">{label}</p>
        <div className="mt-0.5 break-words text-[15px] text-navy-900">{children}</div>
      </div>
    </div>
  );
}

function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={`rounded-2xl border border-surface-200 bg-white p-5 shadow-card sm:p-6 print:shadow-none ${className}`}>
      <h2 className="text-base font-bold text-navy-900">{title}</h2>
      {children}
    </section>
  );
}

export default function ContactPage() {
  const b = BUSINESS;
  const grievanceOfficer = [b.grievanceOfficerName, b.grievanceOfficerDesignation].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-surface-50 text-navy-900 print:bg-white">
      <PublicHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <p className="text-sm font-semibold text-electric-600">Contact us</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-4xl">We&apos;re here to help</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-navy-500 sm:text-lg">
          Questions about a booking, a payment or a refund? Reach our support team. Keep your booking number (it starts
          with BM-) handy.
        </p>

        <div className="mt-6 grid gap-4 sm:mt-8 md:grid-cols-2 md:items-start">
          <Card title="Customer support">
            <div className="mt-1 divide-y divide-surface-100">
              {b.supportPhone && (
                <Row icon={Phone} label="Phone">
                  <a href={telHref(b.supportPhone)} className="font-semibold text-electric-700 hover:underline">
                    {b.supportPhone}
                  </a>
                </Row>
              )}
              {b.supportWhatsapp && (
                <Row icon={MessageCircle} label="WhatsApp">
                  <a
                    href={`https://wa.me/${b.supportWhatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-electric-700 hover:underline"
                  >
                    {formatWhatsapp(b.supportWhatsapp)}
                  </a>
                </Row>
              )}
              {b.supportEmail && (
                <Row icon={Mail} label="Email">
                  <BusinessValue field="supportEmail" />
                </Row>
              )}
              {b.supportHours && (
                <Row icon={Clock} label="Support hours">
                  {b.supportHours}
                </Row>
              )}
            </div>
          </Card>

          <Card title="Business details">
            <div className="mt-1 divide-y divide-surface-100">
              <Row icon={Building2} label="Business name">
                <span className="font-semibold">{b.legalName}</span>
                {b.businessType && <span className="text-navy-500"> · {b.businessType}</span>}
              </Row>
              <Row icon={FileText} label="Website">
                <BusinessValue field="website" />
              </Row>
              {b.address && (
                <Row icon={MapPin} label="Business address">
                  <span className="whitespace-pre-line">{b.address}</span>
                </Row>
              )}
            </div>
          </Card>

          <Card title="Grievance Officer">
            <p className="mt-1 text-sm leading-relaxed text-navy-500">
              If your complaint isn&apos;t resolved by our support team, write to our Grievance Officer with your booking
              number and the details of the issue.
            </p>
            <div className="mt-1 divide-y divide-surface-100">
              {grievanceOfficer && (
                <Row icon={UserCheck} label="Name and designation">
                  {grievanceOfficer}
                </Row>
              )}
              {b.grievanceEmail && (
                <Row icon={Mail} label="Email">
                  <BusinessValue field="grievanceEmail" />
                </Row>
              )}
            </div>
          </Card>

          <Card title="Where we serve">
            <p className="mt-1 text-sm leading-relaxed text-navy-500">Car service from verified garages in:</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {SERVICE_CITIES.map((city) => (
                <li
                  key={city}
                  className="inline-flex items-center gap-1.5 rounded-full border border-electric-200 bg-electric-50 px-3 py-1.5 text-sm font-semibold text-electric-800"
                >
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> {city}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <nav aria-label="Policies" className="mt-8 print:hidden">
          <h2 className="text-lg font-bold">Policies</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {LEGAL_LINKS.filter((l) => l.href !== '/contact').map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-surface-200 bg-white px-4 text-[15px] font-medium text-navy-800 shadow-card transition hover:border-electric-200 hover:text-electric-700"
                >
                  {l.label}
                  <ChevronRight className="h-4 w-4 shrink-0 text-navy-400" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>
      <PublicFooter />
    </div>
  );
}
