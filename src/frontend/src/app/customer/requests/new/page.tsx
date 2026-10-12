'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { isDemoMode } from '@/lib/demo';
import { ServiceRequestDetailDto } from '@/types/serviceRequest';
import {
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LocateFixed,
  MapPin,
  Plus,
  Send,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ActionBar, ActionBarSpacer } from '@/components/ui/ActionBar';
import { formatDate } from '@/lib/format';

const CATEGORIES = [
  'Periodic Service',
  'Brakes & Suspension',
  'Engine & Performance',
  'Transmission & Clutch',
  'Electrical & Diagnostics',
  'Air Conditioning',
  'Bodywork & Paint',
  'General Inspection',
];

// One-tap test locations, only offered in demo/development builds.
const DEMO_LOCATIONS = [
  { name: 'MG Road', address: '100 MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001', lat: 12.9716, lng: 77.5946 },
  { name: 'Indiranagar', address: '450 100ft Road, Indiranagar', city: 'Bengaluru', state: 'Karnataka', pincode: '560038', lat: 12.9784, lng: 77.6408 },
  { name: 'Koramangala', address: '12 80ft Road, Koramangala 5th Block', city: 'Bengaluru', state: 'Karnataka', pincode: '560095', lat: 12.9352, lng: 77.6245 },
  { name: 'Whitefield', address: '77 ITPL Main Road, Whitefield', city: 'Bengaluru', state: 'Karnataka', pincode: '560066', lat: 12.9698, lng: 77.7499 },
];

const STEPS = ['Vehicle', 'Location', 'Problem', 'Review'] as const;
const SUCCESS_STEP = STEPS.length + 1;

/** Shape returned by GET /customer/vehicles. Older builds used manufacturerName/modelName. */
interface BookingVehicle {
  id: string;
  make?: string;
  model?: string;
  manufacturerName?: string;
  modelName?: string;
  variantName?: string | null;
  year: number;
  fuelType?: string;
  transmission?: string;
  licensePlate: string;
  isPrimary: boolean;
}

function vehicleTitle(v: BookingVehicle) {
  return [v.year, v.make ?? v.manufacturerName, v.model ?? v.modelName].filter(Boolean).join(' ');
}

