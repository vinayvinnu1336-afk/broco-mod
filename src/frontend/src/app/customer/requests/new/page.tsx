'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PackageIncludes } from '@/components/catalogue/PackageIncludes';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  BatteryCharging,
  Car,
  CarFront,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock,
  Cog,
  Disc,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  Paperclip,
  Plus,
  ShieldCheck,
  Snowflake,
  Sparkles,
  SprayCan,
  Truck,
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
  formatHours,
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
import { liveCitiesLabel, useLiveServiceArea, useLiveServiceAreas } from '@/components/location/serviceArea';
import { PaymentModelNote, PriceSplit } from '@/components/booking/PriceSplit';
import { ADVANCE_PERCENT, payBookingAdvance } from '@/components/booking/advancePayment';
import { PICKUP_SLOTS, formatPickup } from '@/components/booking/pickup';
import { CustomerFilesField } from '@/components/booking/CustomerFiles';
import { CustomerFileDraft, CUSTOMER_FILE_LIMITS, setUnsentFiles, uploadCustomerFile } from '@/lib/customerUploads';

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

// Mirrors ServiceCategories on the server: at most 8 per request, and the joined names must fit
// the 100-character ServiceCategory column.
const MAX_SERVICES = 8;
const MAX_SERVICES_TEXT = 300;
const joinServices = (names: string[]) => names.join(', ');

const PICKUP_NOTES_MAX = 300;

/**
 * The sections, in the order problems are reported. Screen 1 ("details"): car, service, location and the
 * optional files. Screen 2 ("review", ?step=review): pick-up & drop, then the overview and payment.
 */
