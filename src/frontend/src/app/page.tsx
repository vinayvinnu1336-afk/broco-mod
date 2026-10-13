'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BadgeCheck,
  BadgeIndianRupee,
  BellRing,
  CalendarCheck,
  CarFront,
  ChevronDown,
  Clock,
  CreditCard,
  Gauge,
  HandCoins,
  KeyRound,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  ShieldCheck,
  Store,
  Truck,
  Wrench,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { homePathForRoles } from '@/components/auth/ProtectedRoute';
import { useToast } from '@/components/ui/Toast';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { BrandLogo } from '@/components/catalogue/BrandLogo';
import { CarPicker, CarSelectField, CarSelection } from '@/components/catalogue/CarPicker';
import { PackageIncludes } from '@/components/catalogue/PackageIncludes';
import {
  Manufacturer,
  ServiceArea,
  ServicePackage,
  catalogueApi,
  formatHours,
  loadBookingIntent,
  saveBookingIntent,
} from '@/lib/catalogue';
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_WHATSAPP, hasSupportContact, telHref } from '@/lib/site';
import { PublicHeader } from './_public/PublicHeader';
import { PublicFooter } from './_public/PublicFooter';
import {
  CAR_SERVICE_PATH,
  CarChoice,
  SERVICE_CATEGORIES,
  carChoiceFrom,
  isCustomer,
  serviceHref,
} from './_public/services';

const DEFAULT_CITY = 'Hyderabad';
const MOBILE_RE = /^[6-9]\d{9}$/;
const FALLBACK_AREAS: ServiceArea[] = [
  { city: DEFAULT_CITY, state: 'Telangana', latitude: 17.385, longitude: 78.4867, radiusKm: 40, isLive: true },
];

/** Small promises under the headline (all true for every BroCo booking). */
const HIGHLIGHTS = [
  { icon: BellRing, label: 'Live job updates' },
  { icon: Truck, label: 'Free pick-up & drop' },
  { icon: BadgeCheck, label: 'Verified garages' },
  { icon: BadgeIndianRupee, label: 'Transparent pricing' },
  { icon: ShieldCheck, label: 'Service warranty' },
];

/** The six cards in "Our popular services": name must match a booking category. */
const POPULAR: { name: string; title: string; desc: string; tone: string; cta: string }[] = [
  { name: 'Car Services', title: 'General Service', desc: 'Basic, Standard & Premium packages: oil, filters, brakes & more', tone: 'bg-electric-50 text-electric-600', cta: 'text-electric-700' },
  { name: 'AC Service & Repair', title: 'AC Service', desc: 'Gas refill, poor cooling, compressor & leak repair', tone: 'bg-sky-50 text-sky-600', cta: 'text-sky-700' },
  { name: 'Denting & Painting', title: 'Body Shop', desc: 'Dent & scratch repair, panel paint, bumper fixes', tone: 'bg-violet-50 text-violet-600', cta: 'text-violet-700' },
  { name: 'Clutch & Body Parts', title: 'Repairs', desc: 'Clutch, brakes, suspension & engine repairs', tone: 'bg-orange-50 text-orange-600', cta: 'text-orange-700' },
  { name: 'Batteries', title: 'Batteries', desc: 'Battery check, jump-start issues & replacement', tone: 'bg-emerald-50 text-emerald-600', cta: 'text-emerald-700' },
  { name: 'Detailing & Car Spa', title: 'Car Spa', desc: 'Foam wash, interior deep clean, polish & coating', tone: 'bg-rose-50 text-rose-600', cta: 'text-rose-700' },
];

const WHY = [
  { icon: BellRing, title: 'Live updates', desc: 'Every step of your service, as it happens' },
  { icon: CreditCard, title: 'Pay 10% to book', desc: 'The rest only after the work is done' },
  { icon: BadgeCheck, title: 'Verified garages', desc: 'Every workshop is checked before joining' },
  { icon: BadgeIndianRupee, title: 'Transparent pricing', desc: 'Garage price = your price. No markup' },
  { icon: ShieldCheck, title: 'Up to 3,000 km warranty', desc: 'On Basic, Standard & Premium service' },
];

