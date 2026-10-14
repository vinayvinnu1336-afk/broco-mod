'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { BroCoLogo } from '@/components/brand/BroCoLogo';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Wrench, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { homePathForRoles } from '@/components/auth/ProtectedRoute';
import { isDemoMode } from '@/lib/demo';

/** Only allow same-origin relative paths so `?redirect=` can't send users to another site. */
function safeRedirect(value: string | null): string {
  if (!value) return '';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '';
  return value;
}

const demoAccounts: { role: 'customer' | 'garage' | 'advisor' | 'admin'; label: string }[] = [
  { role: 'customer', label: 'Car owner' },
  { role: 'garage', label: 'Garage' },
  { role: 'advisor', label: 'Service advisor' },
  { role: 'admin', label: 'Admin' },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeRedirect(searchParams.get('redirect') ?? searchParams.get('next'));
  const expired = searchParams.get('expired') === 'true';

  const { login, quickLogin, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [demoRole, setDemoRole] = useState<string | null>(null);

  // `login()` only reports success; the user (and their roles) arrives through the auth context.
  useEffect(() => {
    if (!signedIn || !user) return;
    router.replace(redirect || homePathForRoles(user.roles ?? []));
  }, [signedIn, user, redirect, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await login(email.trim(), password);
      if (!res.success) {
        const rawErr = res.error || '';
        const lower = rawErr.toLowerCase();
        if (lower.includes('invalid') || lower.includes('credentials') || lower.includes('password')) {
          setError('That email and password don’t match. Check them and try again.');
        } else if (lower.includes('network') || lower.includes('failed to fetch')) {
          setError('We can’t reach the server. Check your internet connection and try again.');
        } else if (rawErr && rawErr.length < 100 && !rawErr.includes('Exception')) {
          setError(rawErr);
        } else {
          setError('We couldn’t sign you in right now. Please try again.');
        }
        setSubmitting(false);
        return;
      }
      setSignedIn(true);
    } catch (err: unknown) {
      console.error('Login error:', err);
      setError('We couldn’t sign you in right now. Please try again.');
      setSubmitting(false);
    }
  };

  const handleDemo = async (role: 'customer' | 'garage' | 'advisor' | 'admin') => {
    setError(null);
    setDemoRole(role);
    try {
      await quickLogin(role);
    } finally {
      // quickLogin navigates away on success; if we're still here it failed.
      setTimeout(() => setDemoRole(null), 1500);
    }
  };

  const busy = submitting || signedIn;

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
            <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">Welcome back</h1>
            <p className="mt-1 text-sm text-navy-500">Sign in to book a service or check on your car.</p>

            <div className="mt-5 space-y-3">
              {expired && !error && (
                <Alert type="warning">Your session expired. Please sign in again.</Alert>
              )}
              {error && (
                <Alert type="error" onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
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

              <div>
                <Input
                  id="password"
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-12"
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
                <div className="mt-1 flex justify-end">
                  <Link
                    href={email.trim() ? `/forgot-password?email=${encodeURIComponent(email.trim())}` : '/forgot-password'}
                    className="inline-flex min-h-[36px] items-center text-sm font-semibold text-electric-600 hover:text-electric-700 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={busy}
                rightIcon={<ArrowRight className="h-5 w-5" />}
              >
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-navy-500">
              New to BroCo?{' '}
              <Link
                href={redirect ? `/register?redirect=${encodeURIComponent(redirect)}` : '/register'}
                className="font-semibold text-electric-600 hover:text-electric-700 hover:underline"
              >
                Create an account
              </Link>
            </p>
            <p className="mt-2 text-center text-sm text-navy-500">
              Own a garage?{' '}
              <Link href="/register/garage" className="font-semibold text-electric-600 hover:text-electric-700 hover:underline">
                Register your garage
              </Link>
            </p>
          </div>

          {isDemoMode && (
            <section className="mt-4 rounded-2xl border border-dashed border-surface-300 bg-white/60 p-4" aria-labelledby="demo-heading">
              <h2 id="demo-heading" className="flex items-center gap-1.5 text-sm font-semibold text-navy-800">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Try a demo account
              </h2>
              <p className="mt-0.5 text-xs text-navy-500">One tap signs you in with sample data.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {demoAccounts.map((d) => (
                  <button
                    key={d.role}
                    type="button"
                    onClick={() => handleDemo(d.role)}
                    disabled={demoRole !== null || busy}
                    className="min-h-[44px] rounded-xl border border-surface-200 bg-white px-3 text-sm font-medium text-navy-700 transition hover:border-electric-300 hover:bg-electric-50 hover:text-electric-700 disabled:opacity-60"
                  >
                    {demoRole === d.role ? 'Signing in…' : d.label}
                  </button>
                ))}
              </div>
            </section>
          )}

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

export default function LoginPage() {
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
      <LoginForm />
    </Suspense>
  );
}
