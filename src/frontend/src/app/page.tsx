'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BadgeCheck,
  BadgeIndianRupee,
  Car,
  Check,
  ChevronDown,
  CreditCard,
  MapPin,
  ReceiptText,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { homePathForRoles } from '@/components/auth/ProtectedRoute';
import { useToast } from '@/components/ui/Toast';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { BrandLogo } from '@/components/catalogue/BrandLogo';
import { CarPicker, CarSelectField, CarSelection } from '@/components/catalogue/CarPicker';
import { Manufacturer, ServiceArea, catalogueApi, loadBookingIntent, saveBookingIntent } from '@/lib/catalogue';
import { PublicHeader } from './_public/PublicHeader';
import { PublicFooter } from './_public/PublicFooter';
import { ServiceGrid } from './_public/ServiceGrid';
import { CAR_SERVICE_PATH, CarChoice, carChoiceFrom } from './_public/services';

const DEFAULT_CITY = 'Hyderabad';
const MOBILE_RE = /^[6-9]\d{9}$/;
const FALLBACK_AREAS: ServiceArea[] = [
  { city: DEFAULT_CITY, state: 'Telangana', latitude: 17.385, longitude: 78.4867, radiusKm: 40, isLive: true },
];

const steps = [
  { icon: Car, title: 'Pick your car', desc: 'Choose the brand, model and fuel type. It takes a few taps.' },
  {
    icon: BadgeIndianRupee,
    title: 'Choose a service and see the price',
    desc: 'Service packages show a fixed price for your car. For repairs, verified garages send you quotes.',
  },
  { icon: CreditCard, title: 'Pay 10% to book', desc: 'Pay just 10% online to BroCo to confirm your booking.' },
  {
    icon: Store,
    title: 'Pay the rest at the garage',
    desc: 'Pay the remaining 90% directly at the garage once the service is done.',
  },
];

const faqs = [
  {
    q: 'How does payment work?',
    a: 'You see the price before you book. You pay 10% of it online to BroCo to confirm the booking, and the remaining 90% directly at the garage after the service is done.',
  },
  {
    q: 'Which services have a fixed price?',
    a: 'Our Basic, Standard and Premium periodic service packages have a fixed price for your car model and fuel type. For everything else (AC, batteries, tyres, denting and painting, detailing, clutch, suspension and other repairs) verified garages send you quotes, and you pay 10% online and the rest at the garage in the same way.',
  },
  {
    q: 'What if the garage finds more work?',
    a: 'Nothing extra is done without your approval. The garage has to raise the extra work with its price, and you can approve or decline it.',
  },
  {
    q: 'Can I cancel a booking?',
    a: 'Yes. The 10% advance is refundable if you cancel before the garage starts work.',
  },
  {
    q: 'Which cities do you serve?',
    a: 'BroCo is live in Hyderabad. Other cities are coming soon. Leave your number and we will let you know when we reach yours.',
  },
  {
    q: 'I run a garage. How do I join?',
    a: 'Create a garage partner account with your business details. Once our team has verified your workshop, you will start receiving bookings from car owners nearby.',
  },
];