const SECTION_IDS = {
  car: 'booking-car',
  service: 'booking-service',
  location: 'booking-location',
  files: 'booking-files',
  pickup: 'booking-pickup',
  review: 'booking-review',
} as const;
type SectionKey = keyof typeof SECTION_IDS;
type Step = 'details' | 'review';

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
      <Skeleton className="h-64" />
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
  const liveAreas = useLiveServiceAreas();

  const [formError, setFormError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // ---- Service
  const [mode, setMode] = useState<Mode>('package');
  const [packageCode, setPackageCode] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [serviceLimitHit, setServiceLimitHit] = useState(false);
  const [problem, setProblem] = useState('');
  const [packageNotes, setPackageNotes] = useState('');
  const [packages, setPackages] = useState<ServicePackage[] | null>(null);
  const [openIncludes, setOpenIncludes] = useState<Record<string, boolean>>({});

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
    setFormError(null);
  }, []);

  // ---- Pick-up & drop and when
  const [needsPickup, setNeedsPickup] = useState<boolean | null>(null);
  const [pickupNotes, setPickupNotes] = useState('');
  const [preferredDay, setPreferredDay] = useState('');
  const [preferredSlot, setPreferredSlot] = useState('');

  // ---- Photos & documents (optional): uploaded right after the request is created
  const [files, setFiles] = useState<CustomerFileDraft[]>([]);
  const filesRef = useRef<CustomerFileDraft[]>([]);
  filesRef.current = files;
  const [fileResult, setFileResult] = useState<{ sent: number; failed: number } | null>(null);

  // ---- Steps. The step lives in the URL (?step=review) so the phone's back button returns to screen 1;
  // everything typed stays in this component's state across the change.
  const step: Step = searchParams.get('step') === 'review' ? 'review' : 'details';
  const detailsDone = useRef(false);
  const pushedReview = useRef(false);
  const pendingScroll = useRef<SectionKey | null>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const [showPickupErrors, setShowPickupErrors] = useState(false);
  // Opening ?step=review directly (a reload, a shared link) starts on screen 1: nothing was checked yet.
  const onReview = step === 'review' && detailsDone.current;

  // ---- Submit
  const [busy, setBusy] = useState<null | 'creating' | 'uploading' | 'paying' | 'redirecting'>(null);
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
      setCategories([qpCategory]);
    } else if (intent?.packageCode) {
      setMode('package');
      setPackageCode(intent.packageCode.toUpperCase());
    } else if (findCategory(intent?.serviceCategory)) {
      setMode('other');
      setCategories([findCategory(intent?.serviceCategory)!]);
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
      setFormError(message);
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

  // ------------------------------------------------------------------ validation
  const carFormVisible = addingCar || (!loadingVehicles && vehicles.length === 0);

  const scrollToSection = (key: SectionKey) => {
    const el = document.getElementById(SECTION_IDS[key]);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
  };

  // ------------------------------------------------------------------ steps
  const urlFor = (next: Step) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'review') params.set('step', 'review');
    else params.delete('step');
    const qs = params.toString();
    return `/customer/requests/new${qs ? `?${qs}` : ''}`;
  };

  /** Back to screen 1, optionally at one section ("Edit" links). Uses history so the forward button still works. */
  const goToDetails = (section?: SectionKey) => {
    pendingScroll.current = section ?? null;
    if (pushedReview.current && step === 'review') router.back();
    else router.replace(urlFor('details'), { scroll: false });
  };

  useEffect(() => {
    if (step === 'review' && !detailsDone.current) {
      router.replace(urlFor('details'), { scroll: false });
      return;
    }
    const key = pendingScroll.current;
    pendingScroll.current = null;
    if (step === 'details' && key) {
      window.requestAnimationFrame(() => scrollToSection(key));
    } else {
      window.scrollTo({ top: 0 });
      if (step === 'review') stepHeadingRef.current?.focus({ preventScroll: true });
    }
    // Only the step change matters here; the helpers read the latest values when they run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const packageUnavailableMessage = (): string | null => {
    if (mode !== 'package' || !packageCode || !pricingCar || offersLoading || !offers) return null;
    const offer = offerFor(packageCode);
    if (!offer || offer.price === null) {
      const name = selectedPackage?.name ?? 'This package';
      return `${name} isn't priced for a ${pricingCar.manufacturerName} ${pricingCar.modelName} (${pricingCar.fuelType}) yet. Pick another package, or choose “Other services” and garages will quote.`;
    }
    return null;
  };

  // Each section's first problem; field-level messages are shown by the fields themselves.
  const serviceProblem = (): string | null => {
    if (mode === 'package') {
      if (!packageCode) return 'Choose a service package.';
      if (!pricingCar) return null; // the car section asks for the car
      if (offersLoading) return 'Loading prices for your car…';
      if (offersError) return offersError;
      return packageUnavailableMessage();
    }
    if (categories.length === 0) return 'Choose at least one service.';
    if (problem.trim().length < 5) return 'Describe the problem in a few words (at least 5 characters).';
    return null;
  };
  const carProblem = (): string | null => {
    if (loadingVehicles) return 'Still loading your cars, one moment…';
    if (vehiclesError) return vehiclesError;
    if (carFormVisible) return Object.values(carErrors).some(Boolean) ? 'Please complete your car details.' : null;
    if (!selectedVehicleId) return 'Choose the car that needs service.';
    return null;
  };
  const locationErrors = validateLocation(location, serviceArea);
  const locationConfirmed = !hasLocationErrors(locationErrors);
  const locationProblem = (): string | null =>
    locationConfirmed ? null : locationErrors.pin || locationErrors.confirm || 'Please complete the address.';
  const pickupProblem = (): string | null => (needsPickup === null ? 'Tell us if you need pick-up & drop.' : null);

  const sectionErrors: Record<SectionKey, string | null> = {
    service: showErrors ? serviceProblem() : null,
    car: showErrors && !carFormVisible ? carProblem() : null,
    // The picker already shows a missing pin in red next to the button; the alert covers the rest.
    location: showErrors && !locationErrors.pin ? locationProblem() : null,
    files: null,
    pickup: showPickupErrors ? pickupProblem() : null,
    review: null,
  };

  const toggleCategory = (name: string) => {
    setFormError(null);
    if (categories.includes(name)) {
      setCategories(categories.filter((c) => c !== name));
      setServiceLimitHit(false);
      return;
    }
    const next = [...categories, name];
    if (next.length > MAX_SERVICES || joinServices(next).length > MAX_SERVICES_TEXT) {
      setServiceLimitHit(true);
      return;
    }
    setCategories(next);
  };

  // ------------------------------------------------------------------ submit
  const slot = PICKUP_SLOTS.find((s) => s.key === preferredSlot) ?? null;

  const preferredServiceDate = useMemo(() => {
    if (!preferredDay) return null;
    const [y, m, d] = preferredDay.split('-').map(Number);
    const chosen = PICKUP_SLOTS.find((s) => s.key === preferredSlot);
    return new Date(y, m - 1, d, chosen?.hour ?? 10, 0, 0).toISOString();
  }, [preferredDay, preferredSlot]);

  const pickupSummary = formatPickup(
    { needsPickup, pickupNotes: pickupNotes.trim(), pickupSlot: slot?.value ?? null },
    "No, I'll drive to the garage"
  );

  const createRequest = async (vehicleId: string): Promise<CreatedRequest | null> => {
    if (created) return created;
    const loc = toLocationValue(location, serviceArea);
    if (!loc.confirmed || loc.latitude === null || loc.longitude === null) {
      setShowErrors(true);
      goToDetails('location');
      return null;
    }
    const notes = mode === 'package' ? packageNotes.trim() : problem.trim();
    // When the garage picks the car up, the slot travels in its own field.
    const timeNote = slot && !needsPickup ? `Preferred time: ${slot.label.toLowerCase()}.` : '';
    const description = [notes, timeNote].filter(Boolean).join('\n');
    const body: Record<string, unknown> = {
      vehicleId,
      addressLine1: loc.addressLine1,
      addressLine2: loc.addressLine2 || null,
      city: loc.city,
      state: loc.state,
      pincode: loc.pincode,
      country: 'India',
      latitude: loc.latitude,
      longitude: loc.longitude,
      problemDescription: description,
      serviceCategory: mode === 'package' ? selectedPackage?.name ?? 'Periodic Service' : joinServices(categories),
      preferredServiceDate,
      needsPickup: needsPickup === true,
      pickupNotes: needsPickup ? pickupNotes.trim() || null : null,
      pickupSlot: needsPickup ? slot?.value ?? null : null,
    };
    if (mode === 'package') body.packageCode = packageCode;
    else body.serviceCategories = categories;

    setBusy('creating');
    const res = await apiFetch<CreatedRequest>('/customer/requests', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey.current },
      body: JSON.stringify(body),
    });
    if (!res.success || !res.data) {
      setBusy(null);
      const message = res.message || 'We could not create your booking. Please try again.';
      setFormError(message);
      toast.error('Booking not created', message);
      return null;
    }
    setCreated(res.data);
    clearBookingIntent();
    return res.data;
  };

  /** Screen 1's first problem, in the order the sections appear (car, service, location). */
  const firstDetailsProblem = (): SectionKey | null => {
    if (carProblem()) return 'car';
    if (serviceProblem()) return 'service';
    if (locationProblem()) return 'location';
    return null;
  };

  /** A car typed in on screen 1 is saved to the profile when the customer continues. */
  const saveCarIfNeeded = async (): Promise<string | null> => {
    if (!carFormVisible) return selectedVehicleId;
    const saved = await saveCar();
    return saved?.id ?? null;
  };

  const handleContinue = async () => {
    setFormError(null);
    const problem = firstDetailsProblem();
    if (problem) {
      setShowErrors(true);
      scrollToSection(problem);
      return;
    }
    const vehicleId = await saveCarIfNeeded();
    if (!vehicleId) {
      scrollToSection('car');
      return;
    }
    detailsDone.current = true;
    pushedReview.current = true;
    router.push(urlFor('review'), { scroll: false });
  };

  /** Uploads the picked files one by one. Failures don't stop the booking; the request page offers a retry. */
  const uploadFiles = async (requestId: string) => {
    const queue = filesRef.current.filter((f) => f.status === 'ready' || f.status === 'error');
    if (queue.length === 0) return;
    setBusy('uploading');
    const update = (key: string, patch: Partial<CustomerFileDraft>) =>
      setFiles((list) => list.map((f) => (f.key === key ? { ...f, ...patch } : f)));
    const failed: CustomerFileDraft[] = [];
    let sent = 0;
    for (const draft of queue) {
      update(draft.key, { status: 'uploading', progress: 0, error: undefined });
      const result = await uploadCustomerFile(requestId, draft, (progress) => update(draft.key, { progress }));
      if (result.ok) {
        sent += 1;
        update(draft.key, { status: 'done', progress: 1 });
      } else {
        update(draft.key, { status: 'error', error: result.message });
        failed.push({ ...draft, status: 'error', error: result.message });
      }
    }
    setUnsentFiles(requestId, failed);
    setFileResult({ sent, failed: failed.length });
  };

  const handleSubmit = async () => {
    setFormError(null);
    // Screen 1 again, in case it was changed and the forward button brought the customer back here.
    const problem = firstDetailsProblem();
    if (problem) {
      setShowErrors(true);
      goToDetails(problem);
      return;
    }
    if (pickupProblem()) {
      setShowPickupErrors(true);
      scrollToSection('pickup');
      return;
    }

    const vehicleId = await saveCarIfNeeded();
    if (!vehicleId) {
      goToDetails('car');
      return;
    }

    const req = await createRequest(vehicleId);
    if (!req) return;
    await uploadFiles(req.id);

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
    if (result.kind === 'dismissed') {
      // The customer closed the checkout: the booking is saved and waits for its advance.
      toast.info('Payment not completed', `Your booking ${req.requestNumber} is saved. Pay the advance whenever you're ready.`);
    } else {
      toast.error('Payment not completed', `${result.message} Your booking ${req.requestNumber} is saved — pay the advance from the booking page.`);
    }
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
              <dd className="min-w-0 break-words text-right font-medium text-navy-900">
                {created.servicePackageName || created.serviceCategory}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3 py-2.5">
              <dt className="shrink-0 text-navy-500">Pick-up &amp; drop</dt>
              <dd className="min-w-0 break-words text-right font-medium text-navy-900">{pickupSummary}</dd>
            </div>
            {fileResult && fileResult.sent > 0 && (
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-navy-500">Photos &amp; documents</dt>
                <dd className="font-medium text-navy-900">
                  {fileResult.sent} {fileResult.sent === 1 ? 'file' : 'files'} attached
                </dd>
              </div>
            )}
          </dl>

          {fileResult && fileResult.failed > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-left text-sm text-amber-900" role="status">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {fileResult.failed === 1 ? '1 file' : `${fileResult.failed} files`} didn&apos;t upload. Your booking is saved;{' '}
                <Link href={`/customer/requests/${created.id}`} className="font-semibold underline">
                  open it to retry
                </Link>
                .
              </span>
            </div>
          )}

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
                `Only then you pay ${advancePercent}% online to confirm. The rest is paid at the garage after the service.`,
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

  // ================================================================== THE PAGE
  const advance = selectedOffer?.advanceAmount ?? 0;
  const atGarage = selectedOffer?.payAtGarageAmount ?? 0;
  const ctaLabel =
    mode === 'package'
      ? savingCar
        ? 'Saving your car…'
        : busy === 'creating'
        ? 'Creating booking…'
        : busy === 'paying'
        ? 'Confirming payment…'
        : busy === 'redirecting'
        ? 'Opening payment…'
        : `Pay ${formatINRWhole(advance)} & book`
      : savingCar
      ? 'Saving your car…'
      : busy
      ? 'Sending…'
      : 'Get quotes from garages';

  const carSummary = (() => {
    if (selectedVehicle && !addingCar) {
      return {
        name: `${selectedVehicle.make} ${selectedVehicle.model} · ${selectedVehicle.fuelType}`,
        plate: selectedVehicle.licensePlate,
        logo: logos[selectedVehicle.manufacturerId],
        brand: selectedVehicle.make,
      };
    }
    if (carDraft?.modelId) {
      return {
        name: `${carDraft.manufacturerName} ${carDraft.modelName} · ${carDraft.fuelType}`,
        plate: plate.trim().toUpperCase() || 'Registration number needed',
        logo: carDraft.logoUrl ?? logos[carDraft.manufacturerId],
        brand: carDraft.manufacturerName,
      };
    }
    return null;
  })();

  const filesToSend = files.filter((f) => f.status !== 'invalid');
  const uploadingIndex = files.filter((f) => f.status !== 'invalid').findIndex((f) => f.status === 'uploading');
  const busyLabel =
    busy === 'uploading'
      ? `Uploading files ${Math.max(1, uploadingIndex + 1)} of ${filesToSend.length}…`
      : null;
  const servicePrice = mode === 'package' && selectedOffer && selectedOffer.price !== null ? selectedOffer.price : null;

  return (
    <div className="mx-auto max-w-2xl">
      {onReview ? (
        <>
          <button
            type="button"
            onClick={() => goToDetails()}
            disabled={!!busy}
            className="-ml-1.5 mb-2 inline-flex min-h-[36px] items-center gap-1 rounded-lg px-1.5 text-sm font-medium text-navy-500 transition hover:text-navy-900 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Car, service &amp; location
          </button>
          <PageHeader title="Pick-up & review" description="Tell us if we should collect the car, check everything once, then book." className="!mb-4" />
        </>
      ) : (
        <PageHeader
          title="Book a service"
          description="Your car, the service and where the car is. Pick-up and payment come next."
          backHref="/customer/requests"
          backLabel="My requests"
          className="!mb-4"
        />
      )}

      <StepIndicator step={onReview ? 2 : 1} headingRef={stepHeadingRef} />

      {!onReview ? (
        <div className="space-y-4">
          {/* ============================ 1. CAR ============================ */}
          <SectionCard
            id={SECTION_IDS.car}
            n={1}
            title="Your car"
            subtitle={mode === 'package' && selectedPackage ? `The ${selectedPackage.name} price depends on your car and fuel.` : undefined}
            error={sectionErrors.car}
          >
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
                          setFormError(null);
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
                        setFormError(null);
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
              <div className="space-y-4 rounded-2xl border border-surface-200 bg-surface-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[15px] font-semibold text-navy-900">
                      {carDraft?.modelName ? 'Add this car' : 'Add your car'}
                    </h3>
                    <p className="mt-0.5 text-sm text-navy-500">We save it to your profile when you continue.</p>
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

            {pricingCar && mode === 'package' && selectedPackage && !offersLoading && !selectedOffer?.price && offers && (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{packageUnavailableMessage()}</p>
            )}
          </SectionCard>

          {/* ============================ 2. SERVICE ============================ */}
          <SectionCard id={SECTION_IDS.service} n={2} title="Service" error={sectionErrors.service}>
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
                    setFormError(null);
                  }}
                  className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition ${
                    mode === key ? 'bg-white text-navy-900 shadow-card' : 'text-navy-500 hover:text-navy-800'
                  }`}
                >
                  {label}
                  {key === 'other' && categories.length > 0 && (
                    <span className="min-w-[20px] rounded-full bg-electric-600 px-1.5 text-[11px] font-bold leading-5 text-white">
                      <span className="sr-only">, </span>
                      {categories.length}
                      <span className="sr-only"> selected</span>
                    </span>
                  )}
                </button>
              ))}
            </div>

            {mode === 'package' ? (
              <div className="space-y-4">
                {offersError && <Alert type="error">{offersError}</Alert>}

                {!packages ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                  </div>
                ) : packages.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-surface-300 bg-white p-4 text-sm text-navy-500">
                    Service packages are not available right now. Choose “Other services” and garages will quote.
                  </p>
                ) : (
                  <div role="radiogroup" aria-label="Service package" className="space-y-3">
                    {packages.map((pkg) => {
                      const offer = offerFor(pkg.code);
                      const priced = !!offer && offer.price !== null;
                      return (
                        <PackageCard
                          key={pkg.code}
                          pkg={pkg}
                          offer={offer}
                          selected={packageCode.toUpperCase() === pkg.code.toUpperCase()}
                          unavailable={!!pricingCar && !!offers && !priced}
                          hasCar={!!pricingCar}
                          loadingPrice={offersLoading}
                          open={!!openIncludes[pkg.code]}
                          onToggle={() => setOpenIncludes((o) => ({ ...o, [pkg.code]: !o[pkg.code] }))}
                          onSelect={() => {
                            setPackageCode(pkg.code);
                            setFormError(null);
                          }}
                        />
                      );
                    })}
                  </div>
                )}

                {!pricingCar && !loadingVehicles && (
                  <p className="text-sm text-navy-500">
                    Prices depend on the car.{' '}
                    <button
                      type="button"
                      onClick={() => scrollToSection('car')}
                      className="font-semibold text-electric-700 underline underline-offset-2"
                    >
                      Choose your car above
                    </button>{' '}
                    to see them.
                  </p>
                )}
                {pricingCar && selectedPackage && !offersLoading && selectedOffer && selectedOffer.price !== null && (
                  <p className="text-sm text-navy-600">
                    {selectedPackage.name} for {pricingCar.manufacturerName} {pricingCar.modelName} · {pricingCar.fuelType}:{' '}
                    <strong className="tabular-nums text-navy-900">{formatINRWhole(selectedOffer.price)}</strong>, pay{' '}
                    <strong className="tabular-nums text-electric-700">{formatINRWhole(selectedOffer.advanceAmount ?? 0)}</strong> now.
                  </p>
                )}

                <Textarea
                  id="packageNotes"
                  label="Anything else the garage should know? (optional)"
                  rows={2}
                  value={packageNotes}
                  onChange={(e) => setPackageNotes(e.target.value)}
                  placeholder="e.g. Brakes squeak a little, please check."
                />
                <p className="text-xs leading-relaxed text-navy-500">
                  Need AC, tyres or a repair too? Book them under{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('other');
                      setFormError(null);
                    }}
                    className="font-semibold text-electric-700 underline underline-offset-2"
                  >
                    Other services
                  </button>{' '}
                  as a separate request. Garages quote for free.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <p id="services-label" className="text-sm font-medium text-navy-800">
                      Pick all the services you need
                    </p>
                    <span
                      aria-live="polite"
                      className={`shrink-0 text-xs font-semibold ${categories.length ? 'text-electric-700' : 'text-navy-400'}`}
                    >
                      {categories.length ? `${categories.length} selected` : 'None selected'}
                    </span>
                  </div>
                  <div role="group" aria-labelledby="services-label" className="grid grid-cols-2 gap-2">
                    {OTHER_SERVICES.map(({ name, icon: Icon }) => {
                      const selected = categories.includes(name);
                      return (
                        <button
                          key={name}
                          type="button"
                          role="checkbox"
                          aria-checked={selected}
                          onClick={() => toggleCategory(name)}
                          className={`flex min-h-[56px] items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm font-medium leading-snug transition touch-manipulation ${
                            selected
                              ? 'border-electric-600 bg-electric-50 text-electric-800 ring-1 ring-electric-600'
                              : 'border-surface-200 bg-white text-navy-700 hover:border-surface-300'
                          }`}
                        >
                          <Icon className={`h-4 w-4 shrink-0 ${selected ? 'text-electric-600' : 'text-navy-400'}`} />
                          <span className="min-w-0 flex-1">{name}</span>
                          <span
                            aria-hidden="true"
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                              selected ? 'border-electric-600 bg-electric-600 text-white' : 'border-surface-300 bg-white'
                            }`}
                          >
                            {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {serviceLimitHit && (
                    <p className="mt-2 text-sm text-amber-800" role="status">
                      That&apos;s the most we can take in one request. Book the rest as a separate request.
                    </p>
                  )}
                </div>

                <Textarea
                  id="problemDescription"
                  label="Describe the problem"
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  placeholder="e.g. AC is not cooling, and the car is slow to start in the morning."
                  rows={4}
                  helperText="Warning lights, noises, when it happens — anything helps garages quote accurately."
                  error={showErrors && problem.trim().length < 5 ? 'Describe the problem in at least 5 characters.' : undefined}
                  required
                />
                <QuoteFirstNote percent={advancePercent} />
              </div>
            )}
          </SectionCard>

          {/* ============================ 3. LOCATION ============================ */}
          <SectionCard
            id={SECTION_IDS.location}
            n={3}
            title="Where is your car?"
            subtitle={`We match you with verified garages close to this pin. We currently serve ${liveCitiesLabel(liveAreas)}.`}
            error={sectionErrors.location}
            invalid={showErrors && !locationConfirmed}
          >
            <LocationPicker value={location} onChange={handleLocationChange} serviceArea={serviceArea} showErrors={showErrors} />
          </SectionCard>

          {/* ============================ PHOTOS & DOCUMENTS (optional) ============================ */}
          <SectionCard
            id={SECTION_IDS.files}
            icon={Paperclip}
            title="Photos & documents"
            optional
            subtitle="An old quotation or bill, or photos of a dent or warning light, help garages quote accurately."
          >
            <CustomerFilesField
              id="booking-files-add"
              drafts={files}
              onChange={setFiles}
              room={CUSTOMER_FILE_LIMITS.maxFiles}
              disabled={!!busy}
            />
          </SectionCard>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ============================ 4. PICK-UP & DROP ============================ */}
          <SectionCard
            id={SECTION_IDS.pickup}
            n={4}
            title="Pick-up & drop"
            subtitle="Free in every city we serve. The garage collects your car from this location and drops it back."
            error={sectionErrors.pickup}
          >
            <div>
              <p id="pickup-label" className="mb-2 text-sm font-medium text-navy-800">
                Do you need free pick-up &amp; drop?
              </p>
              <div role="radiogroup" aria-labelledby="pickup-label" className="grid gap-2 sm:grid-cols-2">
                <ChoiceCard
                  icon={Truck}
                  title="Yes, pick up my car"
                  sub="We collect it and bring it back after the service."
                  selected={needsPickup === true}
                  onClick={() => {
                    setNeedsPickup(true);
                    setFormError(null);
                  }}
                />
                <ChoiceCard
                  icon={CarFront}
                  title="No, I'll drive to the garage"
                  sub="You drop the car at the garage yourself."
                  selected={needsPickup === false}
                  onClick={() => {
                    setNeedsPickup(false);
                    setFormError(null);
                  }}
                />
              </div>
            </div>

            {needsPickup && (
              <Textarea
                id="pickupNotes"
                label="Pick-up notes (optional)"
                rows={2}
                maxLength={PICKUP_NOTES_MAX}
                value={pickupNotes}
                onChange={(e) => setPickupNotes(e.target.value.slice(0, PICKUP_NOTES_MAX))}
                placeholder="e.g. Gate 2, call before coming"
                helperText={`Where to find the car, who to call. ${pickupNotes.length}/${PICKUP_NOTES_MAX}`}
              />
            )}

            <div>
              <p id="when-label" className="text-sm font-medium text-navy-800">
                {needsPickup ? 'When should we pick it up?' : 'When would you like the service?'}{' '}
                <span className="font-normal text-navy-400">(optional)</span>
              </p>
              <div
                role="group"
                aria-labelledby="when-label"
                className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0"
              >
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
                <div
                  className="mt-2 grid grid-cols-3 gap-2"
                  role="radiogroup"
                  aria-label={needsPickup ? 'Preferred pick-up time' : 'Preferred time'}
                >
                  {PICKUP_SLOTS.map((s) => {
                    const chosen = preferredSlot === s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        role="radio"
                        aria-checked={chosen}
                        onClick={() => setPreferredSlot(chosen ? '' : s.key)}
                        className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl border px-2 text-center transition ${
                          chosen ? 'border-electric-600 bg-electric-50 ring-1 ring-electric-600' : 'border-surface-200 bg-white'
                        }`}
                      >
                        <span className="text-sm font-semibold text-navy-900">{s.label}</span>
                        <span className="text-[11px] text-navy-500">{s.hint}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="mt-2 text-xs text-navy-400">
                {needsPickup ? 'The garage calls you to confirm the exact pick-up time.' : 'The garage confirms the exact slot with you.'}
              </p>
            </div>
          </SectionCard>

          {/* ============================ 5. REVIEW & PAY ============================ */}
          <SectionCard
            id={SECTION_IDS.review}
            n={5}
            title="Review your booking"
            subtitle="Tap Edit to change anything. Nothing you entered is lost."
            flush
          >
            <div className="divide-y divide-surface-200 rounded-2xl border border-surface-200 bg-white">
              <ReviewBlock title="Car" onEdit={() => goToDetails('car')} disabled={!!busy}>
                {carSummary ? (
                  <div className="flex items-center gap-2.5">
                    <BrandLogo name={carSummary.brand} logoUrl={carSummary.logo} size={32} />
                    <div className="min-w-0">
                      <div className="font-semibold text-navy-900">{carSummary.name}</div>
                      <div className="font-mono text-xs text-navy-500">{carSummary.plate}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-navy-500">No car chosen yet</div>
                )}
              </ReviewBlock>
              <ReviewBlock title={mode === 'other' && categories.length > 1 ? `Services (${categories.length})` : 'Service'} onEdit={() => goToDetails('service')} disabled={!!busy}>
                {mode === 'package' ? (
                  selectedPackage ? (
                    <>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold text-navy-900">{selectedPackage.name}</span>
                        {servicePrice !== null && (
                          <span className="shrink-0 font-semibold tabular-nums text-navy-900">{formatINRWhole(servicePrice)}</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-navy-500">Fixed price for your car · no quotes needed</div>
                      {packageNotes.trim() && <p className="mt-1.5 whitespace-pre-wrap break-words text-navy-600">{packageNotes.trim()}</p>}
                    </>
                  ) : (
                    <div className="text-navy-500">No package chosen yet</div>
                  )
                ) : categories.length > 0 ? (
                  <>
                    <ul className="flex flex-wrap gap-1.5" aria-label={`${categories.length} services`}>
                      {categories.map((c) => (
                        <li
                          key={c}
                          className="rounded-full border border-electric-200 bg-electric-50 px-2.5 py-1 text-xs font-semibold text-electric-800"
                        >
                          {c}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-1.5 text-xs text-navy-500">Price: garages send quotes</div>
                    {problem.trim() && <p className="mt-1.5 whitespace-pre-wrap break-words text-navy-600">{problem.trim()}</p>}
                  </>
                ) : (
                  <div className="text-navy-500">No services chosen yet</div>
                )}
              </ReviewBlock>
              <ReviewBlock title="Car location" onEdit={() => goToDetails('location')} disabled={!!busy}>
                {locationConfirmed ? (
                  <>
                    <div className="break-words text-navy-900">{formatLocationDraft(location)}</div>
                    <div className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Pin and address match
                    </div>
                  </>
                ) : (
                  <div className="text-navy-500">Pin and address not confirmed yet</div>
                )}
              </ReviewBlock>
              {filesToSend.length > 0 && (
                <ReviewBlock title="Photos & documents" onEdit={() => goToDetails('files')} disabled={!!busy}>
                  <FilesSummary files={filesToSend} />
                </ReviewBlock>
              )}
              <ReviewBlock title="Pick-up & drop" onEdit={() => scrollToSection('pickup')} disabled={!!busy}>
                {needsPickup === null ? (
                  <div className="text-navy-500">Not chosen yet</div>
                ) : (
                  <div className="break-words text-navy-900">{pickupSummary}</div>
                )}
                {preferredDay && (
                  <div className="mt-1 text-xs text-navy-500">
                    {needsPickup ? 'Pick-up' : 'Preferred'}: {formatDate(preferredServiceDate)}
                    {slot && ` · ${slot.label}`}
                  </div>
                )}
              </ReviewBlock>
            </div>

            {mode === 'package' ? (
              selectedOffer && selectedOffer.price !== null ? (
                <div className="space-y-2">
                  <h3 className="px-1 text-sm font-semibold text-navy-900">Payment</h3>
                  <PriceSplit total={selectedOffer.price} advance={advance} atGarage={atGarage} percent={advancePercent} />
                  <PaymentModelNote />
                </div>
              ) : (
                <p className="px-1 text-sm text-navy-500">
                  Choose a package and your car to see the price. You pay {advancePercent}% online now and the rest at the garage.
                </p>
              )
            ) : (
              <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-electric-600 shadow-card">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-navy-900">Nothing to pay now - garages will send quotes</div>
                    <p className="mt-0.5 text-xs leading-relaxed text-navy-500">
                      Quotes are free. You pay only after you accept one: {advancePercent}% online to BroCo to confirm the
                      booking, and the rest directly at the garage after the service.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {formError && (
              <Alert type="error" onClose={() => setFormError(null)}>
                {formError}
              </Alert>
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

            {/* The Cancellation & Refund Policy requires the charge to be shown before the booking is confirmed. */}
            <p className="px-1 text-xs leading-relaxed text-navy-500">
              By booking you agree to our{' '}
              <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-electric-700 underline underline-offset-2">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/refund-policy" target="_blank" rel="noopener noreferrer" className="font-medium text-electric-700 underline underline-offset-2">
                Cancellation &amp; Refund Policy
              </Link>
              .{' '}
              {needsPickup === true
                ? 'A cancellation charge of up to 10% of the agreed service cost may apply, as pick-up & drop is arranged.'
                : needsPickup === false
                ? 'A cancellation charge of up to 7% of the agreed service cost may apply, as you visit the garage.'
                : 'Cancellation charges of up to 7% (you visit the garage) or 10% (pick-up & drop) of the agreed service cost may apply.'}
            </p>
          </SectionCard>
        </div>
      )}

      <ActionBar
        summary={
          !onReview && servicePrice !== null ? (
            <div className="leading-tight md:hidden">
              <div className="text-xs text-navy-500">{selectedPackage?.name}</div>
              <div className="text-base font-bold tabular-nums text-navy-900">{formatINRWhole(servicePrice)}</div>
            </div>
          ) : undefined
        }
      >
        {onReview ? (
          <>
            <Button variant="outline" onClick={() => goToDetails()} disabled={!!busy} className="!flex-none">
              Back
            </Button>
            <Button variant="primary" onClick={handleSubmit} isLoading={!!busy || savingCar} disabled={!!busy || savingCar}>
              {busyLabel ?? ctaLabel}
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={handleContinue} isLoading={savingCar} disabled={savingCar}>
            {savingCar ? 'Saving your car…' : 'Continue'}
          </Button>
        )}
      </ActionBar>
      <ActionBarSpacer />
    </div>
  );
}


// ---------------------------------------------------------------------------------------------
// Pieces

/** One numbered section of the page (or an optional one with an icon); its first problem is announced inside it. */
function SectionCard({
  id,
  n,
  icon: Icon,
  title,
  subtitle,
  optional = false,
  error,
  invalid,
  flush = false,
  children,
}: {
  id: string;
  n?: number;
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  optional?: boolean;
  error?: string | null;
  /** Marks the section even when its fields show the problem themselves. */
  invalid?: boolean;
  /** No card around the content (the review section holds cards of its own). */
  flush?: boolean;
  children: React.ReactNode;
}) {
  const flagged = !!error || !!invalid;
  return (
    <section
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}-title`}
      className={`scroll-mt-4 space-y-4 outline-none ${
        flush
          ? 'pt-2'
          : `rounded-2xl border bg-white p-4 shadow-card sm:p-5 ${flagged ? 'border-semantic-error/60' : 'border-surface-200'}`
      }`}
    >
      <div className={flush ? 'px-1' : undefined}>
        <h2 id={`${id}-title`} className="flex items-center gap-2.5 text-base font-semibold text-navy-900">
          <span
            aria-hidden="true"
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              flagged ? 'bg-semantic-error text-white' : n == null ? 'bg-surface-100 text-navy-600' : 'bg-navy-900 text-white'
            }`}
          >
            {n ?? (Icon ? <Icon className="h-3.5 w-3.5" /> : null)}
          </span>
          {title}
          {optional && <span className="text-sm font-normal text-navy-400">(optional)</span>}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-navy-500">{subtitle}</p>}
      </div>
      {error && <Alert type="error">{error}</Alert>}
      {children}
    </section>
  );
}

/** A package as a compact radio card: name, tagline and price; the rest behind "What's included". */
function PackageCard({
  pkg,
  offer,
  selected,
  unavailable,
  hasCar,
  loadingPrice,
  open,
  onToggle,
  onSelect,
}: {
  pkg: ServicePackage;
  offer: PackageOffer | null;
  selected: boolean;
  unavailable: boolean;
  hasCar: boolean;
  loadingPrice: boolean;
  open: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const priced = !!offer && offer.price !== null;
  const includes = offer?.package.includes ?? pkg.includes ?? [];
  const detailsId = `pkg-details-${pkg.code}`;
  return (
    <div
      className={`rounded-2xl border bg-white transition ${
        selected ? 'border-electric-600 ring-2 ring-electric-600/20' : 'border-surface-200'
      } ${unavailable ? 'opacity-60' : ''}`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={unavailable}
        onClick={onSelect}
        className="flex w-full items-center gap-3 p-4 text-left disabled:cursor-not-allowed"
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
            selected ? 'border-electric-600 bg-electric-600' : 'border-surface-300'
          }`}
          aria-hidden="true"
        >
          {selected && <span className="h-2 w-2 rounded-full bg-white" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[15px] font-semibold text-navy-900">{pkg.name}</span>
            {pkg.isRecommended && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Most booked</span>
            )}
          </span>
          {pkg.tagline && <span className="mt-0.5 block truncate text-sm text-navy-500">{pkg.tagline}</span>}
        </span>
        <span className="shrink-0 text-right">
          {!hasCar ? (
            <span className="text-xs text-navy-400">Select car</span>
          ) : loadingPrice ? (
            <Skeleton className="h-5 w-16" />
          ) : priced ? (
            <>
              <span className="block text-base font-bold tabular-nums text-navy-900">{formatINRWhole(offer!.price!)}</span>
              <span className="block text-[11px] text-electric-700">{formatINRWhole(offer!.advanceAmount ?? 0)} now</span>
            </>
          ) : (
            <span className="text-xs text-navy-400">Not available</span>
          )}
        </span>
      </button>
      <div className="border-t border-surface-100 px-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={detailsId}
          className="flex min-h-[40px] w-full items-center justify-between gap-2 text-left text-sm font-semibold text-electric-700"
        >
          What&apos;s included
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        {open && (
          <div id={detailsId} className="pb-4">
            <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-navy-500">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {formatHours(pkg.durationHours)}
              </span>
              <span aria-hidden="true">·</span>
              <span>Every {pkg.intervalKm.toLocaleString('en-IN')} km</span>
              {pkg.warrantyDays > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{pkg.warrantyDays}-day warranty</span>
                </>
              )}
            </p>
            {includes.length > 0 ? (
              <PackageIncludes includes={includes} compact collapsedGroups={0} />
            ) : (
              <p className="text-sm text-navy-500">The garage shares the full checklist with you.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Yes / No card for the pick-up question. */
function ChoiceCard({
  icon: Icon,
  title,
  sub,
  selected,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  sub: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex min-h-[64px] items-center gap-3 rounded-xl border p-3 text-left transition touch-manipulation ${
        selected ? 'border-electric-600 bg-electric-50 ring-1 ring-electric-600' : 'border-surface-200 bg-white hover:border-surface-300'
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          selected ? 'bg-electric-600 text-white' : 'bg-surface-100 text-navy-500'
        }`}
        aria-hidden="true"
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-navy-900">{title}</span>
        <span className="block text-xs text-navy-500">{sub}</span>
      </span>
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
          selected ? 'border-electric-600 bg-electric-600' : 'border-surface-300'
        }`}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-white" />}
      </span>
    </button>
  );
}

/** Quote-based services: free quotes, and nothing is paid until the customer accepts one. */
function QuoteFirstNote({ percent }: { percent: number }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-surface-50 p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-electric-600 shadow-card">
        <FileText className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-navy-900">Free quotes · pay only after you accept</div>
        <p className="mt-0.5 text-xs leading-relaxed text-navy-500">
          Verified garages near you quote for all the services you pick. Nothing is charged now. Once you accept a quote you
          pay {percent}% online to confirm, and the rest at the garage after the service.
        </p>
      </div>
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

/** "Step 1 of 2" with two bars. The heading is focused when the step changes, for screen readers. */
function StepIndicator({ step, headingRef }: { step: 1 | 2; headingRef: React.RefObject<HTMLHeadingElement> }) {
  const steps = ['Car, service & location', 'Pick-up & review'];
  return (
    <nav aria-label="Booking steps" className="mb-4">
      <h2 ref={headingRef} tabIndex={-1} className="sr-only outline-none">
        Step {step} of 2: {steps[step - 1]}
      </h2>
      <ol className="grid grid-cols-2 gap-2">
        {steps.map((label, i) => {
          const n = i + 1;
          const state = n < step ? 'done' : n === step ? 'current' : 'upcoming';
          return (
            <li key={label} aria-current={state === 'current' ? 'step' : undefined}>
              <div className={`h-1.5 rounded-full ${state === 'upcoming' ? 'bg-surface-200' : 'bg-electric-600'}`} />
              <div className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${state === 'upcoming' ? 'text-navy-400' : 'text-navy-800'}`}>
                {state === 'done' && <Check className="h-3.5 w-3.5 text-electric-600" strokeWidth={3} aria-hidden="true" />}
                <span className="truncate">
                  <span className="sr-only">{state === 'done' ? 'Done: ' : state === 'current' ? 'Current: ' : 'Next: '}</span>
                  {n}. {label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Files on the review screen: names, and progress while they upload after the booking is created. */
function FilesSummary({ files }: { files: CustomerFileDraft[] }) {
  return (
    <ul className="space-y-1.5" aria-label={`${files.length} ${files.length === 1 ? 'file' : 'files'}`}>
      {files.map((f) => (
        <li key={f.key} className="flex items-center gap-2 text-navy-900">
          {f.kind === 'Document' ? (
            <FileText className="h-4 w-4 shrink-0 text-electric-600" aria-hidden="true" />
          ) : (
            <ImageIcon className="h-4 w-4 shrink-0 text-electric-600" aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1 truncate">{f.caption.trim() || f.file.name}</span>
          {f.status === 'uploading' && <span className="shrink-0 text-xs tabular-nums text-navy-500">{Math.round(f.progress * 100)}%</span>}
          {f.status === 'done' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Uploaded" />}
          {f.status === 'error' && <AlertCircle className="h-4 w-4 shrink-0 text-semantic-error" aria-label="Not uploaded" />}
        </li>
      ))}
    </ul>
  );
}