const STEPS = [
  { icon: CalendarCheck, title: 'Book service', desc: 'Pick your car & package, see the price, pay 10% to book' },
  { icon: Truck, title: 'Free pick-up', desc: 'We collect your car from your doorstep on service packages' },
  { icon: Wrench, title: 'Service', desc: 'Serviced at a verified garage with live status updates' },
  { icon: HandCoins, title: 'Approve & pay', desc: 'Approve any extra work first; pay the balance after the job' },
  { icon: KeyRound, title: 'Delivery', desc: 'Your car comes back to you, with a service warranty' },
];

const FAQS = [
  {
    q: 'How does payment work?',
    a: 'You see the price before you book. You pay 10% of it online to BroCo to confirm the booking, and the remaining 90% directly to the garage after the service is done.',
  },
  {
    q: 'What is included in Basic, Standard and Premium service?',
    a: 'Each package lists exactly what is done: fluids & filters, brake care, safety inspections, an OBD health report, a car spa and free pick-up & drop. Premium adds wheel alignment, balancing and throttle body cleaning. Open “Car service packages” to compare them for your car.',
  },
  {
    q: 'Which services have a fixed price?',
    a: 'Basic, Standard and Premium service have a fixed price for your car model and fuel. For repairs, AC, batteries, tyres, denting & painting and detailing, verified garages send you a quote, and you pay 10% online and the rest at the garage in the same way.',
  },
  {
    q: 'What if the garage finds more work?',
    a: 'Nothing extra is done without your approval. The garage raises the extra work with its price, and you can approve or decline it.',
  },
  {
    q: 'Can I cancel a booking?',
    a: 'Yes. The 10% advance is refundable if you cancel before the garage starts work.',
  },
  {
    q: 'Which cities do you serve?',
    a: 'BroCo is live in Hyderabad. Other cities are coming soon — leave your number and we will let you know when we reach yours.',
  },
];

function SectionHeading({ eyebrow, title, desc, id }: { eyebrow?: string; title: string; desc?: string; id?: string }) {
  return (
    <div className="max-w-2xl">
      {eyebrow && <p className="text-xs font-bold uppercase tracking-wider text-electric-600">{eyebrow}</p>}
      <h2 id={id} className="mt-1 text-[22px] font-extrabold leading-tight tracking-tight text-navy-900 sm:text-3xl">
        {title}
      </h2>
      {desc && <p className="mt-2 text-sm leading-relaxed text-navy-500 sm:text-base">{desc}</p>}
    </div>
  );
}

/** Small promises under the headline: a swipeable row of pills on phones, icon tiles on laptops. */
function HighlightRow({ className = '' }: { className?: string }) {
  return (
    <ul
      aria-label="Why BroCo"
      className={`no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:scroll-px-6 sm:px-6 md:justify-between lg:-mx-8 lg:scroll-px-8 lg:px-8 xl:mx-0 xl:justify-start xl:overflow-visible xl:px-0 ${className}`}
    >
      {HIGHLIGHTS.map((h) => (
        <li
          key={h.label}
          className="flex shrink-0 snap-start items-center gap-2 rounded-full border border-electric-100 bg-white px-3 py-2 text-xs font-semibold text-navy-700 shadow-subtle xl:w-[78px] xl:flex-col xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:text-center xl:shadow-none"
        >
          <span className="flex h-6 w-6 items-center justify-center text-electric-600 xl:h-10 xl:w-10 xl:rounded-xl xl:bg-white xl:shadow-card">
            <h.icon className="h-4 w-4 xl:h-5 xl:w-5" aria-hidden />
          </span>
          <span className="xl:leading-tight">{h.label}</span>
        </li>
      ))}
    </ul>
  );
}

