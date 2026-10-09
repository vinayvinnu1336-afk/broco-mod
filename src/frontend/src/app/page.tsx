'use client';

import React from 'react';
import Link from 'next/link';
import {
  Wrench,
  ShieldCheck,
  MapPin,
  ClipboardCheck,
  CreditCard,
  Activity,
  CalendarCheck,
  Disc,
  Snowflake,
  Zap,
  Paintbrush,
  Cog,
  ArrowRight,
  Check,
  ChevronDown,
  Store,
  FileText,
  Car,
  MessageSquare,
  BadgeCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { homePathForRoles } from '@/components/auth/ProtectedRoute';
import { formatINRWhole } from '@/lib/format';

const NEW_REQUEST_PATH = '/customer/requests/new';

const steps = [
  {
    icon: Car,
    title: 'Tell us what your car needs',
    desc: 'Add your car, pick a service or describe the problem, and choose where the car is.',
  },
  {
    icon: MapPin,
    title: 'We ask garages near you',
    desc: 'Your service advisor asks verified garages within 10 km to quote for the job.',
  },
  {
    icon: ClipboardCheck,
    title: 'Approve one clear quote',
    desc: 'The advisor compares the quotes and sends you one itemised quote. Nothing starts until you approve and pay.',
  },
  {
    icon: Activity,
    title: 'Track it until handover',
    desc: 'Follow each stage, from inspection to ready for pickup, right from your phone.',
  },
];

// Indicative starting prices only. The real price is always in the quote the customer approves.
const services: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string; from: number | null; unit?: string }[] = [
  {
    icon: CalendarCheck,
    title: 'Periodic service',
    desc: 'Engine oil and filter change, top-ups and a full multi-point check.',
    from: 2499,
  },
  {
    icon: Disc,
    title: 'Brakes and suspension',
    desc: 'Brake pads, discs, shock absorbers, noises and pulling to one side.',
    from: 999,
  },
  {
    icon: Snowflake,
    title: 'AC service',
    desc: 'Gas top-up, cooling issues, cabin filter and leak checks.',
    from: 1499,
  },
  {
    icon: Zap,
    title: 'Electrical and diagnostics',
    desc: 'Battery, warning lights, starting trouble and scanner diagnosis.',
    from: 499,
  },
  {
    icon: Paintbrush,
    title: 'Denting and painting',
    desc: 'Scratches, dents and panel repaint with colour matching.',
    from: 2199,
    unit: 'per panel',
  },
  {
    icon: Cog,
    title: 'Engine, clutch and gearbox',
    desc: 'Clutch wear, gear shifting, engine noise or loss of power.',
    from: null,
  },
];

const reasons = [
  {
    icon: ShieldCheck,
    title: 'Verified garages only',
    desc: 'Every workshop is checked by our team before it can quote on your car.',
  },
  {
    icon: FileText,
    title: 'One curated quote',
    desc: 'No calling around. Your advisor compares the quotes and sends you the one that makes sense, itemised.',
  },
  {
    icon: CreditCard,
    title: 'Pay only after you approve',
    desc: 'You see the full price first. Work starts only after you approve and pay online.',
  },
  {
    icon: Activity,
    title: 'Live tracking',
    desc: 'See where your car is in the process, and approve any extra work before it is done.',
  },
];

const garagePoints = [
  'Get service requests from car owners within 10 km of your workshop',
  'Send your quote for each job — a service advisor handles the customer',
  'Update job progress from your phone and get paid through the platform',
];

const faqs = [
  {
    q: 'How are garages chosen for my car?',
    a: 'When you book, we look for verified garages within 10 km of the location you choose. Your service advisor asks them to quote, then compares price, parts and timing before sending you the quote they recommend.',
  },
  {
    q: 'Do I have to accept the quote?',
    a: 'No. You see the full itemised quote first. Nothing is booked and you pay nothing until you approve it.',
  },
  {
    q: 'What if the garage finds more work once they start?',
    a: 'The garage has to raise it as a separate request. Your advisor reviews it and you approve or decline it before any extra work is done.',
  },
  {
    q: 'How do I know what is happening with my car?',
    a: 'Your booking shows each stage — inspection, work in progress, ready for handover — and updates as the garage moves the job along.',
  },
  {
    q: 'Are the prices on this page final?',
    a: 'No, they are indicative starting prices. The exact price depends on your car and the work needed, and it is always shown in your quote before you pay.',
  },
  {
    q: 'I run a garage. How do I join?',
    a: 'Create a workshop partner account with your business name and address. Once our team has verified your workshop, you will start receiving requests from car owners nearby.',
  },
];

