'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BatteryCharging,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Cog,
  Disc,
  FileText,
  Lightbulb,
  Plus,
  ShieldCheck,
  Snowflake,
  Sparkles,
  SprayCan,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import {
  CarModel,
  Manufacturer,
  PackageOffer,
  PackageOffers,
  ServicePackage,
  catalogueApi,
  clearBookingIntent,
  loadBookingIntent,
} from '@/lib/catalogue';
import { ServiceRequestDetailDto } from '@/types/serviceRequest';
import { formatDate, formatINRWhole } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { ActionBar, ActionBarSpacer } from '@/components/ui/ActionBar';
import { BrandLogo } from '@/components/catalogue/BrandLogo';
import { CarSelectField, CarSelection } from '@/components/catalogue/CarPicker';
import {
  LocationDraft,
  LocationPicker,
  emptyLocationDraft,
  formatLocationDraft,
  hasLocationErrors,
  toLocationValue,
  validateLocation,
} from '@/components/location/LocationPicker';
import { useLiveServiceArea } from '@/components/location/serviceArea';
import { PaymentModelNote, PriceSplit } from '@/components/booking/PriceSplit';
import { ADVANCE_PERCENT, payBookingAdvance } from '@/components/booking/advancePayment';

// ---------------------------------------------------------------------------------------------
// Data

const OTHER_SERVICES: { name: string; icon: LucideIcon }[] = [
  { name: 'AC Service & Repair', icon: Snowflake },
  { name: 'Batteries', icon: BatteryCharging },
  { name: 'Tyres & Wheel Care', icon: Disc },
  { name: 'Denting & Painting', icon: SprayCan },
  { name: 'Detailing & Car Spa', icon: Sparkles },
  { name: 'Clutch & Body Parts', icon: Cog },
  { name: 'Suspension & Fitments', icon: Car },
  { name: 'Windshields & Lights', icon: Lightbulb },
  { name: 'Insurance Claims', icon: ShieldCheck },
  { name: 'General Repair', icon: Wrench },
];

const STEPS = ['Service', 'Car', 'Location', 'Review'] as const;

const TIME_SLOTS = [
  { key: 'morning', label: 'Morning', hint: '9 am – 12 pm', hour: 9 },
  { key: 'afternoon', label: 'Afternoon', hint: '12 – 4 pm', hour: 12 },
  { key: 'evening', label: 'Evening', hint: '4 – 7 pm', hour: 16 },
] as const;

/** GET /customer/vehicles */
interface SavedVehicle {
  id: string;
  manufacturerId: string;
  make: string;
  modelId: string;
  model: string;
  variantName?: string | null;
  year: number;
  fuelType: string;
  licensePlate: string;
  mileage?: number;
  isPrimary: boolean;
}

/** The car being added inline (prefilled from the public-site booking intent). */
interface CarDraft {
  manufacturerId: string;
  manufacturerName: string;
  logoUrl?: string | null;
  modelId: string;
  modelName: string;
  fuelType: string;
  yearFrom?: number;
  yearTo?: number | null;
}

/** New fields on the request detail returned by POST /customer/requests. */
type CreatedRequest = ServiceRequestDetailDto & {
  servicePackageCode?: string | null;
  servicePackageName?: string | null;
  packagePrice?: number | null;
  advanceAmountDue?: number | null;
  advancePaidAmount?: number | null;
};

type Mode = 'package' | 'other';

const sameFuel = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

function findCategory(name: string | null | undefined): string | null {
  if (!name) return null;
  const match = OTHER_SERVICES.find((s) => s.name.toLowerCase() === name.trim().toLowerCase());
  return match ? match.name : null;
}

function nextDays(count: number): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const PLATE_RE = /^[A-Z0-9][A-Z0-9 -]{3,14}$/;

// ---------------------------------------------------------------------------------------------

export default function NewServiceBookingPage() {
  return (
    <Suspense fallback={<BookingSkeleton />}>
      <BookingFlow />
    </Suspense>
  );
}

function BookingSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4" aria-busy="true" aria-label="Loading booking">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-12" />
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
    </div>
  );
}

