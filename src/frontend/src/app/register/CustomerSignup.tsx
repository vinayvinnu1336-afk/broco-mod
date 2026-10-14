'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ChevronRight, Store } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Alert } from '@/components/ui/Alert';
import { INVALID_MOBILE_MESSAGE, isValidIndianMobile, toIndianMobile } from '@/lib/phone';
import { PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT } from '@/lib/password';
import { NewPasswordInput, SignupShell, safeRedirect, signupErrorMessage } from './_components/signup';

/** Car owner sign-up. Garages register on /register/garage. */
export function CustomerSignup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeRedirect(searchParams.get('redirect') ?? searchParams.get('next'));
  const { register } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const phoneRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

    setSubmitting(true);
    try {
      const res = await register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phoneNumber: toIndianMobile(phoneNumber),
        role: 'CUSTOMER',
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

      // e.g. "Book a service" on the landing page sends new customers here with ?redirect=/customer/requests/new
      router.push(redirect.startsWith('/customer/') ? redirect : '/customer/dashboard');
    } catch (err: unknown) {
      console.error('Registration exception:', err);
      setError('We couldn’t create your account right now. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <SignupShell>
      <div className="rounded-3xl border border-surface-200 bg-white p-5 shadow-elevated sm:p-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">Create your account</h1>
        <p className="mt-1 text-sm text-navy-500">Book car service from verified garages near you.</p>

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
            helperText="We’ll use this to update you about your booking."
            required
          />

          <NewPasswordInput value={password} onChange={setPassword} />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            isLoading={submitting}
            rightIcon={<ArrowRight className="h-5 w-5" />}
          >
            {submitting ? 'Creating account…' : 'Create account'}
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

      <Link
        href="/register/garage"
        className="mt-4 flex min-h-[64px] items-center gap-3 rounded-2xl border border-surface-200 bg-white px-4 py-3 shadow-card transition hover:border-electric-200"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
          <Store className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-navy-900">Own a garage?</span>
          <span className="block text-xs text-navy-500">Register your garage and get jobs from car owners nearby</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-navy-400" aria-hidden />
      </Link>
    </SignupShell>
  );
}