function BrandMark() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="BroCo Mod home">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-electric-600 text-white shadow-md shadow-electric-600/30">
        <Wrench className="h-[18px] w-[18px]" />
      </span>
      <span className="text-[15px] font-extrabold tracking-tight text-navy-900 sm:text-lg">
        BroCo<span className="font-light text-electric-600"> Mod</span>
      </span>
    </Link>
  );
}

function SectionHeading({ eyebrow, title, desc, center = false }: { eyebrow: string; title: string; desc?: string; center?: boolean }) {
  return (
    <div className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <p className="text-sm font-semibold text-electric-600">{eyebrow}</p>
      <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">{title}</h2>
      {desc && <p className="mt-3 text-sm leading-relaxed text-navy-500 sm:text-base">{desc}</p>}
    </div>
  );
}

export default function HomePage() {
  const { user, isAuthenticated } = useAuth();
  const signedIn = isAuthenticated && !!user;

  // Signed-out visitors create an account first and then land on the booking form.
  const bookHref = signedIn ? NEW_REQUEST_PATH : `/register?redirect=${encodeURIComponent(NEW_REQUEST_PATH)}`;
  const accountHref = signedIn && user ? homePathForRoles(user.roles) : '/login';

  return (
    <div className="min-h-screen bg-surface-50 text-navy-900">
      {/* Header */}
      <header className="pt-safe sticky top-0 z-40 border-b border-surface-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:h-16 sm:px-6 lg:px-8">
          <BrandMark />

          <nav className="hidden items-center gap-6 text-sm font-medium text-navy-600 md:flex" aria-label="Main">
            <a href="#how-it-works" className="transition hover:text-electric-600">How it works</a>
            <a href="#services" className="transition hover:text-electric-600">Services</a>
            <a href="#garages" className="transition hover:text-electric-600">For garages</a>
            <a href="#faq" className="transition hover:text-electric-600">FAQ</a>
          </nav>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link
              href={accountHref}
              className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-xl px-2.5 text-sm font-semibold text-navy-700 transition hover:bg-surface-100 hover:text-navy-900 sm:px-3"
            >
              {signedIn ? 'Account' : 'Sign in'}
            </Link>
            <Link
              href={bookHref}
              className="inline-flex min-h-[40px] items-center whitespace-nowrap rounded-xl bg-electric-600 px-3 text-sm sm:px-3.5 font-semibold text-white shadow-sm shadow-electric-600/20 transition hover:bg-electric-700"
            >
              Book service
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-surface-200 bg-white">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-electric-100/70 blur-3xl sm:h-96 sm:w-96"
          />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-14 lg:grid-cols-12 lg:items-center lg:px-8 lg:py-20">
            <div className="lg:col-span-7">
              <p className="inline-flex items-center gap-1.5 rounded-full border border-electric-200 bg-electric-50 px-3 py-1 text-xs font-semibold text-electric-700">
                <MapPin className="h-3.5 w-3.5" />
                Verified garages within 10 km of you
              </p>

              <h1 className="mt-4 text-[2rem] font-extrabold leading-[1.15] tracking-tight text-navy-900 sm:text-5xl lg:text-[3.25rem]">
                Car service without the <span className="text-electric-600">guesswork</span>
              </h1>

              <p className="mt-4 max-w-xl text-base leading-relaxed text-navy-500 sm:text-lg">
                Tell us what your car needs. A service advisor gets quotes from verified garages nearby and sends you
                one clear quote. Approve it, pay online and follow your car until it&apos;s handed back.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={bookHref}
                  className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-electric-600 px-6 text-base font-semibold text-white shadow-sm shadow-electric-600/20 transition hover:bg-electric-700 sm:w-auto"
                >
                  Book a service <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href={accountHref}
                  className="inline-flex min-h-[52px] w-full items-center justify-center rounded-xl border border-surface-300 bg-white px-6 text-base font-semibold text-navy-800 transition hover:border-surface-400 hover:bg-surface-50 sm:w-auto"
                >
                  {signedIn ? 'Go to my account' : 'Sign in'}
                </Link>
              </div>

              <ul className="mt-7 grid gap-2.5 text-sm text-navy-600 sm:grid-cols-3 sm:gap-4">
                {['Verified garages', 'Pay after you approve', 'Live progress updates'].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Illustration of the booking journey (no real data) */}
            <div className="hidden lg:col-span-5 lg:block" aria-hidden>
              <div className="relative rounded-3xl border border-navy-800 bg-navy-900 p-6 text-white shadow-modal">
                <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-electric-600/25 blur-3xl" />
                <div className="relative">
                  <div className="flex items-center gap-3 border-b border-navy-800 pb-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-electric-600/30 text-electric-300">
                      <Car className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="text-sm font-semibold">Your booking</div>
                      <div className="text-xs text-surface-400">Every step in one place</div>
                    </div>
                  </div>
                  <ol className="mt-5 space-y-4">
                    {[
                      { label: 'Request sent', done: true },
                      { label: 'Quotes collected from nearby garages', done: true },
                      { label: 'Your curated quote is ready', done: true },
                      { label: 'Approved and paid', current: true },
                      { label: 'Car handed back' },
                    ].map((s) => (
                      <li key={s.label} className="flex items-center gap-3 text-sm">
                        {s.done ? (
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          </span>
                        ) : s.current ? (
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-electric-400">
                            <span className="h-2 w-2 rounded-full bg-electric-400" />
                          </span>
                        ) : (
                          <span className="h-6 w-6 shrink-0 rounded-full border border-navy-600" />
                        )}
                        <span className={s.done ? 'text-surface-300' : s.current ? 'font-semibold text-white' : 'text-surface-400'}>
                          {s.label}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-6 flex items-center gap-2 rounded-2xl border border-navy-700 bg-navy-800/80 p-3 text-xs text-surface-300">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                    Work starts only after you approve the quote.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-b border-surface-200 bg-surface-50 py-12 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="How it works"
              title="From booking to handover in four steps"
              desc="You deal with one service advisor. They deal with the garages."
            />

            <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <li key={step.title} className="flex gap-4 rounded-2xl border border-surface-200 bg-white p-4 shadow-card sm:flex-col sm:gap-3 sm:p-5">
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-50 text-electric-600">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="hidden text-sm font-semibold text-navy-400 sm:inline">Step {i + 1}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-navy-400 sm:hidden">Step {i + 1}</p>
                      <h3 className="text-base font-semibold text-navy-900">{step.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-navy-500">{step.desc}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* Services */}
        <section id="services" className="border-b border-surface-200 bg-white py-12 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Services"
              title="What we can help with"
              desc="Routine service or a problem you can't pin down — describe it and we'll get it quoted."
            />

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((svc) => {
                const Icon = svc.icon;
                return (
                  <Link
                    key={svc.title}
                    href={bookHref}
                    className="group flex flex-col rounded-2xl border border-surface-200 bg-white p-4 shadow-card transition hover:border-electric-200 hover:shadow-elevated sm:p-5"
                  >
                    <div className="flex items-start gap-3.5">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-100 text-navy-700 transition group-hover:bg-electric-50 group-hover:text-electric-600">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-navy-900">{svc.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-navy-500">{svc.desc}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-surface-100 pt-3">
                      <span className="text-sm text-navy-500">
                        {svc.from !== null ? (
                          <>
                            From <span className="tabular-nums font-semibold text-navy-900">{formatINRWhole(svc.from)}</span>
                            {svc.unit && <span className="text-navy-400"> {svc.unit}</span>}
                          </>
                        ) : (
                          <span className="font-medium text-navy-700">Priced after inspection</span>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-electric-600">
                        Book <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>

            <p className="mt-4 text-xs leading-relaxed text-navy-400">
              Indicative starting prices. Your exact price depends on your car and the work needed, and is shown in your
              quote before you pay anything.
            </p>
          </div>
        </section>

        {/* Why us */}
        <section id="why-us" className="border-b border-surface-200 bg-surface-50 py-12 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Why BroCo Mod"
              title="No calling around. No surprise bills."
              desc="We built BroCo Mod around the things that usually go wrong when you leave your car at a garage."
            />

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {reasons.map((r) => {
                const Icon = r.icon;
                return (
                  <div key={r.title} className="flex gap-4 rounded-2xl border border-surface-200 bg-white p-4 shadow-card sm:p-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-electric-600 text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-navy-900">{r.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-navy-500">{r.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* For garages */}
        <section id="garages" className="bg-navy-900 py-12 text-white sm:py-16 lg:py-20">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-8">
            <div>
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-electric-400">
                <Store className="h-4 w-4" /> For garages
              </p>
              <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight sm:text-3xl">
                Run a workshop? Get jobs from car owners nearby.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-surface-300 sm:text-base">
                Join BroCo Mod as a workshop partner. We bring you service requests from your area — you quote, do the
                work and update the job from your phone.
              </p>
              <Link
                href="/register?role=garage"
                className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-semibold text-navy-900 transition hover:bg-surface-100 sm:w-auto"
              >
                Register your garage <ArrowRight className="h-5 w-5" />
              </Link>
            </div>

            <ul className="space-y-3">
              {garagePoints.map((point) => (
                <li key={point} className="flex items-start gap-3 rounded-2xl border border-navy-700 bg-navy-800/70 p-4 text-sm leading-relaxed text-surface-200">
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-electric-400" />
                  {point}
                </li>
              ))}
              <li className="flex items-start gap-3 px-1 text-xs leading-relaxed text-surface-400">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                Workshops are verified by our team before they receive requests.
              </li>
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-b border-surface-200 bg-white py-12 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="FAQ" title="Common questions" center />

            <div className="mt-8 divide-y divide-surface-200 overflow-hidden rounded-2xl border border-surface-200 bg-white">
              {faqs.map((faq) => (
                <details key={faq.q} className="group">
                  <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-left text-sm font-semibold text-navy-900 transition hover:bg-surface-50 sm:px-5 sm:text-base [&::-webkit-details-marker]:hidden">
                    {faq.q}
                    <ChevronDown className="h-5 w-5 shrink-0 text-navy-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="px-4 pb-4 text-sm leading-relaxed text-navy-500 sm:px-5">{faq.a}</p>
                </details>
              ))}
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-2xl bg-surface-50 p-4 text-sm text-navy-500">
              <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-electric-600" />
              <p>
                Once you book, your service advisor is your single point of contact for questions about your car.
              </p>
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="bg-surface-50 py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl bg-electric-600 px-5 py-8 text-center text-white sm:px-10 sm:py-12">
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Ready to book your car in?</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-electric-100 sm:text-base">
                It takes a couple of minutes. You won&apos;t pay anything until you approve your quote.
              </p>
              <Link
                href={bookHref}
                className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-semibold text-electric-700 transition hover:bg-electric-50 sm:w-auto"
              >
                Book a service <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="pb-safe border-t border-navy-900 bg-navy-950 text-sm text-surface-400">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-electric-600 text-white">
                  <Wrench className="h-4 w-4" />
                </span>
                <span className="text-base font-extrabold tracking-tight text-white">
                  BroCo<span className="font-light text-electric-400"> Mod</span>
                </span>
              </div>
              <p className="mt-3 max-w-xs text-sm leading-relaxed">
                Car service from verified local garages, with one curated quote and live tracking.
              </p>
            </div>

            <nav aria-label="Product">
              <p className="font-semibold text-white">Product</p>
              <ul className="mt-3 space-y-1">
                <li><a href="#how-it-works" className="inline-block py-1.5 transition hover:text-white">How it works</a></li>
                <li><a href="#services" className="inline-block py-1.5 transition hover:text-white">Services</a></li>
                <li><a href="#garages" className="inline-block py-1.5 transition hover:text-white">For garages</a></li>
                <li><a href="#faq" className="inline-block py-1.5 transition hover:text-white">FAQ</a></li>
              </ul>
            </nav>

            <nav aria-label="Account">
              <p className="font-semibold text-white">Account</p>
              <ul className="mt-3 space-y-1">
                <li><Link href="/login" className="inline-block py-1.5 transition hover:text-white">Sign in</Link></li>
                <li><Link href="/register" className="inline-block py-1.5 transition hover:text-white">Create an account</Link></li>
                <li><Link href="/register?role=garage" className="inline-block py-1.5 transition hover:text-white">Register your garage</Link></li>
                <li><Link href="/forgot-password" className="inline-block py-1.5 transition hover:text-white">Forgot password</Link></li>
              </ul>
            </nav>
          </div>

          <div className="mt-8 border-t border-navy-900 pt-6 text-xs">
            © {new Date().getFullYear()} BroCo Mod. Made for car owners in India.
          </div>
        </div>
      </footer>
    </div>
  );
}