function BookingFlow() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const serviceArea = useLiveServiceArea();

  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // ---- Service
  const [mode, setMode] = useState<Mode>('package');
  const [packageCode, setPackageCode] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [problem, setProblem] = useState('');
  const [packageNotes, setPackageNotes] = useState('');
  const [packages, setPackages] = useState<ServicePackage[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // ---- Car
  const [vehicles, setVehicles] = useState<SavedVehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [addingCar, setAddingCar] = useState(false);
  const [carDraft, setCarDraft] = useState<CarDraft | null>(null);
  const [plate, setPlate] = useState('');
  const [year, setYear] = useState('');
  const [km, setKm] = useState('');
  const [savingCar, setSavingCar] = useState(false);
  const [logos, setLogos] = useState<Record<string, string>>({});

  // ---- Prices for the chosen car
  const offersCache = useRef(new Map<string, PackageOffers>());
  const [offers, setOffers] = useState<PackageOffers | null>(null);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState<string | null>(null);

  // ---- Location
  const [location, setLocation] = useState<LocationDraft>(() => emptyLocationDraft(serviceArea));
  const handleLocationChange = useCallback((next: LocationDraft) => {
    setLocation(next);
    setStepError(null);
  }, []);

  // ---- When
  const [preferredDay, setPreferredDay] = useState('');
  const [preferredSlot, setPreferredSlot] = useState('');

  // ---- Submit
  const [busy, setBusy] = useState<null | 'creating' | 'paying' | 'redirecting'>(null);
  const [created, setCreated] = useState<CreatedRequest | null>(null);
  const [done, setDone] = useState<null | { kind: 'package'; paid: number } | { kind: 'quote' }>(null);
  const idempotencyKey = useRef(`bk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  const intentRef = useRef<ReturnType<typeof loadBookingIntent>>(null);

  // ------------------------------------------------------------------ initial selection
  useEffect(() => {
    const intent = loadBookingIntent();
    intentRef.current = intent;
    const qpPackage = searchParams.get('package')?.toUpperCase() || '';
    const qpCategory = findCategory(searchParams.get('category'));
    if (qpPackage) {
      setMode('package');
      setPackageCode(qpPackage);
    } else if (qpCategory) {
      setMode('other');
      setCategory(qpCategory);
    } else if (intent?.packageCode) {
      setMode('package');
      setPackageCode(intent.packageCode.toUpperCase());
    } else if (findCategory(intent?.serviceCategory)) {
      setMode('other');
      setCategory(findCategory(intent?.serviceCategory)!);
    }

    catalogueApi.packages().then((res) => {
      if (res.success && res.data) setPackages([...res.data].sort((a, b) => a.displayOrder - b.displayOrder));
      else setPackages([]);
    });
    catalogueApi.manufacturers().then((res) => {
      if (res.success && res.data) {
        setLogos(Object.fromEntries(res.data.map((m: Manufacturer) => [m.id, m.logoUrl])));
      }
    });
    // Runs once on mount; later query-string changes do not reset what the user picked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startAddingFromIntent = useCallback(async () => {
    const intent = intentRef.current;
    if (!intent?.modelId || !intent.fuelType) {
      setAddingCar(true);
      return;
    }
    const draft: CarDraft = {
      manufacturerId: intent.manufacturerId ?? '',
      manufacturerName: intent.manufacturerName ?? '',
      modelId: intent.modelId,
      modelName: intent.modelName ?? '',
      fuelType: intent.fuelType,
    };
    setCarDraft(draft);
    setAddingCar(true);
    const res = await catalogueApi.model(intent.modelId);
    if (res.success && res.data) {
      const m = res.data;
      setCarDraft((d) =>
        d && d.modelId === m.id
          ? { ...d, manufacturerId: m.manufacturerId, manufacturerName: d.manufacturerName || m.manufacturerName, modelName: d.modelName || m.name, yearFrom: m.yearFrom, yearTo: m.yearTo }
          : d
      );
    }
  }, []);

  const loadVehicles = useCallback(async () => {
    setLoadingVehicles(true);
    setVehiclesError(null);
    const res = await apiFetch<SavedVehicle[]>('/customer/vehicles');
    setLoadingVehicles(false);
    if (!res.success || !res.data) {
      setVehiclesError(res.message || 'Could not load your cars.');
      return;
    }
    const list = res.data;
    setVehicles(list);
    const intent = intentRef.current;
    if (intent?.modelId) {
      const match = list.find((v) => v.modelId === intent.modelId && sameFuel(v.fuelType, intent.fuelType));
      if (match) {
        setSelectedVehicleId(match.id);
        return;
      }
      await startAddingFromIntent();
      return;
    }
    if (list.length === 0) {
      setAddingCar(true);
      return;
    }
    setSelectedVehicleId((list.find((v) => v.isPrimary) ?? list[0]).id);
  }, [startAddingFromIntent]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? null;

  // The car prices are shown for: the selected saved car, else the car being added.
  const pricingCar = useMemo(() => {
    if (selectedVehicle && !addingCar) {
      return {
        modelId: selectedVehicle.modelId,
        fuelType: selectedVehicle.fuelType,
        manufacturerName: selectedVehicle.make,
        modelName: selectedVehicle.model,
        logoUrl: logos[selectedVehicle.manufacturerId] ?? null,
      };
    }
    if (carDraft?.modelId && carDraft.fuelType) {
      return {
        modelId: carDraft.modelId,
        fuelType: carDraft.fuelType,
        manufacturerName: carDraft.manufacturerName,
        modelName: carDraft.modelName,
        logoUrl: carDraft.logoUrl ?? logos[carDraft.manufacturerId] ?? null,
      };
    }
    return null;
  }, [selectedVehicle, addingCar, carDraft, logos]);

  const pricingKey = pricingCar ? `${pricingCar.modelId}|${pricingCar.fuelType}` : '';

  useEffect(() => {
    if (!pricingKey) {
      setOffers(null);
      return;
    }
    const [modelId, fuelType] = pricingKey.split('|');
    const key = `${modelId}|${fuelType.toLowerCase()}`;
    const cached = offersCache.current.get(key);
    if (cached) {
      setOffers(cached);
      setOffersError(null);
      return;
    }
    let cancelled = false;
    setOffersLoading(true);
    setOffersError(null);
    catalogueApi.offers(modelId, fuelType).then((res) => {
      if (cancelled) return;
      setOffersLoading(false);
      if (res.success && res.data) {
        offersCache.current.set(key, res.data);
        setOffers(res.data);
      } else {
        setOffers(null);
        setOffersError(res.message || 'Could not load prices for this car.');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pricingKey]);

  const offerFor = (code: string): PackageOffer | null =>
    offers?.offers.find((o) => o.package.code.toUpperCase() === code.toUpperCase()) ?? null;
  const selectedOffer = packageCode ? offerFor(packageCode) : null;
  const selectedPackage =
    selectedOffer?.package ?? packages?.find((p) => p.code.toUpperCase() === packageCode.toUpperCase()) ?? null;
  const advancePercent = offers?.advancePercentage ?? ADVANCE_PERCENT;

  // ------------------------------------------------------------------ car selection helpers
  const handleCarPicked = (sel: CarSelection) => {
    const match = vehicles.find((v) => v.modelId === sel.model.id && sameFuel(v.fuelType, sel.fuelType));
    if (match) {
      setSelectedVehicleId(match.id);
      setAddingCar(false);
      return;
    }
    const model: CarModel = sel.model;
    setCarDraft({
      manufacturerId: sel.manufacturer.id,
      manufacturerName: sel.manufacturer.name,
      logoUrl: sel.manufacturer.logoUrl,
      modelId: model.id,
      modelName: model.name,
      fuelType: sel.fuelType,
      yearFrom: model.yearFrom,
      yearTo: model.yearTo,
    });
    setYear((y) => {
      const n = Number(y);
      const max = model.yearTo ?? new Date().getFullYear();
      return n && n >= model.yearFrom && n <= max ? y : '';
    });
    setSelectedVehicleId('');
    setAddingCar(true);
  };

  const yearOptions = useMemo(() => {
    if (!carDraft?.yearFrom) return [];
    const max = Math.min(carDraft.yearTo ?? new Date().getFullYear(), new Date().getFullYear());
    const years: number[] = [];
    for (let y = max; y >= carDraft.yearFrom; y--) years.push(y);
    return years;
  }, [carDraft]);

  const carErrors = useMemo(() => {
    const e: { car?: string; plate?: string; year?: string; km?: string } = {};
    if (!carDraft?.modelId || !carDraft.fuelType) e.car = 'Choose your car brand, model and fuel.';
    const p = plate.trim().toUpperCase();
    if (!p) e.plate = 'Enter the registration number.';
    else if (!PLATE_RE.test(p)) e.plate = 'Use letters and numbers only, e.g. TS 09 AB 1234.';
    if (!year) e.year = 'Select the year.';
    if (km && (!/^\d+$/.test(km) || Number(km) > 2000000)) e.km = 'Enter kilometres as a number.';
    return e;
  }, [carDraft, plate, year, km]);

  const saveCar = async (): Promise<SavedVehicle | null> => {
    if (!carDraft) return null;
    setSavingCar(true);
    const res = await apiFetch<SavedVehicle>('/customer/vehicles', {
      method: 'POST',
      body: JSON.stringify({
        manufacturerId: carDraft.manufacturerId,
        modelId: carDraft.modelId,
        variantId: null,
        year: Number(year),
        fuelType: carDraft.fuelType,
        transmission: null,
        licensePlate: plate.trim().toUpperCase(),
        vin: null,
        mileage: km ? Number(km) : 0,
        color: null,
        isPrimary: vehicles.length === 0,
      }),
    });
    setSavingCar(false);
    if (!res.success) {
      const message = res.message || res.errors?.[0] || 'Could not save your car. Please check the details.';
      setStepError(message);
      toast.error('Could not save your car', message);
      return null;
    }
    let saved = res.data && res.data.id ? res.data : null;
    const list = await apiFetch<SavedVehicle[]>('/customer/vehicles');
    if (list.success && list.data) {
      setVehicles(list.data);
      saved =
        list.data.find((v) => v.id === saved?.id) ??
        list.data.find((v) => v.licensePlate.replace(/\s/g, '') === plate.trim().toUpperCase().replace(/\s/g, '')) ??
        saved;
    } else if (saved) {
      setVehicles((vs) => [...vs, saved!]);
    }
    if (saved) {
      setSelectedVehicleId(saved.id);
      setAddingCar(false);
      setPlate('');
      setKm('');
      toast.success('Car saved', `${carDraft.manufacturerName} ${carDraft.modelName} added to your cars.`);
    }
    return saved;
  };

  // ------------------------------------------------------------------ navigation
  const goTo = (n: number) => {
    setStep(n);
    setStepError(null);
    setShowErrors(false);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const packageUnavailableMessage = (): string | null => {
    if (mode !== 'package' || !packageCode || !pricingCar || offersLoading || !offers) return null;
    const offer = offerFor(packageCode);
    if (!offer || offer.price === null) {
      const name = selectedPackage?.name ?? 'This package';
      return `${name} isn't priced for a ${pricingCar.manufacturerName} ${pricingCar.modelName} (${pricingCar.fuelType}) yet. Pick another package, or choose “Other services” and garages will quote.`;
    }
    return null;
  };

  const validateService = (): string | null => {
    if (mode === 'package') {
      if (!pricingCar) return 'Select your car first so we can show the right price.';
      if (!packageCode) return 'Choose a service package.';
      if (offersLoading) return 'Loading prices for your car…';
      if (offersError) return offersError;
      return packageUnavailableMessage();
    }
    if (!category) return 'Choose the service you need.';
    if (problem.trim().length < 5) return 'Describe the problem in a few words (at least 5 characters).';
    return null;
  };

  const handleContinue = async () => {
    setStepError(null);
    if (step === 1) {
      const err = validateService();
      if (err) {
        setShowErrors(true);
        setStepError(err);
        return;
      }
      goTo(2);
      return;
    }
    if (step === 2) {
      if (addingCar || vehicles.length === 0) {
        if (Object.values(carErrors).some(Boolean)) {
          setShowErrors(true);
          setStepError('Please complete your car details.');
          return;
        }
        const saved = await saveCar();
        if (!saved) return;
      } else if (!selectedVehicleId) {
        setStepError('Choose the car that needs service.');
        return;
      }
      const unavailable = packageUnavailableMessage();
      if (unavailable) {
        setStepError(unavailable);
        return;
      }
      goTo(3);
      return;
    }
    if (step === 3) {
      const errs = validateLocation(location, serviceArea);
      if (hasLocationErrors(errs)) {
        setShowErrors(true);
        setStepError(errs.pin || errs.confirm || 'Please complete the address.');
        return;
      }
      goTo(4);
    }
  };

  const handleBack = () => goTo(Math.max(1, step - 1));

  // ------------------------------------------------------------------ submit
  const preferredServiceDate = useMemo(() => {
    if (!preferredDay) return null;
    const [y, m, d] = preferredDay.split('-').map(Number);
    const slot = TIME_SLOTS.find((s) => s.key === preferredSlot);
    return new Date(y, m - 1, d, slot?.hour ?? 10, 0, 0).toISOString();
  }, [preferredDay, preferredSlot]);

  const createRequest = async (): Promise<CreatedRequest | null> => {
    if (created) return created;
    const loc = toLocationValue(location, serviceArea);
    if (!loc.confirmed || loc.latitude === null || loc.longitude === null) {
      goTo(3);
      setShowErrors(true);
      setStepError('Please check your location.');
      return null;
    }
    const slotLabel = TIME_SLOTS.find((s) => s.key === preferredSlot)?.label;
    const notes = mode === 'package' ? packageNotes.trim() : problem.trim();
    const description = [notes, slotLabel ? `Preferred time: ${slotLabel.toLowerCase()}.` : ''].filter(Boolean).join('\n');
    const body: Record<string, unknown> = {
      vehicleId: selectedVehicleId,
      addressLine1: loc.addressLine1,
      addressLine2: loc.addressLine2 || null,
      city: loc.city,
      state: loc.state,
      pincode: loc.pincode,
      country: 'India',
      latitude: loc.latitude,
      longitude: loc.longitude,
      problemDescription: description,
      serviceCategory: mode === 'package' ? selectedPackage?.name ?? 'Periodic Service' : category,
      preferredServiceDate,
    };
    if (mode === 'package') body.packageCode = packageCode;

    setBusy('creating');
    const res = await apiFetch<CreatedRequest>('/customer/requests', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey.current },
      body: JSON.stringify(body),
    });
    if (!res.success || !res.data) {
      setBusy(null);
      const message = res.message || 'We could not create your booking. Please try again.';
      setStepError(message);
      toast.error('Booking not created', message);
      return null;
    }
    setCreated(res.data);
    clearBookingIntent();
    return res.data;
  };

  const handleSubmit = async () => {
    setStepError(null);
    const req = await createRequest();
    if (!req) return;

    if (mode === 'other') {
      setBusy(null);
      setDone({ kind: 'quote' });
      window.scrollTo({ top: 0 });
      return;
    }

    setBusy('paying');
    const result = await payBookingAdvance(req.id);
    if (result.kind === 'paid') {
      setBusy(null);
      setDone({ kind: 'package', paid: result.amount });
      window.scrollTo({ top: 0 });
      return;
    }
    if (result.kind === 'redirect') {
      setBusy('redirecting');
      return;
    }
    setBusy(null);
    toast.error('Payment not completed', `${result.message} Your booking ${req.requestNumber} is saved — pay the advance from the booking page.`);
    router.push(`/customer/requests/${req.id}`);
  };

  // ================================================================== SUCCESS
  if (done && created) {
    const isPackage = done.kind === 'package';
    const price = created.packagePrice ?? selectedOffer?.price ?? 0;
    const paid = isPackage ? done.paid : 0;
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <div className="rounded-2xl border border-surface-200 bg-white p-5 text-center shadow-card sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-[22px] font-bold leading-7 text-navy-900">
            {isPackage ? 'Booking confirmed!' : 'Request sent'}
          </h1>
          <p className="mx-auto mt-1 max-w-sm text-sm text-navy-500">
            {isPackage
              ? `An advisor will assign a verified garage near you shortly. You'll pay the remaining ${formatINRWhole(
                  Math.max(0, price - paid)
                )} at the garage after the service.`
              : 'Verified garages near you will send quotes. We will let you know when one is ready to review.'}
          </p>

          <dl className="mt-5 divide-y divide-surface-200 rounded-xl border border-surface-200 bg-surface-50 px-4 text-left text-sm">
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-navy-500">Booking</dt>
              <dd className="font-mono font-semibold text-navy-900">{created.requestNumber}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-navy-500">Car</dt>
              <dd className="min-w-0 truncate text-right font-medium text-navy-900">{created.vehicleSummary}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-navy-500">Service</dt>
              <dd className="min-w-0 truncate text-right font-medium text-navy-900">
                {created.servicePackageName || created.serviceCategory}
              </dd>
            </div>
          </dl>

          {isPackage ? (
            <PriceSplit
              className="mt-3 text-left"
              total={price}
              advance={paid}
              atGarage={Math.max(0, price - paid)}
              percent={advancePercent}
              advancePaid
            />
          ) : (
            <ol className="mt-5 space-y-3 text-left text-sm">
              {[
                'Verified garages near you send their quotes.',
                'Your advisor shares the best one — you accept it.',
                `Pay ${advancePercent}% online to confirm. The rest is paid at the garage after the service.`,
              ].map((t, i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-electric-50 text-xs font-bold text-electric-700">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 text-navy-700">{t}</span>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href={`/customer/requests/${created.id}`} className="w-full sm:w-auto">
              <Button variant="primary" className="w-full">
                {isPackage ? 'View booking' : 'Track this request'}
              </Button>
            </Link>
            <Link href="/customer/dashboard" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full">
                Go to home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ================================================================== FLOW
  const isReview = step === STEPS.length;
  const carFormVisible = addingCar || (!loadingVehicles && vehicles.length === 0);
  const advance = selectedOffer?.advanceAmount ?? 0;
  const atGarage = selectedOffer?.payAtGarageAmount ?? 0;
  const ctaLabel =
    mode === 'package'
      ? busy === 'creating'
        ? 'Creating booking…'
        : busy === 'paying'
        ? 'Confirming payment…'
        : busy === 'redirecting'
        ? 'Opening payment…'
        : `Pay ${formatINRWhole(advance)} & book`
      : busy
      ? 'Sending…'
      : 'Get quotes from garages';

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Book a service" backHref="/customer/requests" backLabel="My requests" />

      {/* Stepper */}
      <nav aria-label="Booking progress" className="mb-5">
        <ol className="grid grid-cols-4 gap-1.5">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const doneStep = n < step;
            const active = n === step;
            return (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => doneStep && !busy && goTo(n)}
                  disabled={!doneStep || !!busy}
                  aria-current={active ? 'step' : undefined}
                  aria-label={`Step ${n}: ${label}${doneStep ? ' (done, go back)' : active ? ' (current)' : ''}`}
                  className="flex w-full flex-col gap-1.5 py-1.5 text-left disabled:cursor-default"
                >
                  <span className={`h-1.5 w-full rounded-full ${doneStep || active ? 'bg-electric-600' : 'bg-surface-200'}`} />
                  <span
                    className={`truncate text-xs ${
                      active ? 'font-semibold text-navy-900' : doneStep ? 'font-medium text-electric-700' : 'text-navy-400'
                    }`}
                  >
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {stepError && (
        <Alert type="error" onClose={() => setStepError(null)} className="mb-4">
          {stepError}
        </Alert>
      )}

      {/* ============================ STEP 1: SERVICE ============================ */}
      {step === 1 && (
        <section className="space-y-4" aria-labelledby="step-service">
          <h2 id="step-service" className="text-base font-semibold text-navy-900">
            What does your car need?
          </h2>

          <div role="tablist" aria-label="Service type" className="grid grid-cols-2 gap-1 rounded-xl bg-surface-100 p-1">
            {(
              [
                ['package', 'Service packages'],
                ['other', 'Other services'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                onClick={() => {
                  setMode(key);
                  setStepError(null);
                  setShowErrors(false);
                }}
                className={`min-h-[44px] rounded-lg px-3 text-sm font-semibold transition ${
                  mode === key ? 'bg-white text-navy-900 shadow-card' : 'text-navy-500 hover:text-navy-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'package' ? (
            <div className="space-y-4">
              <CarSelectField
                label="Your car"
                value={pricingCar}
                onChange={handleCarPicked}
                placeholder="Select your car to see prices"
                error={showErrors && !pricingCar ? 'Select your car to see prices.' : undefined}
              />
              {loadingVehicles && !pricingCar && <p className="-mt-2 text-xs text-navy-400">Loading your saved cars…</p>}

              {offersError && (
                <Alert type="error">
                  {offersError}
                </Alert>
              )}

              {!packages ? (
                <div className="space-y-3">
                  <Skeleton className="h-36" />
                  <Skeleton className="h-36" />
                  <Skeleton className="h-36" />
                </div>
              ) : packages.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-surface-300 bg-white p-4 text-sm text-navy-500">
                  Service packages are not available right now. Choose “Other services” and garages will quote.
                </p>
              ) : (
                <div role="radiogroup" aria-label="Service package" className="space-y-3">
                  {packages.map((pkg) => {
                    const offer = offerFor(pkg.code);
                    const selected = packageCode.toUpperCase() === pkg.code.toUpperCase();
                    const priced = offer && offer.price !== null;
                    const unavailable = !!pricingCar && !!offers && !priced;
                    const isOpen = expanded === pkg.code;
                    const includes = offer?.package.includes ?? pkg.includes ?? [];
                    return (
                      <div
                        key={pkg.code}
                        className={`rounded-2xl border bg-white shadow-card transition ${
                          selected ? 'border-electric-600 ring-2 ring-electric-600/20' : 'border-surface-200'
                        } ${unavailable ? 'opacity-60' : ''}`}
                      >
                        <button
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          disabled={unavailable}
                          onClick={() => {
                            setPackageCode(pkg.code);
                            setStepError(null);
                          }}
                          className="flex w-full items-start gap-3 p-4 text-left disabled:cursor-not-allowed"
                        >
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                              selected ? 'border-electric-600 bg-electric-600' : 'border-surface-300'
                            }`}
                            aria-hidden="true"
                          >
                            {selected && <span className="h-2 w-2 rounded-full bg-white" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-[15px] font-semibold text-navy-900">{pkg.name}</span>
                              {pkg.isRecommended && (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                  Most booked
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 block text-sm leading-snug text-navy-500">{pkg.tagline}</span>
                            <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-navy-500">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" /> {pkg.durationHours} hrs
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>Every {pkg.intervalKm.toLocaleString('en-IN')} km</span>
                              {pkg.warrantyDays > 0 && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{pkg.warrantyDays}-day warranty</span>
                                </>
                              )}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            {!pricingCar ? (
                              <span className="text-xs text-navy-400">Select car</span>
                            ) : offersLoading ? (
                              <Skeleton className="h-5 w-16" />
                            ) : priced ? (
                              <>
                                <span className="block text-base font-bold tabular-nums text-navy-900">
                                  {formatINRWhole(offer!.price)}
                                </span>
                                <span className="block text-[11px] text-electric-700">
                                  {formatINRWhole(offer!.advanceAmount)} now
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-navy-400">Not available</span>
                            )}
                          </span>
                        </button>
                        {includes.length > 0 && (
                          <div className="border-t border-surface-100 px-4 pb-3 pt-2">
                            <ul className="grid gap-1 text-sm text-navy-700">
                              {(isOpen ? includes : includes.slice(0, 2)).map((item) => (
                                <li key={item} className="flex items-start gap-2">
                                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                            {includes.length > 2 && (
                              <button
                                type="button"
                                onClick={() => setExpanded(isOpen ? null : pkg.code)}
                                aria-expanded={isOpen}
                                className="mt-1 inline-flex min-h-[36px] items-center gap-1 text-sm font-medium text-electric-700"
                              >
                                {isOpen ? (
                                  <>
                                    Show less <ChevronUp className="h-4 w-4" />
                                  </>
                                ) : (
                                  <>
                                    +{includes.length - 2} more checks <ChevronDown className="h-4 w-4" />
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedOffer && selectedOffer.price !== null && (
                <div className="space-y-2">
                  <PriceSplit
                    total={selectedOffer.price}
                    advance={selectedOffer.advanceAmount ?? 0}
                    atGarage={selectedOffer.payAtGarageAmount ?? 0}
                    percent={advancePercent}
                  />
                  <PaymentModelNote />
                </div>
              )}

              <Textarea
                id="packageNotes"
                label="Anything else the garage should know? (optional)"
                rows={2}
                value={packageNotes}
                onChange={(e) => setPackageNotes(e.target.value)}
                placeholder="e.g. Brakes squeak a little, please check."
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div role="radiogroup" aria-label="Service" className="grid grid-cols-2 gap-2">
                {OTHER_SERVICES.map(({ name, icon: Icon }) => {
                  const selected = category === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setCategory(name);
                        setStepError(null);
                      }}
                      className={`flex min-h-[56px] items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm font-medium leading-snug transition touch-manipulation ${
                        selected
                          ? 'border-electric-600 bg-electric-50 text-electric-800 ring-1 ring-electric-600'
                          : 'border-surface-200 bg-white text-navy-700 hover:border-surface-300'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${selected ? 'text-electric-600' : 'text-navy-400'}`} />
                      <span className="min-w-0">{name}</span>
                    </button>
                  );
                })}
              </div>
              {showErrors && !category && <p className="-mt-2 text-sm text-semantic-error">Choose the service you need.</p>}

              <Textarea
                id="problemDescription"
                label="Describe the problem"
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="e.g. AC is not cooling and makes a rattling noise when switched on."
                rows={4}
                helperText="Warning lights, noises, when it happens — anything helps garages quote accurately."
                error={showErrors && problem.trim().length < 5 ? 'Describe the problem in at least 5 characters.' : undefined}
                required
              />
              <div className="rounded-xl bg-surface-50 p-3">
                <PaymentModelNote quoteBased />
              </div>
            </div>
          )}
        </section>
      )}

      {/* ============================ STEP 2: CAR ============================ */}
      {step === 2 && (
        <section className="space-y-4" aria-labelledby="step-car">
          <div>
            <h2 id="step-car" className="text-base font-semibold text-navy-900">
              Which car needs service?
            </h2>
            {mode === 'package' && selectedPackage && (
              <p className="mt-0.5 text-sm text-navy-500">The {selectedPackage.name} price depends on your car and fuel.</p>
            )}
          </div>

          {loadingVehicles ? (
            <div className="space-y-3">
              <Skeleton className="h-[72px]" />
              <Skeleton className="h-[72px]" />
            </div>
          ) : vehiclesError ? (
            <Alert type="error" title="Could not load your cars">
              {vehiclesError}{' '}
              <button type="button" className="font-semibold underline" onClick={loadVehicles}>
                Try again
              </button>
            </Alert>
          ) : (
            vehicles.length > 0 && (
              <div role="radiogroup" aria-label="Your cars" className="space-y-2.5">
                {vehicles.map((v) => {
                  const selected = !addingCar && selectedVehicleId === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setSelectedVehicleId(v.id);
                        setAddingCar(false);
                        setStepError(null);
                      }}
                      className={`flex min-h-[72px] w-full items-center gap-3 rounded-2xl border bg-white p-3.5 text-left transition touch-manipulation ${
                        selected ? 'border-electric-600 ring-2 ring-electric-600/20' : 'border-surface-200 hover:border-surface-300'
                      }`}
                    >
                      <BrandLogo name={v.make} logoUrl={logos[v.manufacturerId]} size={44} className="border border-surface-100" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-navy-900">
                          {v.make} {v.model}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-navy-500">
                          <span>{v.fuelType}</span>
                          <span aria-hidden="true">·</span>
                          <span>{v.year}</span>
                          <span className="rounded border border-navy-900/70 px-1.5 font-mono text-[11px] font-semibold tracking-wide text-navy-900">
                            {v.licensePlate}
                          </span>
                        </span>
                      </span>
                      {selected ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-electric-600" aria-hidden="true" />
                      ) : (
                        v.isPrimary && (
                          <span className="shrink-0 rounded-full bg-surface-100 px-2 py-0.5 text-xs font-medium text-navy-600">Primary</span>
                        )
                      )}
                    </button>
                  );
                })}
                {!addingCar && (
                  <button
                    type="button"
                    onClick={() => {
                      setAddingCar(true);
                      setStepError(null);
                    }}
                    className="flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-surface-300 text-sm font-semibold text-electric-700 hover:border-electric-300"
                  >
                    <Plus className="h-4 w-4" /> Add another car
                  </button>
                )}
              </div>
            )
          )}

          {!loadingVehicles && !vehiclesError && carFormVisible && (
            <div className="space-y-4 rounded-2xl border border-surface-200 bg-white p-4 shadow-card sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-navy-900">
                    {carDraft?.modelName ? 'Add this car' : 'Add your car'}
                  </h3>
                  <p className="mt-0.5 text-sm text-navy-500">We save it to your profile for future bookings.</p>
                </div>
                {vehicles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAddingCar(false);
                      if (!selectedVehicleId) setSelectedVehicleId((vehicles.find((v) => v.isPrimary) ?? vehicles[0]).id);
                    }}
                    className="-mr-2 min-h-[44px] shrink-0 px-2 text-sm font-medium text-navy-500 hover:text-navy-800"
                  >
                    Cancel
                  </button>
                )}
              </div>
              <CarSelectField
                label="Brand, model and fuel"
                value={carDraft ? { ...carDraft, logoUrl: carDraft.logoUrl ?? logos[carDraft.manufacturerId] } : null}
                onChange={handleCarPicked}
                error={showErrors ? carErrors.car : undefined}
              />
              <Input
                id="car-plate"
                label="Registration number"
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="e.g. TS 09 AB 1234"
                autoCapitalize="characters"
                autoComplete="off"
                className="font-mono uppercase"
                error={showErrors ? carErrors.plate : undefined}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <Select
                  id="car-year"
                  label="Year"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  disabled={yearOptions.length === 0}
                  error={showErrors ? carErrors.year : undefined}
                  required
                >
                  <option value="" disabled>
                    {carDraft?.modelId ? (yearOptions.length ? 'Select year' : 'Loading…') : 'Choose car first'}
                  </option>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </Select>
                <Input
                  id="car-km"
                  label="Km driven (optional)"
                  value={km}
                  onChange={(e) => setKm(e.target.value.replace(/\D/g, '').slice(0, 7))}
                  inputMode="numeric"
                  placeholder="e.g. 32000"
                  error={showErrors ? carErrors.km : undefined}
                />
              </div>
            </div>
          )}

          {pricingCar && mode === 'package' && selectedPackage && (
            <div className="rounded-xl bg-surface-50 p-3 text-sm">
              {offersLoading ? (
                <span className="text-navy-500">Checking the {selectedPackage.name} price for this car…</span>
              ) : selectedOffer && selectedOffer.price !== null ? (
                <span className="text-navy-700">
                  {selectedPackage.name} for {pricingCar.manufacturerName} {pricingCar.modelName} · {pricingCar.fuelType}:{' '}
                  <strong className="tabular-nums text-navy-900">{formatINRWhole(selectedOffer.price)}</strong>
                </span>
              ) : (
                <span className="text-amber-800">{packageUnavailableMessage()}</span>
              )}
            </div>
          )}
        </section>
      )}

      {/* ============================ STEP 3: LOCATION ============================ */}
      {step === 3 && (
        <section className="space-y-4" aria-labelledby="step-location">
          <div>
            <h2 id="step-location" className="text-base font-semibold text-navy-900">
              Where is your car?
            </h2>
            <p className="mt-0.5 text-sm text-navy-500">
              We match you with verified garages close to this pin. We&apos;re in {serviceArea.city} only for now.
            </p>
          </div>
          <LocationPicker value={location} onChange={handleLocationChange} serviceArea={serviceArea} showErrors={showErrors} />
        </section>
      )}

      {/* ============================ STEP 4: REVIEW ============================ */}
      {isReview && (
        <section className="space-y-5" aria-labelledby="step-review">
          <div>
            <h2 id="step-when" className="text-base font-semibold text-navy-900">
              When would you like the service? <span className="font-normal text-navy-400">(optional)</span>
            </h2>
            <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0">
              <DayChip label="Any day" sub="Flexible" selected={!preferredDay} onClick={() => setPreferredDay('')} />
              {nextDays(14).map((d, i) => (
                <DayChip
                  key={dateKey(d)}
                  label={i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short' })}
                  sub={d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  selected={preferredDay === dateKey(d)}
                  onClick={() => setPreferredDay(dateKey(d))}
                />
              ))}
            </div>
            {preferredDay && (
              <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Preferred time">
                {TIME_SLOTS.map((s) => {
                  const selected = preferredSlot === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setPreferredSlot(selected ? '' : s.key)}
                      className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl border px-2 text-center transition ${
                        selected ? 'border-electric-600 bg-electric-50 ring-1 ring-electric-600' : 'border-surface-200 bg-white'
                      }`}
                    >
                      <span className="text-sm font-semibold text-navy-900">{s.label}</span>
                      <span className="text-[11px] text-navy-500">{s.hint}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-xs text-navy-400">The garage confirms the exact slot with you.</p>
          </div>

          <div>
            <h2 id="step-review" className="mb-2 text-base font-semibold text-navy-900">
              Check your booking
            </h2>
            <div className="divide-y divide-surface-200 rounded-2xl border border-surface-200 bg-white shadow-card">
              <ReviewBlock title="Service" onEdit={() => goTo(1)} disabled={!!busy}>
                {mode === 'package' ? (
                  <>
                    <div className="font-semibold text-navy-900">{selectedPackage?.name}</div>
                    {packageNotes.trim() && <p className="mt-0.5 whitespace-pre-wrap text-navy-600">{packageNotes.trim()}</p>}
                  </>
                ) : (
                  <>
                    <div className="font-semibold text-navy-900">{category}</div>
                    <p className="mt-0.5 whitespace-pre-wrap text-navy-600">{problem.trim()}</p>
                  </>
                )}
              </ReviewBlock>
              <ReviewBlock title="Car" onEdit={() => goTo(2)} disabled={!!busy}>
                {selectedVehicle ? (
                  <div className="flex items-center gap-2.5">
                    <BrandLogo name={selectedVehicle.make} logoUrl={logos[selectedVehicle.manufacturerId]} size={32} />
                    <div className="min-w-0">
                      <div className="font-semibold text-navy-900">
                        {selectedVehicle.make} {selectedVehicle.model} · {selectedVehicle.fuelType}
                      </div>
                      <div className="font-mono text-xs text-navy-500">{selectedVehicle.licensePlate}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-navy-500">No car selected</div>
                )}
              </ReviewBlock>
              <ReviewBlock title="Car location" onEdit={() => goTo(3)} disabled={!!busy}>
                <div className="text-navy-900">{formatLocationDraft(location)}</div>
                <div className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Pin and address match
                </div>
              </ReviewBlock>
              {preferredDay && (
                <ReviewBlock title="Preferred time" onEdit={() => undefined} hideEdit>
                  <div className="text-navy-900">
                    {formatDate(preferredServiceDate)}
                    {preferredSlot && ` · ${TIME_SLOTS.find((s) => s.key === preferredSlot)?.label}`}
                  </div>
                </ReviewBlock>
              )}
            </div>
          </div>

          {mode === 'package' && selectedOffer && selectedOffer.price !== null ? (
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-navy-900">Payment</h2>
              <PriceSplit total={selectedOffer.price} advance={advance} atGarage={atGarage} percent={advancePercent} />
              <PaymentModelNote />
            </div>
          ) : (
            mode === 'other' && (
              <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-electric-50 text-electric-600">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-navy-900">Nothing to pay now</div>
                    <PaymentModelNote quoteBased className="mt-0.5" />
                  </div>
                </div>
              </div>
            )
          )}

          {created && mode === 'package' && (
            <Alert type="info">
              Booking {created.requestNumber} is saved. Tap pay to confirm it, or{' '}
              <Link href={`/customer/requests/${created.id}`} className="font-semibold underline">
                open the booking
              </Link>
              .
            </Alert>
          )}
        </section>
      )}

      <ActionBar>
        {step > 1 && (
          <Button variant="outline" onClick={handleBack} disabled={!!busy || savingCar} leftIcon={<ChevronLeft className="h-4 w-4" />}>
            Back
          </Button>
        )}
        {isReview ? (
          <Button variant="primary" onClick={handleSubmit} isLoading={!!busy} disabled={!!busy}>
            {ctaLabel}
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={handleContinue}
            isLoading={savingCar}
            disabled={step === 2 && loadingVehicles}
            rightIcon={!savingCar ? <ChevronRight className="h-4 w-4" /> : undefined}
          >
            {step === 2 && carFormVisible ? (savingCar ? 'Saving…' : 'Save & continue') : 'Continue'}
          </Button>
        )}
      </ActionBar>
      <ActionBarSpacer />
    </div>
  );
}

function DayChip({ label, sub, selected, onClick }: { label: string; sub: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-[56px] w-[72px] shrink-0 flex-col items-center justify-center rounded-xl border text-center transition ${
        selected ? 'border-electric-600 bg-electric-600 text-white' : 'border-surface-200 bg-white text-navy-800 hover:border-surface-300'
      }`}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className={`text-[11px] ${selected ? 'text-white/80' : 'text-navy-500'}`}>{sub}</span>
    </button>
  );
}

function ReviewBlock({
  title,
  onEdit,
  children,
  disabled = false,
  hideEdit = false,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  hideEdit?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 p-4 text-sm">
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-xs font-medium text-navy-400">{title}</div>
        {children}
      </div>
      {!hideEdit && (
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          className="-mr-2 -mt-1 min-h-[44px] shrink-0 rounded-lg px-2 text-sm font-medium text-electric-600 hover:text-electric-700 disabled:opacity-50"
          aria-label={`Edit ${title.toLowerCase()}`}
        >
          Edit
        </button>
      )}
    </div>
  );
}