function SectionHeading({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold text-electric-600">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">{title}</h2>
      {desc && <p className="mt-2 text-sm leading-relaxed text-navy-500 sm:text-base">{desc}</p>}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const toast = useToast();
  const { user, isAuthenticated } = useAuth();
  const signedIn = isAuthenticated && !!user;

  const [areas, setAreas] = useState<ServiceArea[] | null>(null);
  const [manufacturers, setManufacturers] = useState<Manufacturer[] | null>(null);
  const [city, setCity] = useState(DEFAULT_CITY);
  const [car, setCar] = useState<CarChoice | null>(null);
  const [mobile, setMobile] = useState('');
  const [errors, setErrors] = useState<{ city?: string; car?: string; mobile?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    catalogueApi.serviceAreas().then((res) => {
      if (active) setAreas(res.success && res.data?.length ? res.data : FALLBACK_AREAS);
    });
    catalogueApi.manufacturers().then((res) => {
      if (active) setManufacturers(res.success && res.data ? res.data : []);
    });
    // Remember the car from a previous visit.
    const intent = loadBookingIntent();
    if (intent?.modelId && intent.manufacturerId && intent.manufacturerName && intent.modelName && intent.fuelType) {
      setCar({
        manufacturerId: intent.manufacturerId,
        manufacturerName: intent.manufacturerName,
        modelId: intent.modelId,
        modelName: intent.modelName,
        fuelType: intent.fuelType,
      });
    }
    return () => {
      active = false;
    };
  }, []);

  // The saved intent has no logo; fill it in once the brand list is here.
  const logoFor = useMemo(() => {
    const map = new Map((manufacturers ?? []).map((m) => [m.id, m.logoUrl]));
    return (id: string) => map.get(id) ?? null;
  }, [manufacturers]);

  const cityOptions = (areas ?? FALLBACK_AREAS)
    .slice()
    .sort((a, b) => Number(b.isLive) - Number(a.isLive))
    .map((a) => ({ value: a.city, label: a.isLive ? a.city : `${a.city} (coming soon)`, disabled: !a.isLive }));
  const liveArea = (areas ?? FALLBACK_AREAS).find((a) => a.city === city && a.isLive);
  const hyderabad = (areas ?? FALLBACK_AREAS).find((a) => a.city === DEFAULT_CITY);
  const popularBrands = (manufacturers ?? []).filter((m) => m.isPopular).slice(0, 12);

  const chooseCar = (sel: CarSelection) => {
    setCar(carChoiceFrom(sel.manufacturer, sel.model, sel.fuelType));
    setErrors((e) => ({ ...e, car: undefined }));
  };

  const onMobileChange = (raw: string) => {
    let digits = raw.replace(/\D/g, '');
    // Accept pasted/autofilled numbers like "+91 98765 43210" or "098765 43210".
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    setMobile(digits.slice(0, 10));
    if (errors.mobile) setErrors((e) => ({ ...e, mobile: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!liveArea) next.city = 'We are only in Hyderabad for now.';
    if (!car) next.car = 'Select your car to see prices.';
    if (!MOBILE_RE.test(mobile)) {
      next.mobile = mobile ? 'Enter a valid 10-digit mobile number.' : 'Enter your mobile number.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || !car) {
      if (next.mobile && !next.car) mobileRef.current?.focus();
      return;
    }

    setSubmitting(true);
    // Save the enquiry, but never hold the visitor up for it.
    const lead = catalogueApi
      .createLead({
        mobileNumber: mobile,
        city,
        vehicleModelId: car.modelId,
        fuelType: car.fuelType,
        serviceInterest: 'Car Services',
      })
      .then((res) => res.success)
      .catch(() => false);
    const saved = await Promise.race([lead, new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500))]);
    if (saved === false) {
      toast.info('We could not save your number', 'No problem — you can still see prices and book.');
    }

    saveBookingIntent({
      city,
      manufacturerId: car.manufacturerId,
      manufacturerName: car.manufacturerName,
      modelId: car.modelId,
      modelName: car.modelName,
      fuelType: car.fuelType,
    });
    router.push(`${CAR_SERVICE_PATH}?model=${encodeURIComponent(car.modelId)}&fuel=${encodeURIComponent(car.fuelType)}`);
  };

  const pickFromBrands = (sel: CarSelection) => {
    chooseCar(sel);
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => mobileRef.current?.focus({ preventScroll: true }), 400);
  };

  return (
    <div className="min-h-screen bg-surface-50 text-navy-900">
      <PublicHeader />

      <main>
        {/* Hero + booking card */}
        <section id="book" className="relative overflow-hidden bg-navy-900 text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-electric-600/30 blur-3xl sm:h-[28rem] sm:w-[28rem]"
          />
          <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-5 px-4 pb-8 pt-5 sm:gap-8 sm:px-6 sm:pb-12 sm:pt-10 lg:grid-cols-12 lg:items-center lg:gap-12 lg:px-8 lg:py-16">
            <div className="min-w-0 lg:col-span-6">
              <p className="hidden items-center gap-1.5 rounded-full border border-electric-400/30 bg-electric-600/15 px-3 py-1 text-xs font-semibold text-electric-200 sm:inline-flex">
                <MapPin className="h-3.5 w-3.5" aria-hidden /> Now live in Hyderabad
              </p>
              <h1 className="text-[1.6rem] font-extrabold leading-[1.2] tracking-tight sm:mt-4 sm:text-4xl lg:text-5xl">
                Experience the best car services in <span className="text-electric-400">Hyderabad</span>
              </h1>
              <p className="mt-2 text-[15px] text-surface-300 sm:mt-3 sm:text-lg">Get instant prices for your car service</p>

              <ul className="mt-6 hidden gap-3 text-sm text-surface-200 lg:grid">
                {[
                  'Fixed prices for Basic, Standard and Premium service packages',
                  'Only 10% online to book — pay the rest at the garage after the service',
                  'Verified garages and a warranty on every service package',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div ref={cardRef} className="min-w-0 lg:col-span-6 xl:col-span-5 xl:col-start-8">
              <form
                onSubmit={submit}
                noValidate
                aria-label="Check car service prices"
                className="rounded-2xl bg-white p-4 text-navy-900 shadow-modal sm:p-6"
              >
                <div className="space-y-3.5">
                  <Select
                    label="Location"
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setErrors((x) => ({ ...x, city: undefined }));
                    }}
                    options={cityOptions}
                    error={errors.city}
                    className="min-h-[52px] border-surface-300 font-semibold"
                  />

                  <CarSelectField
                    label="Car"
                    value={car ? { ...car, logoUrl: car.logoUrl ?? logoFor(car.manufacturerId) } : null}
                    onChange={chooseCar}
                    placeholder="Select your car"
                    error={errors.car}
                  />

                  <div>
                    <label htmlFor="home-mobile" className="mb-1.5 block text-sm font-medium text-navy-800">
                      Mobile number
                    </label>
                    <div
                      className={`flex min-h-[52px] items-stretch overflow-hidden rounded-xl border bg-white transition focus-within:ring-2 ${
                        errors.mobile
                          ? 'border-semantic-error focus-within:ring-semantic-error/20'
                          : 'border-surface-300 focus-within:border-electric-600 focus-within:ring-electric-600/20'
                      }`}
                    >
                      <span className="flex items-center border-r border-surface-200 bg-surface-50 px-3 text-[15px] font-semibold text-navy-700">
                        +91
                      </span>
                      <input
                        ref={mobileRef}
                        id="home-mobile"
                        name="mobile"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        pattern="[6-9][0-9]{9}"
                        maxLength={14}
                        placeholder="10-digit mobile number"
                        value={mobile}
                        onChange={(e) => onMobileChange(e.target.value)}
                        onPaste={(e) => {
                          e.preventDefault();
                          onMobileChange(e.clipboardData.getData('text'));
                        }}
                        aria-invalid={!!errors.mobile}
                        aria-describedby={errors.mobile ? 'home-mobile-error' : undefined}
                        className="min-w-0 flex-1 bg-transparent px-3 text-base font-semibold tracking-wide text-navy-900 outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-surface-400"
                      />
                    </div>
                    {errors.mobile && (
                      <p id="home-mobile-error" className="mt-1 text-sm text-semantic-error">
                        {errors.mobile}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-5 inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-electric-600 px-5 text-base font-bold tracking-wide text-white shadow-md shadow-electric-600/30 transition hover:bg-electric-700 active:scale-[0.99] disabled:opacity-70"
                >
                  {submitting ? 'Checking prices…' : 'CHECK PRICES FOR FREE'}
                  {!submitting && <ArrowRight className="h-5 w-5" aria-hidden />}
                </button>

                <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-navy-500">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  Pay only 10% online to book. Pay the rest at the garage after the service.
                </p>
              </form>
            </div>
          </div>
        </section>

        {/* Services */}
        <section id="services" className="py-8 sm:py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between gap-3">
              <SectionHeading eyebrow="Services" title="Our services" />
              <Link
                href="/services"
                className="inline-flex min-h-[44px] shrink-0 items-center gap-1 text-sm font-semibold text-electric-600 hover:text-electric-700"
              >
                View all <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <div className="mt-5">
              <ServiceGrid variant="compact" />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-navy-400">
              Car service packages have fixed prices. Other services are quoted by verified garages for your car.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-y border-surface-200 bg-white py-10 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="How it works"
              title="How BroCo works"
              desc="Clear prices before you book, and most of the payment only after the work is done."
            />

            <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <li key={step.title} className="flex gap-4 rounded-2xl border border-surface-200 bg-surface-50 p-4 sm:flex-col sm:gap-3 sm:p-5">
                    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-electric-600 text-white">
                      <Icon className="h-5 w-5" aria-hidden />
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface-50 bg-navy-900 text-[10px] font-bold">
                        {i + 1}
                      </span>
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-navy-900">{step.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-navy-500">{step.desc}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            {/* Payment split illustration */}
            <div className="mt-5 rounded-2xl border border-surface-200 p-4 sm:p-5" aria-label="Payment split: 10% online to book, 90% at the garage">
              <p className="text-sm font-semibold text-navy-900">How your payment is split</p>
              <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-surface-100" aria-hidden>
                <span className="w-[10%] bg-electric-600" />
                <span className="flex-1 bg-navy-900/80" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="flex items-center gap-1.5 font-semibold text-electric-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-electric-600" aria-hidden /> 10% online
                  </p>
                  <p className="mt-0.5 text-xs text-navy-500">Paid to BroCo to confirm your booking</p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 font-semibold text-navy-900">
                    <span className="h-2.5 w-2.5 rounded-full bg-navy-900/80" aria-hidden /> 90% at the garage
                  </p>
                  <p className="mt-0.5 text-xs text-navy-500">Paid directly to the garage after the service</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Brands */}
        <section id="brands" className="py-10 sm:py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="Brands" title="We service all popular car brands" />
            {manufacturers === null ? (
              <div className="mt-5 grid grid-cols-4 gap-2.5 sm:grid-cols-6 lg:grid-cols-12">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-[88px] rounded-2xl" />
                ))}
              </div>
            ) : popularBrands.length > 0 ? (
              <ul className="mt-5 grid grid-cols-4 gap-2.5 sm:grid-cols-6 lg:grid-cols-12">
                {popularBrands.map((m) => (
                  <li
                    key={m.id}
                    className="flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-surface-200 bg-white p-2 text-center shadow-card"
                  >
                    <BrandLogo name={m.name} logoUrl={m.logoUrl} size={40} />
                    <span className="line-clamp-2 text-[11.5px] font-medium leading-tight text-navy-700">{m.name}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-surface-300 bg-white px-5 text-sm font-semibold text-navy-800 transition hover:border-surface-400 hover:bg-surface-50 sm:w-auto"
            >
              <Car className="h-4 w-4" aria-hidden /> Find your car
            </button>
            <CarPicker isOpen={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={pickFromBrands} />
          </div>
        </section>

        {/* Trust */}
        <section id="why-us" className="border-y border-surface-200 bg-white py-10 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="Why BroCo" title="Car care you can trust" />
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: ShieldCheck,
                  title: 'Verified garages',
                  desc: 'Every garage is checked by our team before it can take bookings.',
                },
                {
                  icon: ReceiptText,
                  title: 'Transparent prices',
                  desc: 'See the price for your car before you book. No extra work without your approval.',
                },
                {
                  icon: BadgeCheck,
                  title: 'Warranty on packages',
                  desc: 'Basic, Standard and Premium packages come with a service warranty.',
                },
                {
                  icon: MapPin,
                  title: 'Serving Hyderabad',
                  desc: hyderabad
                    ? `We cover Hyderabad and surroundings, up to ${hyderabad.radiusKm} km from the city centre.`
                    : 'We cover Hyderabad and surroundings. More cities are coming soon.',
                },
              ].map((r) => {
                const Icon = r.icon;
                return (
                  <div key={r.title} className="flex gap-4 rounded-2xl border border-surface-200 bg-white p-4 shadow-card sm:flex-col sm:gap-3 sm:p-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <Icon className="h-5 w-5" aria-hidden />
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
        <section id="garages" className="bg-navy-900 py-10 text-white sm:py-16">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-8">
            <div>
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-electric-400">
                <Store className="h-4 w-4" aria-hidden /> For garages
              </p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight sm:text-3xl">Run a garage in Hyderabad? Get bookings nearby.</h2>
              <p className="mt-2 text-sm leading-relaxed text-surface-300 sm:text-base">
                Join BroCo as a garage partner. Car owners book and pay the advance online; you do the work and collect the
                rest at your garage.
              </p>
            </div>
            <div>
              <Link
                href="/register?role=garage"
                className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-semibold text-navy-900 transition hover:bg-surface-100 sm:w-auto"
              >
                Register your garage <ArrowRight className="h-5 w-5" aria-hidden />
              </Link>
              <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-surface-400">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Garages are verified by our team before they receive bookings.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-white py-10 sm:py-16">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="FAQ" title="Common questions" />
            <div className="mt-6 divide-y divide-surface-200 overflow-hidden rounded-2xl border border-surface-200 bg-white">
              {faqs.map((faq) => (
                <details key={faq.q} className="group">
                  <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-left text-sm font-semibold text-navy-900 transition hover:bg-surface-50 sm:px-5 sm:text-base [&::-webkit-details-marker]:hidden">
                    {faq.q}
                    <ChevronDown className="h-5 w-5 shrink-0 text-navy-400 transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="px-4 pb-4 text-sm leading-relaxed text-navy-500 sm:px-5">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="bg-surface-50 py-10 sm:py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl bg-electric-600 px-5 py-8 text-center text-white sm:px-10 sm:py-12">
              <h2 className="text-xl font-extrabold tracking-tight sm:text-3xl">See the price for your car in seconds</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-electric-100 sm:text-base">
                Pick your car and compare Basic, Standard and Premium packages. Pay only 10% to book.
              </p>
              <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <Link
                  href={CAR_SERVICE_PATH}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-semibold text-electric-700 transition hover:bg-electric-50"
                >
                  View service packages <ArrowRight className="h-5 w-5" aria-hidden />
                </Link>
                {signedIn && user ? (
                  <Link
                    href={homePathForRoles(user.roles ?? [])}
                    className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-white/40 px-6 text-base font-semibold text-white transition hover:bg-white/10"
                  >
                    Go to my dashboard
                  </Link>
                ) : (
                  <Link
                    href="/register"
                    className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-white/40 px-6 text-base font-semibold text-white transition hover:bg-white/10"
                  >
                    Create a free account
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
