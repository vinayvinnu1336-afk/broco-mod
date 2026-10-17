'use client';

import React, { forwardRef, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Wrench } from 'lucide-react';
import { BroCoLogo } from '@/components/brand/BroCoLogo';
import { Input } from '@/components/ui/Input';
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH } from '@/lib/password';

/** Only allow same-origin relative paths so `?redirect=` can't send users to another site. */
export function safeRedirect(value: string | null): string {
  if (!value) return '';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '';
  return value;
}

/** A failed sign-up, in words a car owner or garage owner understands. */
export function signupErrorMessage(rawErr: string | undefined, email: string): string {
  const raw = rawErr || '';
  const lower = raw.toLowerCase();
  if (lower.includes('already exists')) return `An account with ${email} already exists. Sign in instead.`;
  if (lower.includes('failed to fetch') || lower.includes('network')) return 'We can’t reach the server. Check your connection and try again.';
  if (raw && raw.length < 100 && !raw.includes('Exception')) return raw;
  return 'We couldn’t create your account right now. Please try again.';
}

/** Logo bar + centred column used by both sign-up pages. `wide` makes room for the garage page's side panel. */
export function SignupShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-50">
      <header className="pt-safe">
        <div className={`mx-auto flex h-14 items-center px-4 sm:h-16 ${wide ? 'max-w-md lg:max-w-[66rem]' : 'max-w-md'}`}>
          <Link href="/" className="flex items-center gap-2.5" aria-label="BroCo home">
            <BroCoLogo size={36} />
          </Link>
        </div>
      </header>

      <main className="pb-safe flex flex-1 items-start justify-center px-4 pb-10 pt-4 sm:items-center sm:py-8">
        <div className={`w-full ${wide ? 'max-w-md lg:max-w-5xl' : 'max-w-md'}`}>
          {children}
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

export function SignupFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-electric-600 text-white shadow-lg shadow-electric-600/30">
        <Wrench className="h-6 w-6" />
      </span>
    </div>
  );
}

/** New-password field with a show/hide toggle. */
export function NewPasswordInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <Input
      id="password"
      label="Password"
      type={show ? 'text' : 'password'}
      autoComplete="new-password"
      placeholder={PASSWORD_HINT}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      minLength={PASSWORD_MIN_LENGTH}
      className="pr-12"
      helperText={`Use ${PASSWORD_HINT.toLowerCase()}.`}
      rightIcon={
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="pointer-events-auto -mr-3.5 flex h-11 w-11 items-center justify-center rounded-xl text-navy-400 transition hover:text-navy-700"
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      }
      required
    />
  );
}

export const CONSENT_REQUIRED = 'Please tick the box to agree before you continue.';

/** A policy link inside the consent label. Opens in a new tab so the half-filled form isn't lost. */
export function PolicyLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-electric-700 underline decoration-electric-200 underline-offset-2 hover:decoration-electric-600"
    >
      {children}
    </Link>
  );
}

/**
 * Required "I agree to ..." checkbox. Not a native `required` field, so the inline error below shows
 * instead of the browser bubble; the form checks `checked` before submitting.
 */
export const LegalConsent = forwardRef<
  HTMLInputElement,
  { id: string; checked: boolean; onChange: (checked: boolean) => void; error?: string; children: React.ReactNode }
>(function LegalConsent({ id, checked, onChange, error, children }, ref) {
  const errorId = `${id}-error`;
  return (
    <div>
      <div
        className={`flex items-start gap-3 rounded-xl border px-3 py-3 transition ${
          error ? 'border-red-300 bg-red-50/60' : 'border-surface-200 bg-surface-50'
        }`}
      >
        <input
          ref={ref}
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-required="true"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-surface-300 text-electric-600 focus:ring-2 focus:ring-electric-500 focus:ring-offset-1"
        />
        <label htmlFor={id} className="cursor-pointer text-sm leading-relaxed text-navy-700">
          {children}
        </label>
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
});