export default function HomePage() {
  const router = useRouter();
  const toast = useToast();
  const { user, isAuthenticated } = useAuth();
  const signedIn = isAuthenticated && !!user;
  const customer = signedIn && isCustomer(user?.roles);

  const [areas, setAreas] = useState<ServiceArea[] | null>(null);
  const [manufacturers, setManufacturers] = useState<Manufacturer[] | null>(null);
  const [packages, setPackages] = useState<ServicePackage[] | null>(null);
  const [city, setCity] = useState(DEFAULT_CITY);
  const [car, setCar] = useState<CarChoice | null>(null);
  const [mobile, setMobile] = useState('');
  const [errors, setErrors] = useState<{ city?: string; car?: string; mobile?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tab, setTab] = useState<'book' | 'track'>('book');
  const [ctaVisible, setCtaVisible] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLElement | null>(null);
  const mobileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    catalogueApi.serviceAreas().then((res) => {
      if (active) setAreas(res.success && res.data?.length ? res.data : FALLBACK_AREAS);
    });
    catalogueApi.manufacturers().then((res) => {
      if (active) setManufacturers(res.success && res.data ? res.data : []);
    });
    catalogueApi.packages().then((res) => {
      if (active) setPackages(res.success && res.data ? res.data : []);
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

  // Phones: a sticky "Book a service" bar whenever the card's main button is not on screen
  // (below the fold on first load, or scrolled past). Re-observed when the tab swaps the button.
  useEffect(() => {
    const el = ctaRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setCtaVisible(entry.intersectionRatio >= 0.6), { threshold: [0, 0.6, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, [tab]);

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
  const popularBrands = (manufacturers ?? []).filter((m) => m.isPopular).slice(0, 12);
  const carServiceHref = car
    ? `${CAR_SERVICE_PATH}?model=${encodeURIComponent(car.modelId)}&fuel=${encodeURIComponent(car.fuelType)}`
    : CAR_SERVICE_PATH;

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

  const scrollToCard = (focusMobile = false) => {
    setTab('book');
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    cardRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    if (focusMobile) setTimeout(() => mobileRef.current?.focus({ preventScroll: true }), 450);
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
    router.push(carServiceHref);
  };

  const pickFromBrands = (sel: CarSelection) => {
    chooseCar(sel);
    scrollToCard(true);
  };

  return (
    <div className="min-h-screen bg-white text-navy-900">
      <PublicHeader />

      <main className="pb-24 lg:pb-0">
        {/* ============ Hero ============ */}
        <section id="book" aria-labelledby="hero-title" className="relative bg-white">
          {/*
            Photo + headline.
            Phones & tablets: the photo is a banner under the header and the headline follows it.
            Laptops (lg+): the photo fills the band, right-aligned at its natural shape, and the headline sits
            on its faded left side. Nothing overlaps the bottom of the photo: the car's tyres touch that edge.
          */}
          <div className="relative lg:flex lg:h-[clamp(400px,34vw,520px)] lg:items-center lg:overflow-hidden">
            <div className="relative aspect-[9/4] max-h-[52svh] w-full overflow-hidden bg-[#F4F8FC] sm:aspect-[21/9] lg:absolute lg:inset-0 lg:aspect-auto lg:max-h-none lg:bg-white">
              <picture>
                <source media="(min-width: 640px)" srcSet="/images/hero-service-centre-890.jpg" />
                {/* eslint-disable-next-line @next/next/no-img-element -- art-directed <picture>; sizes are pre-generated */}
                <img
                  src="/images/hero-service-centre-640.jpg"
                  srcSet="/images/hero-service-centre-640.jpg 640w, /images/hero-service-centre-890.jpg 890w"
                  sizes="100vw"
                  alt="A car parked outside the BroCo service centre"
                  width={890}
                  height={380}
                  fetchPriority="high"
                  decoding="async"
                  className="h-full w-full object-cover [object-position:90%_100%] sm:[object-position:100%_100%] lg:absolute lg:inset-y-0 lg:left-auto lg:right-0 lg:h-full lg:w-auto lg:max-w-none lg:[mask-image:linear-gradient(to_right,transparent,#000_14%)] min-[1800px]:right-[calc((100vw-1600px)/2)] min-[1800px]:[mask-image:linear-gradient(to_right,transparent,#000_14%,#000_86%,transparent)]"
                />
              </picture>
              {/* Keeps the headline readable over the photo's faded left side (laptops). */}
              <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 hidden w-[40%] bg-gradient-to-r from-white via-white/75 to-transparent lg:block" />
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-electric-700 shadow-subtle backdrop-blur sm:left-6 sm:top-4 lg:hidden">
                <MapPin className="h-3.5 w-3.5" aria-hidden /> Now live in Hyderabad
              </span>
            </div>

            <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-0">
              <div className="max-w-2xl lg:max-w-[440px] xl:max-w-[560px]">
                <p className="hidden items-center gap-1.5 rounded-full border border-electric-200 bg-white/90 px-3 py-1 text-xs font-semibold text-electric-700 shadow-subtle lg:inline-flex">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> Now live in Hyderabad
                </p>
                <h1 id="hero-title" className="text-[30px] font-extrabold leading-[1.08] tracking-tight text-navy-950 sm:text-[44px] lg:mt-3 lg:text-[40px] xl:text-[52px]">
                  Your Vehicle,
                  <br />
                  Our <span className="bg-gradient-to-r from-electric-700 to-electric-500 bg-clip-text text-transparent">Responsibility.</span>
                </h1>
                <p className="mt-2.5 text-[15px] leading-relaxed text-navy-600 sm:mt-3 sm:text-lg lg:mt-4 lg:text-[17px] xl:text-lg">
                  Fixed-price car service from verified garages.{' '}
                  <span className="hidden sm:inline">Free pick‑up&nbsp;&amp;&nbsp;drop and live updates. </span>
                  Pay&nbsp;just 10%&nbsp;to&nbsp;book<span className="hidden sm:inline"> — the rest after the job is&nbsp;done</span>.
                </p>

                <HighlightRow className="mt-6 hidden xl:flex" />
              </div>
            </div>
          </div>

          {/* Booking: a card on phones, a bar under the photo from tablets up. */}
          <div className="relative mx-auto max-w-7xl px-4 pb-6 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-10">
            <div ref={cardRef} className="relative z-10 min-w-0">
              <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-modal [overflow:clip]">
                <div className="border-b border-surface-200 bg-surface-50 p-1 md:flex md:items-center md:justify-between md:pr-4">
                  <div role="tablist" aria-label="Book or track" className="grid grid-cols-2 md:inline-grid md:w-[340px]">
                    {(['book', 'track'] as const).map((t) => (
                      <button
                        key={t}
                        id={`home-tab-${t}`}
                        type="button"
                        role="tab"
                        aria-selected={tab === t}
                        aria-controls={`home-panel-${t}`}
                        tabIndex={tab === t ? 0 : -1}
                        onClick={() => setTab(t)}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
                            e.preventDefault();
                            const next = e.key === 'Home' ? 'book' : e.key === 'End' ? 'track' : t === 'book' ? 'track' : 'book';
                            setTab(next);
                            document.getElementById(`home-tab-${next}`)?.focus();
                          }
                        }}
                        className={`min-h-[42px] rounded-xl text-sm font-semibold transition ${
                          tab === t ? 'bg-white text-electric-700 shadow-card' : 'text-navy-500 hover:text-navy-800'
                        }`}
                      >
                        {t === 'book' ? 'Book Service' : 'Track Service'}
                      </button>
                    ))}
                  </div>
                  {tab === 'book' && (
                    <p className="hidden items-center gap-1.5 text-xs font-medium text-navy-500 md:inline-flex">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden /> Pay only 10% online to book · the rest at the garage
                    </p>
                  )}
                </div>

                {tab === 'book' ? (
                  <form id="home-panel-book" role="tabpanel" aria-labelledby="home-tab-book" onSubmit={submit} noValidate className="p-4 sm:p-5">
                    <h2 className="sr-only">Check car service prices</h2>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-start md:gap-4 xl:grid-cols-[180px_minmax(0,1.3fr)_minmax(250px,1fr)_auto]">
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

                      <div className="min-w-0">
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
                          <span className="flex items-center gap-1.5 border-r border-surface-200 bg-surface-50 px-3 text-[15px] font-semibold text-navy-700">
                            <span aria-hidden className="inline-block h-3 w-4 overflow-hidden rounded-[2px] bg-[linear-gradient(#FF9933_33%,#FFFFFF_33%_66%,#138808_66%)]" />
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
                            placeholder="10-digit number"
                            value={mobile}
                            onChange={(e) => onMobileChange(e.target.value)}
                            onPaste={(e) => {
                              e.preventDefault();
                              onMobileChange(e.clipboardData.getData('text'));
                            }}
                            aria-invalid={!!errors.mobile}
                            aria-describedby={errors.mobile ? 'home-mobile-error' : undefined}
                            className="min-w-0 flex-1 bg-transparent px-3 text-base font-semibold tracking-wide text-navy-900 outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-navy-400"
                          />
                        </div>
                        {errors.mobile && (
                          <p id="home-mobile-error" role="alert" className="mt-1.5 text-xs font-medium text-semantic-error">
                            {errors.mobile}
                          </p>
                        )}
                      </div>

                      {/* md+: lines up with the inputs, under their labels */}
                      <button
                        ref={(el) => {
                          ctaRef.current = el;
                        }}
                        type="submit"
                        disabled={submitting}
                        className="mt-1 inline-flex min-h-[54px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-electric-600 px-4 text-[15px] font-bold text-white shadow-md shadow-electric-600/30 transition hover:bg-electric-700 active:scale-[0.99] disabled:opacity-70 xs:px-6 xs:text-base xs:tracking-wide md:mt-[26px] md:min-h-[52px]"
                      >
                        {submitting ? (
                          'Checking prices…'
                        ) : (
                          <>
                            <span>
                              CHECK PRICES<span className="hidden min-[350px]:inline"> FOR FREE</span>
                            </span>
                          </>
                        )}
                        {!submitting && <ArrowRight className="h-5 w-5" aria-hidden />}
                      </button>
                    </div>

                    <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-navy-500 md:hidden">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                      Pay only 10% online to book. Pay the rest at the garage after the service.
                    </p>
                    {SUPPORT_PHONE && (
                      <p className="mt-3 border-t border-surface-100 pt-3 text-center text-sm text-navy-500 md:text-left">
                        Need help? Call{' '}
                        <a href={telHref(SUPPORT_PHONE)} className="font-semibold text-electric-700">
                          {SUPPORT_PHONE}
                        </a>
                      </p>
                    )}
                  </form>
                ) : (
                  <div id="home-panel-track" role="tabpanel" aria-labelledby="home-tab-track" className="p-4 sm:p-5 md:flex md:items-center md:justify-between md:gap-6">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-navy-900">Where is my car?</p>
                      <p className="mt-1 text-sm text-navy-500">
                        Follow every step — booking confirmed, car received, inspection, work in progress and ready for
                        delivery.
                      </p>
                      <ul className="mt-3 space-y-2 text-sm text-navy-700 md:flex md:flex-wrap md:gap-x-5 md:gap-y-1.5 md:space-y-0">
                        {['Status updates at every stage', 'Approve extra work before it is done', 'See what you have paid and what is left'].map((t) => (
                          <li key={t} className="flex items-center gap-2">
                            <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden /> {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Link
                      ref={(el) => {
                        ctaRef.current = el;
                      }}
                      href={customer ? '/customer/requests' : `/login?next=${encodeURIComponent('/customer/requests')}`}
                      className="mt-5 inline-flex min-h-[54px] w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-electric-600 px-6 text-base font-bold text-white shadow-md shadow-electric-600/30 transition hover:bg-electric-700 md:mt-0 md:w-auto"
                    >
                      {customer ? 'See my bookings' : 'Log in to track'} <ArrowRight className="h-5 w-5" aria-hidden />
                    </Link>
                  </div>
                )}
              </div>
            </div>

            <HighlightRow className="mt-4 xl:hidden" />
          </div>
        </section>

        {/* ============ Popular services ============ */}
        <section id="services" aria-labelledby="services-title" className="py-10 sm:py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between gap-4">
              <SectionHeading id="services-title" title="Our popular services" />
              <Link href="/services" className="inline-flex min-h-[44px] shrink-0 items-center gap-1 text-sm font-semibold text-electric-700">
                View all <span className="hidden sm:inline">services</span> <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6">
              {POPULAR.map((p) => {
                const category = SERVICE_CATEGORIES.find((c) => c.name === p.name) ?? SERVICE_CATEGORIES[0];
                const Icon = category.icon;
                return (
                  <li key={p.name}>
                    <Link
                      href={serviceHref(category, customer)}
                      className="group flex h-full flex-col rounded-2xl border border-surface-200 bg-white p-3.5 shadow-card transition hover:-translate-y-0.5 hover:border-electric-200 hover:shadow-elevated sm:p-4"
                    >
                      <span className={`flex h-11 w-11 items-center justify-center rounded-full ${p.tone}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="mt-3 text-[15px] font-bold text-navy-900">{p.title}</span>
                      <span className="mt-1 line-clamp-3 flex-1 text-xs leading-relaxed text-navy-500">{p.desc}</span>
                      <span className={`mt-3 inline-flex items-center gap-1 text-sm font-semibold ${p.cta}`}>
                        {category.periodic ? 'See prices' : 'Book now'}
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ============ Why BroCo band ============ */}
        <section id="why" aria-label="Why BroCo" className="px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-gradient-to-r from-navy-950 via-[#0B2A63] to-electric-800 p-5 text-white shadow-elevated sm:p-6">
            <ul className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-5 md:gap-0 md:divide-x md:divide-white/10">
              {WHY.map((w, i) => (
                <li key={w.title} className={`flex items-start gap-3 md:px-5 ${i === WHY.length - 1 ? 'col-span-2 md:col-span-1' : ''}`}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
                    <w.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-tight">{w.title}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-white/70">{w.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ============ Service packages ============ */}
        <section id="packages" aria-labelledby="packages-title" className="py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <SectionHeading
                id="packages-title"
                eyebrow="Scheduled maintenance"
                title="Car service packages"
                desc="Fixed prices for your exact car. Every package includes an OBD health report, a premium foam wash and free pick-up & drop."
              />
              <Link
                href={carServiceHref}
                className="inline-flex min-h-[44px] shrink-0 items-center gap-1 text-sm font-semibold text-electric-700"
              >
                Compare &amp; see prices <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>

            {!packages ? (
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-[420px] rounded-2xl" />
                ))}
              </div>
            ) : (
              <ul className="no-scrollbar -mx-4 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0">
                {packages.map((p) => {
                  const recommended = p.isRecommended || p.code === 'STANDARD';
                  return (
                    <li
                      key={p.id}
                      className={`relative flex w-[86%] shrink-0 snap-center flex-col overflow-hidden rounded-2xl border bg-white shadow-card xs:w-[80%] md:w-auto ${
                        recommended ? 'border-electric-400 ring-2 ring-electric-100' : 'border-surface-200'
                      }`}
                    >
                      {recommended && (
                        <span className="absolute right-3 top-3 rounded-full bg-electric-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                          Most booked
                        </span>
                      )}
                      <div className="border-b border-surface-100 bg-gradient-to-br from-surface-50 to-white p-4 sm:p-5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-electric-600">{p.code}</p>
                        <h3 className="mt-0.5 text-xl font-extrabold tracking-tight text-navy-900">{p.name}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-navy-500">{p.tagline}</p>
                        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-xl bg-white p-2 shadow-subtle ring-1 ring-surface-200">
                            <dt className="flex justify-center text-navy-400">
                              <Clock className="h-4 w-4" aria-hidden />
                              <span className="sr-only">Time</span>
                            </dt>
                            <dd className="mt-1 text-xs font-bold text-navy-900">{formatHours(p.durationHours)}</dd>
                          </div>
                          <div className="rounded-xl bg-white p-2 shadow-subtle ring-1 ring-surface-200">
                            <dt className="flex justify-center text-emerald-600">
                              <ShieldCheck className="h-4 w-4" aria-hidden />
                              <span className="sr-only">Warranty</span>
                            </dt>
                            <dd className="mt-1 text-xs font-bold text-navy-900">
                              {p.warrantyKm.toLocaleString('en-IN')} km
                              <span className="block font-medium text-navy-500">/ {p.warrantyDays} days</span>
                            </dd>
                          </div>
                          <div className="rounded-xl bg-white p-2 shadow-subtle ring-1 ring-surface-200">
                            <dt className="flex justify-center text-electric-600">
                              <Gauge className="h-4 w-4" aria-hidden />
                              <span className="sr-only">Recommended every</span>
                            </dt>
                            <dd className="mt-1 text-xs font-bold text-navy-900">
                              {p.intervalKm.toLocaleString('en-IN')} km
                              <span className="block font-medium text-navy-500">/ {p.intervalMonths} months</span>
                            </dd>
                          </div>
                        </dl>
                      </div>
                      <div className="flex flex-1 flex-col p-4 sm:p-5">
                        <p className="mb-2.5 text-sm font-semibold text-navy-900">What&apos;s included</p>
                        <PackageIncludes includes={p.includes} compact collapsedGroups={3} />
                        <div className="mt-auto pt-5">
                          <Link
                            href={carServiceHref}
                            className={`inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold transition ${
                              recommended
                                ? 'bg-electric-600 text-white shadow-md shadow-electric-600/25 hover:bg-electric-700'
                                : 'border border-electric-600 bg-white text-electric-700 hover:bg-electric-50'
                            }`}
                          >
                            {car ? `See price for ${car.modelName}` : 'Check price for my car'} <ArrowRight className="h-4 w-4" aria-hidden />
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-2 text-center text-xs text-navy-400 md:hidden">Swipe to see all three packages</p>
          </div>
        </section>

        {/* ============ How it works + garages ============ */}
        <section id="how-it-works" aria-labelledby="how-title" className="border-y border-surface-200 bg-surface-50 py-12 sm:py-16">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:px-8">
            <div className="rounded-3xl border border-surface-200 bg-white p-5 shadow-card sm:p-8 lg:col-span-8 xl:col-span-9">
              <SectionHeading id="how-title" title="How BroCo works" />
              <ol className="mt-6 grid gap-0 md:grid-cols-5 md:gap-4">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="relative flex gap-4 pb-6 last:pb-0 md:flex-col md:items-center md:pb-0 md:text-center">
                    {/* connector: vertical on phones, dashed arrow on desktop */}
                    {i < STEPS.length - 1 && (
                      <>
                        <span aria-hidden className="absolute left-[27px] top-14 h-[calc(100%-3.5rem)] w-0.5 bg-electric-100 md:hidden" />
                        <span aria-hidden className="absolute left-[calc(50%+40px)] top-8 hidden w-[calc(100%-56px)] border-t-2 border-dashed border-surface-300 md:block" />
                      </>
                    )}
                    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-electric-600 shadow-card ring-1 ring-surface-200 md:h-16 md:w-16">
                      <s.icon className="h-6 w-6 md:h-7 md:w-7" aria-hidden />
                      <span className="absolute -left-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-electric-600 text-xs font-bold text-white ring-2 ring-white">
                        {i + 1}
                      </span>
                    </span>
                    <span className="min-w-0 pt-1 md:pt-3">
                      <span className="block text-[15px] font-bold text-navy-900">{s.title}</span>
                      <span className="mt-0.5 block text-sm leading-snug text-navy-500">{s.desc}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <aside id="garages" aria-labelledby="garages-title" className="relative overflow-hidden rounded-3xl bg-navy-950 p-5 text-white shadow-elevated sm:p-7 lg:col-span-4 xl:col-span-3">
              <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-electric-600/30 blur-2xl" />
              <p className="relative inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-300">
                <Store className="h-4 w-4" aria-hidden /> For garages
              </p>
              <h2 id="garages-title" className="relative mt-2 text-xl font-extrabold tracking-tight">
                Grow with BroCo
              </h2>
              <ul className="relative mt-4 space-y-2.5 text-sm text-white/85">
                {['Bookings from car owners near you', 'Customer pays you directly at handover', 'Simple 10% commission per job', 'Free garage dashboard on your phone'].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
              <Link
                href="/register?role=garage"
                className="relative mt-6 inline-flex min-h-[50px] w-full items-center justify-center rounded-xl bg-electric-600 px-4 text-[15px] font-semibold text-white transition hover:bg-electric-500"
              >
                Register your garage
              </Link>
            </aside>
          </div>
        </section>

        {/* ============ Brands ============ */}
        <section id="brands" aria-labelledby="brands-title" className="py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <SectionHeading id="brands-title" title="We service all major brands" desc="Maruti Suzuki to Mercedes-Benz — petrol, diesel, CNG and electric." />
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="inline-flex min-h-[46px] shrink-0 items-center justify-center gap-2 rounded-xl border border-surface-300 bg-white px-4 text-sm font-semibold text-navy-800 shadow-subtle transition hover:border-electric-300"
              >
                <Search className="h-4 w-4" aria-hidden /> Find your car
              </button>
            </div>
            <ul className="mt-6 grid grid-cols-4 gap-2.5 sm:grid-cols-6 lg:grid-cols-12">
              {!manufacturers
                ? Array.from({ length: 12 }).map((_, i) => (
                    <li key={i}>
                      <Skeleton className="h-[78px] rounded-xl" />
                    </li>
                  ))
                : popularBrands.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => setPickerOpen(true)}
                        className="flex h-full min-h-[78px] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-surface-200 bg-white p-2 transition hover:border-electric-200 hover:shadow-card"
                      >
                        <BrandLogo name={m.name} logoUrl={m.logoUrl} size={34} />
                        <span className="line-clamp-1 text-[11px] font-medium text-navy-600">{m.name}</span>
                      </button>
                    </li>
                  ))}
            </ul>
          </div>
        </section>

        {/* ============ FAQ + support ============ */}
        <section id="faq" aria-labelledby="faq-title" className="border-t border-surface-200 bg-surface-50 py-12 sm:py-16">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
            <div className="lg:col-span-7">
              <SectionHeading id="faq-title" title="Frequently asked questions" />
              <div className="mt-5 divide-y divide-surface-200 overflow-hidden rounded-2xl border border-surface-200 bg-white">
                {FAQS.map((f) => (
                  <details key={f.q} className="group">
                    <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[15px] font-semibold text-navy-900 sm:px-5 [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <ChevronDown className="h-5 w-5 shrink-0 text-navy-400 transition group-open:rotate-180" aria-hidden />
                    </summary>
                    <p className="px-4 pb-4 text-sm leading-relaxed text-navy-600 sm:px-5">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>

            <aside id="support" aria-labelledby="support-title" className="lg:col-span-5">
              <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-card sm:p-6">
                <h2 id="support-title" className="text-lg font-bold text-navy-900">
                  Need help?
                </h2>
                <p className="mt-1 text-sm text-navy-500">
                  {hasSupportContact
                    ? 'Talk to the BroCo team about a booking, a price or a garage.'
                    : 'Questions about a booking? Log in to see its status, the garage and everything you have paid.'}
                </p>
                <div className="mt-4 grid gap-2">
                  {SUPPORT_PHONE && (
                    <a href={telHref(SUPPORT_PHONE)} className="flex min-h-[50px] items-center gap-3 rounded-xl bg-surface-50 px-4 text-sm font-semibold text-navy-900 hover:bg-surface-100">
                      <Phone className="h-5 w-5 text-electric-600" aria-hidden /> {SUPPORT_PHONE}
                    </a>
                  )}
                  {SUPPORT_WHATSAPP && (
                    <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="flex min-h-[50px] items-center gap-3 rounded-xl bg-surface-50 px-4 text-sm font-semibold text-navy-900 hover:bg-surface-100">
                      <MessageCircle className="h-5 w-5 text-emerald-600" aria-hidden /> WhatsApp us
                    </a>
                  )}
                  {SUPPORT_EMAIL && (
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="flex min-h-[50px] items-center gap-3 rounded-xl bg-surface-50 px-4 text-sm font-semibold text-navy-900 hover:bg-surface-100">
                      <Mail className="h-5 w-5 text-electric-600" aria-hidden /> {SUPPORT_EMAIL}
                    </a>
                  )}
                  {!hasSupportContact && (
                    <Link href="/track" className="flex min-h-[50px] items-center justify-center gap-2 rounded-xl bg-electric-600 px-4 text-sm font-semibold text-white hover:bg-electric-700">
                      <CarFront className="h-5 w-5" aria-hidden /> Track my booking
                    </Link>
                  )}
                </div>
              </div>
              {signedIn && user && (
                <Link
                  href={homePathForRoles(user.roles ?? [])}
                  className="mt-3 flex min-h-[48px] items-center justify-center rounded-xl border border-surface-300 bg-white text-sm font-semibold text-navy-800"
                >
                  Go to my dashboard
                </Link>
              )}
            </aside>
          </div>
        </section>
      </main>

      <PublicFooter />

      {/* Phones: sticky call to action once the booking card is off screen */}
      <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-surface-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-bar backdrop-blur transition-transform duration-200 lg:hidden ${
          ctaVisible ? 'translate-y-full' : 'translate-y-0'
        }`}
        aria-hidden={ctaVisible}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-navy-900">{car ? `${car.manufacturerName} ${car.modelName}` : 'Pay just 10% to book'}</p>
            <p className="truncate text-xs text-navy-500">{car ? 'Pay just 10% to book' : 'Free pick-up & drop'}</p>
          </div>
          <button
            type="button"
            tabIndex={ctaVisible ? -1 : 0}
            onClick={() => (car ? router.push(carServiceHref) : scrollToCard(false))}
            className="inline-flex min-h-[48px] shrink-0 items-center gap-1.5 rounded-xl bg-electric-600 px-5 text-sm font-bold text-white shadow-md shadow-electric-600/30"
          >
            {car ? 'See prices' : 'Book a service'} <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <CarPicker isOpen={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={pickFromBrands} />
    </div>
  );
}
