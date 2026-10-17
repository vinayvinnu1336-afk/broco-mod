'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Car, Check, ChevronRight, HandCoins, MapPin, Smartphone, Store } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Alert } from '@/components/ui/Alert';
import { INVALID_MOBILE_MESSAGE, isValidIndianMobile, toIndianMobile } from '@/lib/phone';
import { PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT } from '@/lib/password';
import { liveCitiesLabel } from '@/components/location/serviceArea';
import {
  CONSENT_REQUIRED,
  LegalConsent,
  NewPasswordInput,
  PolicyLink,
  SignupShell,
  signupErrorMessage,
} from '../_components/signup';

const BENEFITS = [
  { icon: MapPin, title: 'Jobs near your workshop', desc: 'Service requests from car owners within 10 km' },
  { icon: HandCoins, title: 'Get paid at handover', desc: 'Customers pay you directly when they collect the car' },
  { icon: Smartphone, title: 'Free garage dashboard', desc: 'Quotes, jobs and payments on your phone' },
];

/** Garage partner sign-up: the owner's account plus a new garage that goes live after verification. */
export function GarageSignup() {
  const router = useRouter();
  const { register } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const phoneRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [garageName, setGarageName] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [consentError, setConsentError] = useState<string | undefined>();
  const consentRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const captureLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationError('Location is not available on this device. Our team will set it during verification.');
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocationError('We couldn’t get your location. Allow location access, or skip this and our team will set it.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !email.trim() || !phoneNumber.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!isValidIndianMobile(phoneNumber)) {
      setPhoneError(INVALID_MOBILE_MESSAGE);
      phoneRef.current?.focus();
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(PASSWORD_TOO_SHORT);
      return;
    }
    if (!garageName.trim() || !address.trim()) {
      setError('Please add your garage name and address.');
      return;
    }
    if (!agreed) {
      setConsentError(CONSENT_REQUIRED);
      consentRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const res = await register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phoneNumber: toIndianMobile(phoneNumber),
        role: 'GARAGE_OWNER',
        garageName: garageName.trim(),
        address: address.trim(),
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      });

      if (!res.success) {
        if (res.fieldErrors?.phoneNumber) {
          setPhoneError(res.fieldErrors.phoneNumber);
          phoneRef.current?.focus();
        } else {
          setError(signupErrorMessage(res.error, email.trim()));
        }
        setSubmitting(false);
        return;
      }

      router.push('/garage/dashboard');
    } catch (err: unknown) {
      console.error('Garage registration exception:', err);
      setError('We couldn’t register your garage right now. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <SignupShell wide>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:items-start lg:gap-8">
        {/* Laptops: the partner pitch sits beside the form. */}
        <aside
          aria-labelledby="partner-pitch-title"
          className="relative hidden overflow-hidden rounded-3xl bg-navy-950 p-8 text-white shadow-elevated lg:sticky lg:top-8 lg:block"
        >
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-electric-600/30 blur-2xl" />
          <p className="relative inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-300">
            <Store className="h-4 w-4" aria-hidden /> BroCo for garages
          </p>
          <h2 id="partner-pitch-title" className="relative mt-2 text-3xl font-extrabold leading-tight tracking-tight">
            Grow your workshop with BroCo
          </h2>
          <p className="relative mt-2 text-sm leading-relaxed text-white/75">
            Car owners book service on BroCo. We send the jobs to verified garages close to them.
          </p>
          <ul className="relative mt-6 space-y-4">
            {BENEFITS.map((b) => (
              <li key={b.title} className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sky-300">
                  <b.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold">{b.title}</span>
                  <span className="block text-sm text-white/70">{b.desc}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="relative mt-8 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/85">
            <MapPin className="h-3.5 w-3.5" aria-hidden /> Now live in {liveCitiesLabel()}
          </p>
        </aside>

        <div className="min-w-0">
          <div className="rounded-3xl border border-surface-200 bg-white p-5 shadow-elevated sm:p-8">
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-electric-600 lg:hidden">
              <Store className="h-4 w-4" aria-hidden /> BroCo for garages
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900 lg:mt-0">Register your garage</h1>
            <p className="mt-1 text-sm text-navy-500">Get service jobs from car owners near your workshop.</p>

            {/* Phones and tablets: the pitch, short. */}
            <ul className="mt-4 grid grid-cols-1 gap-2 rounded-2xl bg-surface-50 p-3 text-sm text-navy-700 sm:grid-cols-2 lg:hidden">
              {BENEFITS.map((b) => (
                <li key={b.title} className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  <span className="min-w-0">{b.title}</span>
                </li>
              ))}
            </ul>

            {error && (
              <Alert type="error" onClose={() => setError(null)} className="mt-4">
                {error}
              </Alert>
            )}

            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              <Input
                id="fullName"
                label="Full name"
                autoComplete="name"
                autoCapitalize="words"
                placeholder="Garage owner’s name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />

              <Input
                id="email"
                label="Email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="you@yourgarage.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <PhoneInput
                ref={phoneRef}
                id="phoneNumber"
                name="phoneNumber"
                label="Mobile number"
                value={phoneNumber}
                onChange={(digits) => {
                  setPhoneNumber(digits);
                  setPhoneError(undefined);
                }}
                error={phoneError}
                helperText="We’ll use this to reach you about your garage and new jobs."
                required
              />

              <NewPasswordInput value={password} onChange={setPassword} />

              <fieldset className="space-y-4 rounded-2xl border border-surface-200 bg-surface-50 p-4">
                <legend className="px-1 text-sm font-semibold text-navy-800">Your garage</legend>
                <Input
                  id="garageName"
                  label="Garage or workshop name"
                  autoComplete="organization"
                  placeholder="e.g. Sharma Auto Works"
                  value={garageName}
                  onChange={(e) => setGarageName(e.target.value)}
                  required
                />
                <Input
                  id="address"
                  label="Workshop address"
                  autoComplete="street-address"
                  placeholder="Street, area, city, PIN code"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />
                <div>
                  <Button
                    type="button"
                    variant={coords ? 'outline' : 'secondary'}
                    className="w-full"
                    leftIcon={coords ? <Check className="h-4 w-4 text-emerald-600" /> : <MapPin className="h-4 w-4" />}
                    isLoading={locating}
                    onClick={captureLocation}
                  >
                    {coords ? 'Workshop location saved' : 'Use my current location'}
                  </Button>
                  <p className="mt-1.5 text-xs text-navy-500">
                    {locationError ??
                      'Tap this while you are at the workshop. We send you requests from car owners within 10 km of it.'}
                  </p>
                </div>
              </fieldset>

              <p className="text-xs leading-relaxed text-navy-500">
                Your garage goes live after our team verifies it.
              </p>

              <LegalConsent
                ref={consentRef}
                id="acceptPartnerTerms"
                checked={agreed}
                onChange={(v) => {
                  setAgreed(v);
                  if (v) setConsentError(undefined);
                }}
                error={consentError}
              >
                I agree to the <PolicyLink href="/garage-terms">Garage Partner Terms &amp; Conditions</PolicyLink> and the{' '}
                <PolicyLink href="/privacy">Privacy Policy</PolicyLink>
              </LegalConsent>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={submitting}
                rightIcon={<ArrowRight className="h-5 w-5" />}
              >
                {submitting ? 'Registering…' : 'Register garage'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-navy-500">
              Already a BroCo partner?{' '}
              <Link href="/login" className="font-semibold text-electric-600 hover:text-electric-700 hover:underline">
                Sign in
              </Link>
            </p>
          </div>

          <Link
            href="/register"
            className="mt-4 flex min-h-[64px] items-center gap-3 rounded-2xl border border-surface-200 bg-white px-4 py-3 shadow-card transition hover:border-electric-200"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-electric-50 text-electric-600">
              <Car className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-navy-900">Looking to book a service?</span>
              <span className="block text-xs text-navy-500">Sign up as a customer</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-navy-400" aria-hidden />
          </Link>
        </div>
      </div>
    </SignupShell>
  );
}
