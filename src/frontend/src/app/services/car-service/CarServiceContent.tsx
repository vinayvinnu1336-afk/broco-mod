'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PackageIncludes } from '@/components/catalogue/PackageIncludes';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  Clock,
  CreditCard,
  Gauge,
  Info,
  MapPin,
  Minus,
  Star,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { CarPicker, CarSelectField, CarSelection } from '@/components/catalogue/CarPicker';
import {
  PackageOffer,
  PackageOffers,
  ServicePackage,
  catalogueApi,
  loadBookingIntent,
  saveBookingIntent,
  formatHours,
  includeText,
} from '@/lib/catalogue';
import { formatINRWhole } from '@/lib/format';
import {
  CarChoice,
  NEW_REQUEST_PATH,
  carChoiceFrom,
  formatKm,
  isCustomer,
  quoteRequestPath,
  viaAuth,
} from '../../_public/services';

const CITY = 'Hyderabad';
const QUOTE_CATEGORY = 'Periodic Service';

function shortName(pkg: ServicePackage): string {
  return pkg.name.replace(/\s*service$/i, '') || pkg.name;
}

function byOrder(a: ServicePackage, b: ServicePackage) {
  return a.displayOrder - b.displayOrder;
}

export function CarServiceSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-[52px] w-full" />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[420px] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function CarServiceContent() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { user, isAuthenticated } = useAuth();
  const signedIn = isAuthenticated && !!user;
  const customer = signedIn && isCustomer(user?.roles);

  // Read the query once; later car changes update the URL ourselves.
  const initialQuery = useRef({ model: params.get('model'), fuel: params.get('fuel') });

  const [car, setCar] = useState<CarChoice | null>(null);
  const [carLoading, setCarLoading] = useState(true);
  const [packages, setPackages] = useState<ServicePackage[] | null>(null);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [offers, setOffers] = useState<PackageOffers | null>(null);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState(false);
  const [selected, setSelected] = useState<string>('STANDARD');
  const [pickerOpen, setPickerOpen] = useState(false);
  const cardsRef = useRef<HTMLDivElement>(null);

  // 1. Work out the car: ?model=&fuel= first, then what the visitor picked earlier.
  useEffect(() => {
    let cancelled = false;
    const intent = loadBookingIntent();
    const modelId = initialQuery.current.model || intent?.modelId;
    const fuel = initialQuery.current.fuel || intent?.fuelType;
    if (!modelId || !fuel) {
      setCarLoading(false);
      return;
    }
    if (intent?.modelId === modelId && intent.manufacturerId && intent.manufacturerName && intent.modelName) {
      setCar({
        manufacturerId: intent.manufacturerId,
        manufacturerName: intent.manufacturerName,
        modelId,
        modelName: intent.modelName,
        fuelType: fuel,
      });
      setCarLoading(false);
    }
    Promise.all([catalogueApi.model(modelId), catalogueApi.manufacturers()]).then(([modelRes, brandsRes]) => {
      if (cancelled) return;
      const model = modelRes.success ? modelRes.data : undefined;
      if (model) {
        const brand = brandsRes.data?.find((b) => b.id === model.manufacturerId);
        const fuels = model.fuels ?? [];
        const fuelType = fuels.length ? fuels.find((f) => f.toLowerCase() === fuel.toLowerCase()) ?? fuels[0] : fuel;
        setCar({
          manufacturerId: model.manufacturerId,
          manufacturerName: brand?.name ?? model.manufacturerName,
          logoUrl: brand?.logoUrl ?? null,
          modelId: model.id,
          modelName: model.name,
          fuelType,
        });
      } else {
        setCar((current) => (current?.modelId === modelId ? current : null));
      }
      setCarLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Package details (shown even before a car is picked).
  const loadPackages = useCallback(() => {
    setPackagesError(null);
    catalogueApi.packages().then((res) => {
      if (res.success && res.data) setPackages(res.data.filter((p) => p.isActive !== false).sort(byOrder));
      else setPackagesError(res.message || 'Could not load service packages.');
    });
  }, []);
  useEffect(loadPackages, [loadPackages]);

  // 3. Prices for the chosen car.
  const modelId = car?.modelId;
  const fuelType = car?.fuelType;
  const loadOffers = useCallback(() => {
    if (!modelId || !fuelType) {
      setOffers(null);
      return () => undefined;
    }
    let cancelled = false;
    setOffersLoading(true);
    setOffersError(false);
    catalogueApi.offers(modelId, fuelType).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setOffers(res.data);
      else {
        setOffers(null);
        setOffersError(true);
      }
      setOffersLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [modelId, fuelType]);
  useEffect(() => loadOffers(), [loadOffers]);

  const list: ServicePackage[] = useMemo(() => {
    if (offers?.offers?.length) return offers.offers.map((o) => o.package).sort(byOrder);
    return packages ?? [];
  }, [offers, packages]);

  const offerFor = useCallback(
    (code: string): PackageOffer | undefined => offers?.offers.find((o) => o.package.code === code),
    [offers]
  );

  // Default the selection to the recommended package once we know it.
  useEffect(() => {
    if (list.length && !list.some((p) => p.code === selected)) {
      setSelected((list.find((p) => p.isRecommended) ?? list[0]).code);
    }
  }, [list, selected]);

  const advancePct = offers?.advancePercentage ?? 10;
  const anyRecommended = list.some((p) => p.isRecommended);

  const rememberCar = (choice: CarChoice, extra: { packageCode?: string; serviceCategory?: string } = {}) => {
    saveBookingIntent({
      city: CITY,
      manufacturerId: choice.manufacturerId,
      manufacturerName: choice.manufacturerName,
      modelId: choice.modelId,
      modelName: choice.modelName,
      fuelType: choice.fuelType,
      ...extra,
    });
  };

  const chooseCar = (sel: CarSelection) => {
    const choice = carChoiceFrom(sel.manufacturer, sel.model, sel.fuelType);
    setCar(choice);
    rememberCar(choice);
    try {
      const url = `${window.location.pathname}?model=${encodeURIComponent(choice.modelId)}&fuel=${encodeURIComponent(choice.fuelType)}`;
      window.history.replaceState(null, '', url);
    } catch {
      /* ignore */
    }
  };

  const pickCarFor = (code: string) => {
    setSelected(code);
    setPickerOpen(true);
  };

  const onPickerSelect = (sel: CarSelection) => {
    chooseCar(sel);
    setTimeout(() => cardsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const bookingTarget = (code: string) => `${NEW_REQUEST_PATH}?package=${encodeURIComponent(code)}`;

  const book = (code: string) => {
    if (!car) {
      pickCarFor(code);
      return;
    }
    if (signedIn && !customer) {
      toast.info('Booking needs a car owner account', 'You are signed in with a garage or staff account.');
      return;
    }
    rememberCar(car, { packageCode: code });
    const target = bookingTarget(code);
    router.push(customer ? target : `/register?next=${encodeURIComponent(target)}`);
  };

  const quoteHref = viaAuth(quoteRequestPath(QUOTE_CATEGORY), customer);
  const rememberQuote = () => {
    if (car) rememberCar(car, { serviceCategory: QUOTE_CATEGORY });
  };

  const selectedPkg = list.find((p) => p.code === selected);
  const selectedOffer = selectedPkg ? offerFor(selectedPkg.code) : undefined;

  // ---- Render ----

  const carField = carLoading ? (
    <Skeleton className="h-[52px] w-full" />
  ) : (
    <CarSelectField value={car} onChange={chooseCar} placeholder="Select your car" />
  );

  return (
    <>
      {/* Car bar */}
      <section className="border-b border-surface-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="text-xs text-navy-400">
            <Link href="/" className="hover:text-navy-700">Home</Link>
            <span className="mx-1.5">/</span>
            <Link href="/services" className="hover:text-navy-700">Services</Link>
            <span className="mx-1.5">/</span>
            <span className="text-navy-600">Car service</span>
          </nav>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">Scheduled packages</h1>
              <p className="mt-0.5 text-sm text-navy-500">Fixed-price periodic service for your car</p>
            </div>
            <span className="inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-full border border-electric-200 bg-electric-50 px-3 text-xs font-semibold text-electric-700">
              <MapPin className="h-3.5 w-3.5" aria-hidden /> {CITY}
            </span>
          </div>
          <div className="mt-4 md:max-w-md">{carField}</div>
          <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-navy-500 sm:text-sm">
            <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-electric-600" aria-hidden />
            Pay {advancePct}% online to book. Pay the rest directly at the garage after the service.
          </p>
        </div>
      </section>

      {/* Package cards */}
      <section className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8" aria-label="Service packages">
        <div ref={cardsRef} className="scroll-mt-20" />
        {offersError && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-semantic-warningBorder bg-semantic-warningBg p-3 text-sm text-navy-700">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-semantic-warning" aria-hidden />
            <p className="flex-1">We could not load prices for your car just now.</p>
            <button type="button" onClick={() => loadOffers()} className="min-h-[32px] font-semibold text-electric-700">
              Retry
            </button>
          </div>
        )}

        {list.length === 0 ? (
          packagesError ? (
            <ErrorState title="Packages could not be loaded" error={packagesError} onRetry={loadPackages} />
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[420px] rounded-2xl" />
              ))}
            </div>
          )
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {list.map((pkg) => {
              const offer = offerFor(pkg.code);
              const priced = !!car && !offersLoading && offer?.price != null;
              const onRequest = !!car && !offersLoading && !priced;
              const isSelected = pkg.code === selected;
              const recommended = pkg.isRecommended || (!anyRecommended && pkg.code === 'STANDARD');

              return (
                <article
                  key={pkg.id}
                  onClick={() => setSelected(pkg.code)}
                  aria-labelledby={`pkg-${pkg.code}`}
                  className={`relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-card transition ${
                    isSelected ? 'border-electric-500 ring-2 ring-electric-100' : 'border-surface-200'
                  } ${recommended ? 'md:-mt-2' : ''}`}
                >
                  {recommended && (
                    <div className="flex items-center justify-center gap-1.5 bg-electric-600 py-1.5 text-xs font-bold text-white">
                      <Star className="h-3.5 w-3.5 fill-current" aria-hidden /> Recommended
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-electric-600">{pkg.code}</p>
                    <h2 id={`pkg-${pkg.code}`} className="text-lg font-extrabold tracking-tight text-navy-900">
                      {pkg.name}
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-navy-500">{pkg.tagline}</p>

                    {/* Price */}
                    <div className="mt-4 rounded-xl bg-surface-50 p-3">
                      {!car ? (
                        <p className="text-sm font-semibold text-navy-700">Select your car to see the price</p>
                      ) : offersLoading || carLoading ? (
                        <div className="space-y-2">
                          <Skeleton className="h-8 w-28" />
                          <Skeleton className="h-4 w-48" />
                        </div>
                      ) : priced && offer ? (
                        <>
                          <p className="text-[28px] font-extrabold leading-none tracking-tight text-navy-900 tabular-nums">
                            {formatINRWhole(offer.price as number)}
                          </p>
                          <p className="mt-1.5 text-sm text-navy-600">
                            Pay <span className="font-semibold text-electric-700 tabular-nums">{formatINRWhole(offer.advanceAmount ?? 0)}</span> now ·{' '}
                            <span className="font-semibold tabular-nums">{formatINRWhole(offer.payAtGarageAmount ?? 0)}</span> at the garage
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-xl font-extrabold text-navy-900">Price on request</p>
                          <p className="mt-1 text-sm text-navy-500">Garages will quote for your {car.modelName}.</p>
                        </>
                      )}
                    </div>

                    {/* Chips */}
                    <ul className="mt-3 flex flex-wrap gap-1.5 text-xs font-medium text-navy-700">
                      <li className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2.5 py-1">
                        <Gauge className="h-3.5 w-3.5 text-navy-400" aria-hidden />
                        Every {formatKm(pkg.intervalKm)} / {pkg.intervalMonths} months
                      </li>
                      <li className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2.5 py-1">
                        <Clock className="h-3.5 w-3.5 text-navy-400" aria-hidden />
                        Takes {formatHours(pkg.durationHours)}
                      </li>
                      <li className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                        <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                        {formatKm(pkg.warrantyKm)} / {pkg.warrantyDays}-day warranty
                      </li>
                    </ul>

                    {/* Includes */}
                    <h3 className="mt-4 text-sm font-semibold text-navy-900">What&apos;s included</h3>
                    <PackageIncludes includes={pkg.includes} className="mt-2.5" />

                    {/* CTA */}
                    <div className="mt-auto pt-5">
                      {onRequest ? (
                        <Link
                          href={quoteHref}
                          onClick={rememberQuote}
                          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-electric-600 bg-white px-4 text-sm font-semibold text-electric-700 transition hover:bg-electric-50"
                        >
                          Get a quote <ArrowRight className="h-4 w-4" aria-hidden />
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(pkg.code);
                            book(pkg.code);
                          }}
                          disabled={!!car && (offersLoading || carLoading)}
                          className={`inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-60 ${
                            recommended
                              ? 'bg-electric-600 text-white shadow-sm shadow-electric-600/20 hover:bg-electric-700'
                              : 'bg-navy-900 text-white hover:bg-navy-800'
                          }`}
                        >
                          {car ? 'Book now' : 'Select your car'} <ArrowRight className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!signedIn && list.length > 0 && (
          <p className="mt-4 text-center text-sm text-navy-500">
            Already have an account?{' '}
            <Link
              href={`/login?next=${encodeURIComponent(bookingTarget(selected))}`}
              onClick={() => car && rememberCar(car, { packageCode: selected })}
              className="font-semibold text-electric-700 hover:underline"
            >
              Log in
            </Link>
          </p>
        )}
      </section>

      {list.length > 0 && <Comparison packages={list} offerFor={car && !offersLoading ? offerFor : undefined} />}

      <FaqSection advancePct={advancePct} />

      {/* Phone booking bar for the selected package */}
      {selectedPkg && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-surface-200 bg-white/95 shadow-bar backdrop-blur-md md:hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-navy-500">{selectedPkg.name}</p>
              {!car ? (
                <p className="truncate text-sm font-semibold text-navy-900">Select your car to see the price</p>
              ) : offersLoading || carLoading ? (
                <Skeleton className="mt-1 h-5 w-24" />
              ) : selectedOffer?.price != null ? (
                <p className="truncate text-sm text-navy-600">
                  <span className="text-lg font-extrabold text-navy-900 tabular-nums">{formatINRWhole(selectedOffer.price)}</span>
                  <span className="ml-1.5 text-xs">Pay {formatINRWhole(selectedOffer.advanceAmount ?? 0)} now</span>
                </p>
              ) : (
                <p className="truncate text-sm font-semibold text-navy-900">Price on request</p>
              )}
            </div>
            {car && !offersLoading && !carLoading && selectedOffer?.price == null ? (
              <Link
                href={quoteHref}
                onClick={rememberQuote}
                className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-xl bg-electric-600 px-5 text-sm font-semibold text-white"
              >
                Get a quote
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => book(selectedPkg.code)}
                disabled={!!car && (offersLoading || carLoading)}
                className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-xl bg-electric-600 px-5 text-sm font-semibold text-white shadow-sm shadow-electric-600/20 disabled:opacity-60"
              >
                {car ? 'Book now' : 'Select car'}
              </button>
            )}
          </div>
        </div>
      )}

      <CarPicker isOpen={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={onPickerSelect} />
    </>
  );
}

function Comparison({
  packages,
  offerFor,
}: {
  packages: ServicePackage[];
  offerFor?: (code: string) => PackageOffer | undefined;
}) {
  const items: string[] = [];
  for (const p of packages) for (const item of p.includes) if (!items.includes(item)) items.push(item);

  const rows: { label: string; values: React.ReactNode[] }[] = [
    ...(offerFor
      ? [
          {
            label: 'Price for your car',
            values: packages.map((p) => {
              const price = offerFor(p.code)?.price;
              return price != null ? <span className="font-semibold tabular-nums">{formatINRWhole(price)}</span> : 'On request';
            }),
          },
        ]
      : []),
    { label: 'Recommended every', values: packages.map((p) => `${formatKm(p.intervalKm)} / ${p.intervalMonths} mo`) },
    { label: 'Time taken', values: packages.map((p) => formatHours(p.durationHours)) },
    { label: 'Warranty', values: packages.map((p) => `${formatKm(p.warrantyKm)} / ${p.warrantyDays} days`) },
  ];

  return (
    <section className="border-t border-surface-200 bg-white py-8 sm:py-12" aria-labelledby="compare-heading">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h2 id="compare-heading" className="text-xl font-extrabold tracking-tight text-navy-900 sm:text-2xl">
          Compare packages
        </h2>
        <p className="mt-1 text-sm text-navy-500">See what each package covers, side by side.</p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-surface-200">
          <table className="w-full table-fixed text-left text-[13px] sm:text-sm">
            <caption className="sr-only">What each service package includes</caption>
            <thead className="bg-surface-50 text-navy-900">
              <tr>
                <th scope="col" className="px-3 py-2.5 font-semibold sm:px-4">
                  <span className="sr-only">Item</span>
                </th>
                {packages.map((p) => (
                  <th key={p.code} scope="col" className="w-[62px] px-1 py-2.5 text-center text-xs font-semibold sm:w-32 sm:text-sm">
                    {shortName(p)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 text-navy-600">
              {rows.map((row) => (
                <tr key={row.label} className="bg-white">
                  <th scope="row" className="px-3 py-2.5 font-medium text-navy-800 sm:px-4">
                    {row.label}
                  </th>
                  {row.values.map((v, i) => (
                    <td key={i} className="px-1 py-2.5 text-center text-[11.5px] leading-tight sm:text-sm">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
              {items.map((item) => (
                <tr key={item}>
                  <th scope="row" className="px-3 py-2.5 font-normal sm:px-4">
                    {includeText(item)}
                  </th>
                  {packages.map((p) => (
                    <td key={p.code} className="px-1 py-2.5 text-center">
                      {p.includes.includes(item) ? (
                        <>
                          <Check className="mx-auto h-4 w-4 text-emerald-600" strokeWidth={2.5} aria-hidden />
                          <span className="sr-only">Included</span>
                        </>
                      ) : (
                        <>
                          <Minus className="mx-auto h-4 w-4 text-surface-300" aria-hidden />
                          <span className="sr-only">Not included</span>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function FaqSection({ advancePct }: { advancePct: number }) {
  const faqs = [
    {
      q: 'What is included in each package?',
      a: 'Each card lists exactly what the garage will do, and the comparison table shows the differences. Parts and fluids for the listed items are included in the price. Anything outside the list is quoted separately and only done if you approve it.',
    },
    {
      q: 'How is the payment split?',
      a: `You pay ${advancePct}% of the package price online to BroCo to confirm your booking. The remaining ${100 - advancePct}% is paid directly to the garage after the service is done.`,
    },
    {
      q: 'What does the warranty cover?',
      a: 'The work done in your package is covered for the kilometres or days shown on the card, whichever comes first. If there is a problem with the work done within that period, tell us and we will get the garage to put it right.',
    },
    {
      q: 'Can I cancel my booking?',
      a: `Yes. The ${advancePct}% advance is refundable if you cancel before the garage starts work.`,
    },
    {
      q: 'Why does my car show “Price on request”?',
      a: 'We do not have a fixed price for that car and package yet. Ask for a quote and verified garages will price it for your car. You still pay only 10% online and the rest at the garage.',
    },
  ];
  return (
    <section className="border-t border-surface-200 bg-surface-50 py-8 sm:py-12" aria-labelledby="faq-heading">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 id="faq-heading" className="text-xl font-extrabold tracking-tight text-navy-900 sm:text-2xl">
          Frequently asked questions
        </h2>
        <div className="mt-4 divide-y divide-surface-200 overflow-hidden rounded-2xl border border-surface-200 bg-white">
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
  );
}
