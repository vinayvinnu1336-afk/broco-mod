'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { BroCoLogo } from '@/components/brand/BroCoLogo';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Wrench, ArrowRight, ArrowLeft, Eye, EyeOff, CheckCircle2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { apiFetch } from '@/lib/api';

type Step = 'request' | 'reset' | 'done';

const RESEND_COOLDOWN_SECONDS = 30;

function friendlyError(raw: string | undefined, fallback: string): string {
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
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async (): Promise<boolean> => {
    const res = await apiFetch<unknown>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim() }),
    });
    if (!res.success) {
      setError(friendlyError(res.message, 'We couldn’t send a code right now. Please try again.'));
      return false;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
    return true;
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
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
      setError('Enter the 6-digit code from the email.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Your new password must be at least 8 characters.');
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
        body: JSON.stringify({ email: email.trim(), token: code, newPassword }),
      });
      if (!res.success) {
        setError(friendlyError(res.message, 'That code is wrong or has expired. Check it, or request a new one.'));
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
                  Enter the email you signed up with and we&apos;ll send you a 6-digit code.
                </p>

                {error && (
                  <Alert type="error" onClose={() => setError(null)} className="mt-4">
                    {error}
                  </Alert>
                )}

                <form className="mt-5 space-y-4" onSubmit={handleRequest}>
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
                  <MailCheck className="h-5 w-5" />
                </span>
                <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-navy-900">Check your email</h1>
                <p className="mt-1 text-sm leading-relaxed text-navy-500">
                  If an account exists for <span className="break-all font-medium text-navy-800">{email.trim()}</span>,
                  we&apos;ve sent a 6-digit code. It expires in 10 minutes.
                </p>

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
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
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
                    Use a different email
                  </button>
                </div>
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