export default function NewServiceBookingPage() {
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Vehicles from API
  const [vehicles, setVehicles] = useState<BookingVehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');

  // Location
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [country] = useState('India');
  const [latitude, setLatitude] = useState<number>(12.9716);
  const [longitude, setLongitude] = useState<number>(77.5946);
  const [locationPinned, setLocationPinned] = useState(false);
  const [locating, setLocating] = useState(false);

  // Problem
  const [serviceCategory, setServiceCategory] = useState<string>('Periodic Service');
  const [problemDescription, setProblemDescription] = useState<string>('');
  const [preferredDate, setPreferredDate] = useState<string>('');

  // Submission
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdRequest, setCreatedRequest] = useState<ServiceRequestDetailDto | null>(null);

  useEffect(() => {
    async function loadVehicles() {
      try {
        const res = await apiFetch<BookingVehicle[]>('/customer/vehicles');
        if (res.success && res.data && res.data.length > 0) {
          setVehicles(res.data);
          const primary = res.data.find((v) => v.isPrimary) || res.data[0];
          setSelectedVehicleId(primary.id);
        }
      } catch (err) {
        console.error('Error fetching vehicles:', err);
      } finally {
        setLoadingVehicles(false);
      }
    }
    loadVehicles();
  }, []);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? null;

  const goToStep = (step: number) => {
    setCurrentStep(step);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDetectLocation = () => {
    setErrorMsg(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setErrorMsg('Your browser cannot share your location. Please enter your address below.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(parseFloat(pos.coords.latitude.toFixed(6)));
        setLongitude(parseFloat(pos.coords.longitude.toFixed(6)));
        setLocationPinned(true);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setErrorMsg('Location permission was denied. Please enter your address below.');
      }
    );
  };

  const handleApplyPreset = (preset: (typeof DEMO_LOCATIONS)[number]) => {
    setAddressLine1(preset.address);
    setCity(preset.city);
    setState(preset.state);
    setPincode(preset.pincode);
    setLatitude(preset.lat);
    setLongitude(preset.lng);
    setLocationPinned(true);
  };

  const validateCurrentStep = (): boolean => {
    setErrorMsg(null);
    if (currentStep === 1) {
      if (!selectedVehicleId && vehicles.length === 0) {
        setErrorMsg('Add your vehicle before booking a service.');
        return false;
      }
      if (!selectedVehicleId) {
        setErrorMsg('Choose the vehicle that needs service.');
        return false;
      }
      return true;
    }
    if (currentStep === 2) {
      // Garages are matched by distance, so a real position is required; never fall back to a default city point.
      if (!locationPinned) {
        setErrorMsg('Tap “Use my current location” so we can find garages near your car. If you blocked location access, allow it in your browser settings and try again.');
        return false;
      }
      if (!addressLine1.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
        setErrorMsg('Please complete all location fields.');
        return false;
      }
      return true;
    }
    if (currentStep === 3) {
      if (!problemDescription.trim() || problemDescription.trim().length < 5) {
        setErrorMsg('Please describe the problem in at least 5 characters.');
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      goToStep(Math.min(currentStep + 1, STEPS.length));
    }
  };

  const handleBack = () => {
    setErrorMsg(null);
    goToStep(Math.max(currentStep - 1, 1));
  };

  const handleSubmitBooking = async () => {
    setSubmitting(true);
    setErrorMsg(null);

    let effectiveVehicleId = selectedVehicleId;
    if (!effectiveVehicleId && vehicles.length > 0) {
      effectiveVehicleId = vehicles[0].id;
    }

    const idempotencyKey = `bm-req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const payload = {
      vehicleId: effectiveVehicleId,
      addressLine1,
      addressLine2: addressLine2 || null,
      city,
      state,
      pincode,
      country,
      latitude,
      longitude,
      problemDescription,
      serviceCategory,
      preferredServiceDate: preferredDate ? new Date(preferredDate).toISOString() : null,
    };

    try {
      const res = await apiFetch<ServiceRequestDetailDto>('/customer/requests', {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      if (res.success && res.data) {
        setCreatedRequest(res.data);
        goToStep(SUCCESS_STEP);
      } else {
        setErrorMsg(res.message || 'Unable to submit service request. Please check details and try again.');
      }
    } catch {
      setErrorMsg('Unable to submit service request right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Success ----------
  if (currentStep === SUCCESS_STEP) {
    return (
      <div className="mx-auto max-w-xl space-y-5 sm:space-y-6">
        <div className="rounded-2xl border border-surface-200 bg-white p-5 text-center shadow-card sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-[22px] font-bold leading-7 text-navy-900">Request sent</h1>
          <p className="mx-auto mt-1 max-w-sm text-sm text-navy-500">
            Garages near you will be asked to quote. We will let you know when your quote is ready to review.
          </p>

          {createdRequest && (
            <dl className="mt-5 divide-y divide-surface-200 rounded-xl border border-surface-200 bg-surface-50 px-4 text-left">
              <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <dt className="text-navy-500">Request</dt>
                <dd className="font-mono font-semibold text-navy-900">{createdRequest.requestNumber}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <dt className="text-navy-500">Vehicle</dt>
                <dd className="min-w-0 truncate text-right font-medium text-navy-900">{createdRequest.vehicleSummary}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <dt className="text-navy-500">Status</dt>
                <dd>
                  <StatusBadge status={createdRequest.status} />
                </dd>
              </div>
            </dl>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {createdRequest && (
              <Link href={`/customer/requests/${createdRequest.id}`} className="w-full sm:w-auto">
                <Button variant="primary" className="w-full">
                  Track this request
                </Button>
              </Link>
            )}
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

  const stepLabel = STEPS[currentStep - 1];
  const isReview = currentStep === STEPS.length;
  const noVehicles = !loadingVehicles && vehicles.length === 0;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Book a service" backHref="/customer/requests" backLabel="My requests" />

      {/* Progress */}
      <nav aria-label="Booking progress" className="mb-5">
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="font-semibold text-navy-900">{stepLabel}</span>
          <span className="text-navy-500">
            Step {currentStep} of {STEPS.length}
          </span>
        </div>
        <ol className="flex gap-1.5">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const done = n < currentStep;
            const active = n === currentStep;
            return (
              <li key={label} className="flex-1">
                <button
                  type="button"
                  onClick={() => done && goToStep(n)}
                  disabled={!done}
                  aria-label={`${label}${done ? ' (completed, go back)' : active ? ' (current)' : ''}`}
                  aria-current={active ? 'step' : undefined}
                  className="flex w-full py-2 disabled:cursor-default"
                >
                  <span
                    className={`h-1.5 w-full rounded-full transition-colors ${
                      done || active ? 'bg-electric-600' : 'bg-surface-200'
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {errorMsg && (
        <Alert type="error" onClose={() => setErrorMsg(null)} className="mb-4">
          {errorMsg}
        </Alert>
      )}

      {/* STEP 1: VEHICLE */}
      {currentStep === 1 && (
        <section className="space-y-4" aria-labelledby="step-vehicle">
          <div>
            <h2 id="step-vehicle" className="text-base font-semibold text-navy-900">
              Which car needs service?
            </h2>
            <p className="mt-0.5 text-sm text-navy-500">Choose one of your saved vehicles.</p>
          </div>

          {loadingVehicles ? (
            <div className="space-y-3">
              <Skeleton className="h-[76px]" />
              <Skeleton className="h-[76px]" />
            </div>
          ) : noVehicles ? (
            <div className="rounded-2xl border border-dashed border-surface-300 bg-white p-5 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-100 text-navy-400">
                <Car className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-navy-900">Add your vehicle first</h3>
              <p className="mx-auto mt-1 max-w-xs text-sm text-navy-500">
                We need your car&apos;s make, model and number plate so garages can quote accurately.
              </p>
              <Link href="/customer/vehicles" className="mt-4 inline-block">
                <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
                  Add vehicle
                </Button>
              </Link>
            </div>
          ) : (
            <div role="radiogroup" aria-label="Vehicle" className="space-y-3">
              {vehicles.map((v) => {
                const selected = selectedVehicleId === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSelectedVehicleId(v.id)}
                    className={`flex min-h-[76px] w-full items-center gap-3 rounded-2xl border bg-white p-4 text-left transition touch-manipulation ${
                      selected
                        ? 'border-electric-600 ring-2 ring-electric-600/20'
                        : 'border-surface-200 hover:border-surface-300'
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        selected ? 'bg-electric-600 text-white' : 'bg-surface-100 text-navy-500'
                      }`}
                    >
                      <Car className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-navy-900">{vehicleTitle(v)}</span>
                      <span className="mt-0.5 block truncate text-sm text-navy-500">
                        {[v.licensePlate, v.variantName].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    {v.isPrimary && (
                      <span className="shrink-0 rounded-full bg-surface-100 px-2 py-0.5 text-xs font-medium text-navy-600">
                        Primary
                      </span>
                    )}
                    {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-electric-600" aria-hidden="true" />}
                  </button>
                );
              })}
              <Link
                href="/customer/vehicles"
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl text-sm font-medium text-electric-600 hover:text-electric-700"
              >
                <Plus className="h-4 w-4" />
                Add another vehicle
              </Link>
            </div>
          )}
        </section>
      )}

      {/* STEP 2: LOCATION */}
      {currentStep === 2 && (
        <section className="space-y-4" aria-labelledby="step-location">
          <div>
            <h2 id="step-location" className="text-base font-semibold text-navy-900">
              Where is the car?
            </h2>
            <p className="mt-0.5 text-sm text-navy-500">We match you with garages close to this location.</p>
          </div>

          <button
            type="button"
            onClick={handleDetectLocation}
            disabled={locating}
            className={`flex min-h-[56px] w-full items-center gap-3 rounded-2xl border p-4 text-left transition touch-manipulation ${
              locationPinned
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-surface-200 bg-white hover:border-surface-300'
            }`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                locationPinned ? 'bg-emerald-100 text-emerald-700' : 'bg-electric-50 text-electric-600'
              }`}
            >
              {locating ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-navy-900">
                {locating ? 'Finding your location…' : locationPinned ? 'Location pinned' : 'Use my current location'}
              </span>
              <span className="mt-0.5 block text-sm text-navy-500">
                {locationPinned
                  ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)} · tap to update`
                  : 'Most accurate way to find garages near you'}
              </span>
            </span>
          </button>

          {isDemoMode && (
            <div>
              <div className="mb-2 text-sm font-medium text-navy-700">Demo locations</div>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0">
                {DEMO_LOCATIONS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className={`inline-flex min-h-[36px] shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition ${
                      addressLine1 === p.address
                        ? 'border-navy-900 bg-navy-900 text-white'
                        : 'border-surface-200 bg-white text-navy-600 hover:border-surface-300'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4 rounded-2xl border border-surface-200 bg-white p-4 shadow-card sm:p-5">
            <Input
              id="addressLine1"
              label="Address"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="House / building, street"
              autoComplete="address-line1"
              leftIcon={<MapPin className="h-4 w-4" />}
              required
            />
            <Input
              id="addressLine2"
              label="Landmark or area (optional)"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="Apartment, area, landmark"
              autoComplete="address-line2"
            />
            <Input
              id="city"
              label="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              autoComplete="address-level2"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                id="state"
                label="State"
                value={state}
                onChange={(e) => setState(e.target.value)}
                autoComplete="address-level1"
                required
              />
              <Input
                id="pincode"
                label="Pincode"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                inputMode="numeric"
                autoComplete="postal-code"
                required
              />
            </div>
          </div>
        </section>
      )}

      {/* STEP 3: PROBLEM */}
      {currentStep === 3 && (
        <section className="space-y-5" aria-labelledby="step-problem">
          <div>
            <h2 id="step-problem" className="text-base font-semibold text-navy-900">
              What does the car need?
            </h2>
            <p className="mt-0.5 text-sm text-navy-500">Pick the closest match and describe what you notice.</p>
          </div>

          <div role="radiogroup" aria-label="Service category" className="grid grid-cols-2 gap-2.5">
            {CATEGORIES.map((cat) => {
              const selected = serviceCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setServiceCategory(cat)}
                  className={`flex min-h-[56px] items-center rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium leading-snug transition touch-manipulation ${
                    selected
                      ? 'border-electric-600 bg-electric-50 text-electric-800 ring-1 ring-electric-600'
                      : 'border-surface-200 bg-white text-navy-700 hover:border-surface-300'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <Textarea
            id="problemDescription"
            label="Describe the problem"
            value={problemDescription}
            onChange={(e) => setProblemDescription(e.target.value)}
            placeholder="e.g. Squeaking from the front right wheel when braking. Oil service is also due."
            rows={5}
            helperText="Warning lights, noises, when it happens — anything helps garages quote accurately."
            required
          />

          <Input
            id="preferredDate"
            label="Preferred date (optional)"
            type="date"
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
        </section>
      )}

      {/* STEP 4: REVIEW */}
      {isReview && (
        <section className="space-y-4" aria-labelledby="step-review">
          <div>
            <h2 id="step-review" className="text-base font-semibold text-navy-900">
              Check and send
            </h2>
            <p className="mt-0.5 text-sm text-navy-500">
              You are not paying anything now. You will get one price to accept or decline.
            </p>
          </div>

          <div className="divide-y divide-surface-200 rounded-2xl border border-surface-200 bg-white shadow-card">
            <ReviewBlock title="Vehicle" onEdit={() => goToStep(1)}>
              {selectedVehicle ? (
                <>
                  <div className="font-semibold text-navy-900">{vehicleTitle(selectedVehicle)}</div>
                  <div className="text-navy-500">
                    {[selectedVehicle.licensePlate, selectedVehicle.variantName].filter(Boolean).join(' · ')}
                  </div>
                </>
              ) : (
                <div className="text-navy-500">No vehicle selected</div>
              )}
            </ReviewBlock>

            <ReviewBlock title="Location" onEdit={() => goToStep(2)}>
              <div className="font-semibold text-navy-900">{addressLine1}</div>
              {addressLine2 && <div className="text-navy-600">{addressLine2}</div>}
              <div className="text-navy-500">
                {city}, {state} {pincode}
              </div>
              {locationPinned && <div className="mt-1 text-xs text-emerald-700">Pinned to your location</div>}
            </ReviewBlock>

            <ReviewBlock title="Service" onEdit={() => goToStep(3)}>
              <div className="font-semibold text-navy-900">{serviceCategory}</div>
              <p className="mt-0.5 whitespace-pre-wrap text-navy-600">{problemDescription}</p>
              {preferredDate && (
                <div className="mt-1 text-navy-500">Preferred date: {formatDate(preferredDate)}</div>
              )}
            </ReviewBlock>
          </div>
        </section>
      )}

      <ActionBar>
        {currentStep > 1 && (
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={submitting}
            leftIcon={<ChevronLeft className="h-4 w-4" />}
          >
            Back
          </Button>
        )}
        {isReview ? (
          <Button
            variant="primary"
            onClick={handleSubmitBooking}
            isLoading={submitting}
            rightIcon={<Send className="h-4 w-4" />}
          >
            {submitting ? 'Sending…' : 'Send request'}
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={handleNext}
            disabled={currentStep === 1 && (loadingVehicles || noVehicles)}
            rightIcon={<ChevronRight className="h-4 w-4" />}
          >
            Continue
          </Button>
        )}
      </ActionBar>
      <ActionBarSpacer />
    </div>
  );
}

function ReviewBlock({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 p-4 text-sm">
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-xs font-medium text-navy-400">{title}</div>
        {children}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="-mr-2 -mt-1 min-h-[44px] shrink-0 rounded-lg px-2 text-sm font-medium text-electric-600 hover:text-electric-700"
        aria-label={`Edit ${title.toLowerCase()}`}
      >
        Edit
      </button>
    </div>
  );
}
