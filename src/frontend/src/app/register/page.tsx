'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Wrench, ArrowRight, Eye, EyeOff, Car, Store } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';

type Role = 'CUSTOMER' | 'GARAGE_OWNER';

/** Only allow same-origin relative paths so `?redirect=` can't send users to another site. */
function safeRedirect(value: string | null): string {
  if (!value) return '';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '';
  return value;
}

const roleOptions: { value: Role; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'CUSTOMER', label: 'Car owner', hint: 'Book a service', icon: Car },
  { value: 'GARAGE_OWNER', label: 'Garage', hint: 'Get jobs nearby', icon: Store },
];

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeRedirect(searchParams.get('redirect'));
  const initialRole: Role = searchParams.get('role')?.toLowerCase() === 'garage' ? 'GARAGE_OWNER' : 'CUSTOMER';

  const { register } = useAuth();

  const [role, setRole] = useState<Role>(initialRole);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [garageName, setGarageName] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !email.trim() || !phoneNumber.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (role === 'GARAGE_OWNER' && (!garageName.trim() || !address.trim())) {
      setError('Please add your garage name and address.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        role,
        garageName: role === 'GARAGE_OWNER' ? garageName.trim() : undefined,
        address: role === 'GARAGE_OWNER' ? address.trim() : undefined,
      });

      if (!res.success) {
        const rawErr = res.error || '';
        const lower = rawErr.toLowerCase();
        if (lower.includes('already exists')) {
          setError(`An account with ${email.trim()} already exists. Sign in instead.`);
        } else if (lower.includes('failed to fetch') || lower.includes('network')) {
          setError('We can’t reach the server. Check your connection and try again.');
        } else if (rawErr && rawErr.length < 100 && !rawErr.includes('Exception')) {
          setError(rawErr);
        } else {
          setError('We couldn’t create your account right now. Please try again.');
        }
        setSubmitting(false);
        return;
      }

      if (role === 'GARAGE_OWNER') {
        router.push('/garage/dashboard');
      } else {
        // e.g. "Book a service" on the landing page sends new customers here with ?redirect=/customer/requests/new
        router.push(redirect.startsWith('/customer/') ? redirect : '/customer/dashboard');
      }
    } catch (err: unknown) {
      console.error('Registration exception:', err);
      setError('We couldn’t create your account right now. Please try again.');
      setSubmitting(false);
    }
  };

  const isGarage = role === 'GARAGE_OWNER';

  return (
    <div className="flex min-h-screen flex-col bg-surface-50">
      <header className="pt-safe">
        <div className="mx-auto flex h-14 max-w-md items-center px-4 sm:h-16">
          <Link href="/" className="flex items-center gap-2.5" aria-label="BroCo Mod home">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-electric-600 text-white shadow-md shadow-electric-600/30">
              <Wrench className="h-[18px] w-[18px]" />
            </span>
            <span className="text-[15px] font-extrabold tracking-tight text-navy-900 sm:text-lg">
              BroCo<span className="font-light text-electric-600"> Mod</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="pb-safe flex flex-1 items-start justify-center px-4 pb-10 pt-4 sm:items-center sm:py-8">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-surface-200 bg-white p-5 shadow-elevated sm:p-8">
            <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">Create your account</h1>
            <p className="mt-1 text-sm text-navy-500">
              {isGarage
                ? 'Register your workshop to receive service requests nearby.'
                : 'Book car service from verified garages near you.'}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2" role="group" aria-label="Account type">
              {roleOptions.map((opt) => {
                const Icon = opt.icon;
                const active = role === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    aria-pressed={active}
                    className={`flex min-h-[60px] items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition ${
                      active
                        ? 'border-electric-600 bg-electric-50 ring-1 ring-electric-600'
                        : 'border-surface-200 bg-white hover:border-surface-300'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        active ? 'bg-electric-600 text-white' : 'bg-surface-100 text-navy-500'
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-sm font-semibold ${active ? 'text-electric-800' : 'text-navy-800'}`}>
                        {opt.label}
                      </span>
                      <span className="block truncate text-xs text-navy-500">{opt.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>

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
                placeholder="e.g. Priya Sharma"
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
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Input
                id="phoneNumber"
                label="Mobile number"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="e.g. +91 98765 43210"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                helperText="We'll use this to update you about your booking."
                required
              />

              <Input
                id="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                className="pr-12"
                helperText="Use at least 8 characters."
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="pointer-events-auto -mr-3.5 flex h-11 w-11 items-center justify-center rounded-xl text-navy-400 transition hover:text-navy-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                }
                required
              />

              {isGarage && (
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
                    helperText="Used to send you requests from car owners within 10 km."
                    required
                  />
                </fieldset>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={submitting}
                rightIcon={<ArrowRight className="h-5 w-5" />}
              >
                {submitting ? 'Creating account…' : isGarage ? 'Register garage' : 'Create account'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-navy-500">
              Already have an account?{' '}
              <Link
                href={redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login'}
                className="font-semibold text-electric-600 hover:text-electric-700 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-navy-400">
            <Link href="/" className="hover:text-navy-600 hover:underline">
              ← Back to home
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface-50">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-electric-600 text-white shadow-lg shadow-electric-600/30">
            <Wrench className="h-6 w-6" />
          </span>
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
