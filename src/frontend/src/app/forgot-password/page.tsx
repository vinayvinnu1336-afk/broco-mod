'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { BroCoLogo } from '@/components/brand/BroCoLogo';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Wrench, ArrowRight, ArrowLeft, Eye, EyeOff, CheckCircle2, MailCheck, MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { apiFetch } from '@/lib/api';
import { formatIndianMobile, INVALID_MOBILE_MESSAGE, isValidIndianMobile, toIndianMobile } from '@/lib/phone';
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT } from '@/lib/password';

type Step = 'request' | 'reset' | 'done';
// Mobile first, like sign-in: the code goes by WhatsApp or SMS. Email stays one tap away.
type Method = 'mobile' | 'email';

const RESEND_COOLDOWN_SECONDS = 30;

function friendlyError(raw: string | undefined, fallback: string, errors?: string[]): string {
  // The API says how long to wait ("Too many codes requested. Please wait 12 minutes ...").
  if (errors?.includes('rate_limited') && raw) return raw;
  const lower = (raw || '').toLowerCase();
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'We can’t reach the server. Check your internet connection and try again.';
  }
  if (lower.includes('429') || lower.includes('too many')) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  return fallback;
}

function ForgotPasswordForm() {
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>('request');
  const [method, setMethod] = useState<Method>(searchParams.get('email') ? 'email' : 'mobile');
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [mobile, setMobile] = useState('');
  const [mobileError, setMobileError] = useState<string | undefined>();
  const mobileRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const switched = useRef(false);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);

  // After switching between mobile and email, put the cursor in the new field (not on first load).
  useEffect(() => {
    if (!switched.current) return;
    (method === 'email' ? emailRef : mobileRef).current?.focus();
  }, [method]);

  const switchMethod = (next: Method) => {
    switched.current = true;
    setMethod(next);
    setStep('request');
    setCode('');
    setError(null);
    setMobileError(undefined);
    setResent(false);
    setCooldown(0);
  };

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async (): Promise<boolean> => {
    const res = await apiFetch<unknown>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(method === 'mobile' ? { mobileNumber: toIndianMobile(mobile) } : { email: email.trim() }),
    });
    if (!res.success) {
      setError(friendlyError(res.message, 'We couldn’t send a code right now. Please try again.', res.errors));
      return false;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
    return true;
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (method === 'mobile') {
      if (!isValidIndianMobile(mobile)) {
        setMobileError(INVALID_MOBILE_MESSAGE);
        mobileRef.current?.focus();
        return;
      }
    } else if (!email.trim()) {
      setError('Enter the email you signed up with.');
      return;
    }
    setSubmitting(true);
    try {
      if (await sendCode()) {
        setResent(false);
        setStep('reset');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError(null);
    setSubmitting(true);
    try {
      if (await sendCode()) setResent(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^\d{6}$/.test(code)) {
      setError(method === 'mobile' ? 'Enter the 6-digit code we sent to your phone.' : 'Enter the 6-digit code from the email.');
      return;
    }
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setError(PASSWORD_TOO_SHORT);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The two passwords don’t match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<boolean>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(
          method === 'mobile'
            ? { mobileNumber: toIndianMobile(mobile), code, newPassword }
            : { email: email.trim(), token: code, newPassword }
        ),
      });
      if (!res.success) {
        setError(friendlyError(res.message, 'That code is wrong or has expired. Check it, or request a new one.', res.errors));
        return;
      }
      setStep('done');
    } finally {
      setSubmitting(false);
    }
  };

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      className="pointer-events-auto -mr-3.5 flex h-11 w-11 items-center justify-center rounded-xl text-navy-400 transition hover:text-navy-700"
      aria-label={showPassword ? 'Hide password' : 'Show password'}
      aria-pressed={showPassword}
    >
      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col bg-surface-50">
      <header className="pt-safe">
        <div className="mx-auto flex h-14 max-w-md items-center px-4 sm:h-16">
          <Link href="/" className="flex items-center gap-2.5" aria-label="BroCo home">
            <BroCoLogo size={36} />
          </Link>
        </div>
      </header>

      <main className="pb-safe flex flex-1 items-start justify-center px-4 pb-10 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-surface-200 bg-white p-5 shadow-elevated sm:p-8">
            {step === 'request' && (
              <>
                <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">Reset your password</h1>
                <p className="mt-1 text-sm text-navy-500">
                  {method === 'mobile'
                    ? 'Enter your mobile number and we’ll send a 6-digit code by WhatsApp or SMS.'
                    : 'Enter the email you signed up with and we’ll send you a 6-digit code.'}
                </p>

                {error && (
                  <Alert type="error" onClose={() => setError(null)} className="mt-4">
                    {error}
                  </Alert>
                )}

                <form className="mt-5 space-y-4" onSubmit={handleRequest} noValidate={method === 'mobile'}>
                  <div>
                    {method === 'mobile' ? (
                      <PhoneInput
                        ref={mobileRef}
                        id="mobileNumber"
                        name="mobileNumber"
                        label="Mobile number"
                        value={mobile}
                        onChange={(digits) => {
                          setMobile(digits);
                          setMobileError(undefined);
                        }}
                        error={mobileError}
                        required
                      />
                    ) : (
                      <Input
                        ref={emailRef}
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
                    )}
                    <button
                      type="button"
                      onClick={() => switchMethod(method === 'mobile' ? 'email' : 'mobile')}
                      className="mt-1 inline-flex min-h-[36px] items-center text-sm font-semibold text-electric-600 hover:text-electric-700 hover:underline"
                    >
                      {method === 'mobile' ? 'Use email instead' : 'Use mobile number instead'}
                    </button>
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    isLoading={submitting}
                    rightIcon={<ArrowRight className="h-5 w-5" />}
                  >
                    {submitting ? 'Sending…' : 'Send code'}
                  </Button>
                </form>
              </>
            )}

            {step === 'reset' && (
              <>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-50 text-electric-600">
                  {method === 'mobile' ? <MessageSquareText className="h-5 w-5" /> : <MailCheck className="h-5 w-5" />}
                </span>
                <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-navy-900">
                  {method === 'mobile' ? 'Check your phone' : 'Check your email'}
                </h1>
                {method === 'mobile' ? (
                  <p className="mt-1 text-sm leading-relaxed text-navy-500">
                    If <span className="whitespace-nowrap font-medium text-navy-800">{formatIndianMobile(mobile)}</span> belongs
                    to a BroCo account, we&apos;ve sent a 6-digit code by WhatsApp or SMS. It expires in 10 minutes.
                  </p>
                ) : (
                  <p className="mt-1 text-sm leading-relaxed text-navy-500">
                    If an account exists for <span className="break-all font-medium text-navy-800">{email.trim()}</span>,
                    we&apos;ve sent a 6-digit code. It expires in 10 minutes.
                  </p>
                )}

                <div className="mt-4 space-y-3">
                  {resent && !error && <Alert type="success">We&apos;ve sent a new code.</Alert>}
                  {error && (
                    <Alert type="error" onClose={() => setError(null)}>
                      {error}
                    </Alert>
                  )}
                </div>

                <form className="mt-5 space-y-4" onSubmit={handleReset}>
                  <Input
                    id="code"
                    label="6-digit code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="tabular-nums tracking-[0.3em]"
                    required
                  />
                  <Input
                    id="newPassword"
                    label="New password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder={PASSWORD_HINT}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={PASSWORD_MIN_LENGTH}
                    className="pr-12"
                    rightIcon={passwordToggle}
                    required
                  />
                  <Input
                    id="confirmPassword"
                    label="Confirm new password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Type it again"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    error={confirmPassword && confirmPassword !== newPassword ? 'Passwords don’t match' : undefined}
                    required
                  />
                  <Button type="submit" size="lg" className="w-full" isLoading={submitting}>
                    {submitting ? 'Saving…' : 'Set new password'}
                  </Button>
                </form>

                <div className="mt-5 flex flex-col items-center gap-1 text-sm sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={cooldown > 0 || submitting}
                    className="min-h-[44px] font-semibold text-electric-600 hover:text-electric-700 disabled:cursor-not-allowed disabled:text-navy-400"
                  >
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('request');
                      setCode('');
                      setError(null);
                      setResent(false);
                    }}
                    className="min-h-[44px] font-medium text-navy-500 hover:text-navy-800"
                  >
                    {method === 'mobile' ? 'Use a different number' : 'Use a different email'}
                  </button>
                </div>

                {method === 'mobile' && (
                  <p className="mt-3 border-t border-surface-200 pt-4 text-center text-sm text-navy-500">
                    No code, or your number is shared by more than one account?{' '}
                    <button
                      type="button"
                      onClick={() => switchMethod('email')}
                      className="inline-flex min-h-[36px] items-center font-semibold text-electric-600 hover:text-electric-700 hover:underline"
                    >
                      Reset with email instead
                    </button>
                  </p>
                )}
              </>
            )}

            {step === 'done' && (
              <div className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-7 w-7" />
                </span>
                <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-navy-900">Password updated</h1>
                <p className="mt-1 text-sm text-navy-500">
                  You can now sign in with your new password.
                </p>
                <Link
                  href="/login"
                  className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-electric-600 px-5 text-base font-semibold text-white shadow-sm shadow-electric-600/20 transition hover:bg-electric-700"
                >
                  Go to sign in <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            )}
          </div>

          {step !== 'done' && (
            <p className="mt-6 text-center text-sm">
              <Link
                href="/login"
                className="inline-flex min-h-[44px] items-center gap-1.5 font-medium text-navy-500 hover:text-navy-800"
              >
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

export default function ForgotPasswordPage() {
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
      <ForgotPasswordForm />
    </Suspense>
  );
}
