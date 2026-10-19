'use client';

import React, { useEffect, useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, Mail, MailX } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { formatIndianMobile, isValidIndianMobile, toIndianMobile } from '@/lib/phone';
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT } from '@/lib/password';
import {
  AdminAdvisorList,
  CreatedAdvisor,
  EXISTING_CUSTOMER_ACCOUNT,
  ExistingCustomerAccount,
  PromotedAdvisor,
} from '@/types/adminOperations';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Select } from '@/components/ui/Select';
import { ChoiceChips, FormError } from '@/components/admin/FormControls';

export const DEFAULT_SPECIALIZATION = 'General Automotive';
const SPECIALIZATIONS = [
  DEFAULT_SPECIALIZATION,
  'Periodic service',
  'AC and electricals',
  'Body and paint',
  'Engine and transmission',
  'EV and hybrid',
  'Luxury cars',
];
const OTHER = '__other__';
const MAX_LIMIT = 200;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = Partial<Record<'fullName' | 'mobile' | 'email' | 'specialization' | 'maxOpen' | 'password', string>>;

/** Speciality picker: common choices, or "Other" with a free-text box. */
function SpecializationField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const [other, setOther] = useState(() => !SPECIALIZATIONS.includes(value));
  return (
    <div className="space-y-2">
      <Select
        id="advisor-specialization"
        label="Speciality"
        value={other ? OTHER : value}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setOther(true);
            onChange('');
          } else {
            setOther(false);
            onChange(e.target.value);
          }
        }}
        options={[...SPECIALIZATIONS.map((s) => ({ value: s, label: s })), { value: OTHER, label: 'Other…' }]}
      />
      {other && (
        <Input
          id="advisor-specialization-other"
          aria-label="Speciality"
          placeholder="e.g. Commercial vehicles"
          maxLength={100}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          error={error}
        />
      )}
    </div>
  );
}

function validLimit(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= MAX_LIMIT ? n : null;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard blocked (e.g. not HTTPS): the value is selectable on screen.
      setCopied(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={copy}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      leftIcon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      className="shrink-0"
    >
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

// ==========================================
// Add advisor
// ==========================================

export function AddAdvisorSheet({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Called after an account is created or promoted, so the list can refresh. */
  onCreated: (advisor: AdminAdvisorList) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [specialization, setSpecialization] = useState(DEFAULT_SPECIALIZATION);
  const [maxOpen, setMaxOpen] = useState('25');
  const [passwordMode, setPasswordMode] = useState<'generate' | 'set'>('generate');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<ExistingCustomerAccount | null>(null);
  const [created, setCreated] = useState<CreatedAdvisor | null>(null);
  const [promoted, setPromoted] = useState<PromotedAdvisor | null>(null);
  const [formKey, setFormKey] = useState(0);
  const clearError = (key: keyof FieldErrors) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  // Start clean every time the sheet opens; the one-time password never outlives the sheet.
  useEffect(() => {
    if (!isOpen) return;
    setFullName('');
    setMobile('');
    setEmail('');
    setSpecialization(DEFAULT_SPECIALIZATION);
    setMaxOpen('25');
    setPasswordMode('generate');
    setPassword('');
    setShowPassword(false);
    setErrors({});
    setFormError(null);
    setExisting(null);
    setCreated(null);
    setPromoted(null);
    setFormKey((k) => k + 1);
  }, [isOpen]);

  const close = () => {
    if (saving) return;
    setCreated(null);
    setPassword('');
    onClose();
  };

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    if (fullName.trim().length < 2) e.fullName = "Enter the advisor's full name";
    if (!isValidIndianMobile(mobile)) e.mobile = 'Enter a valid 10-digit mobile number';
    if (!EMAIL_PATTERN.test(email.trim())) e.email = 'Enter a valid email address';
    if (specialization.trim().length > 100) e.specialization = 'Keep it under 100 characters';
    if (validLimit(maxOpen) === null) e.maxOpen = `Enter a number from 1 to ${MAX_LIMIT}`;
    if (passwordMode === 'set' && password.length < PASSWORD_MIN_LENGTH) e.password = PASSWORD_TOO_SHORT;
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    const res = await apiFetch<CreatedAdvisor | ExistingCustomerAccount>('/admin/advisors', {
      method: 'POST',
      body: JSON.stringify({
        fullName: fullName.trim(),
        mobileNumber: toIndianMobile(mobile),
        email: email.trim(),
        specialization: specialization.trim() || DEFAULT_SPECIALIZATION,
        maxAssignedRequests: validLimit(maxOpen),
        password: passwordMode === 'set' ? password : null,
      }),
    });
    setSaving(false);

    if (res.success && res.data) {
      const result = res.data as CreatedAdvisor;
      setPassword('');
      setCreated(result);
      onCreated(result.advisor);
      return;
    }
    if (res.errors?.[0] === EXISTING_CUSTOMER_ACCOUNT && res.data) {
      setExisting(res.data as ExistingCustomerAccount);
      return;
    }
    setFormError(res.message || 'Could not create the advisor.');
  };

  const promote = async () => {
    if (!existing) return;
    setSaving(true);
    setFormError(null);
    const res = await apiFetch<PromotedAdvisor>('/admin/advisors/promote', {
      method: 'POST',
      body: JSON.stringify({
        email: existing.email,
        specialization: specialization.trim() || DEFAULT_SPECIALIZATION,
        maxAssignedRequests: validLimit(maxOpen),
      }),
    });
    setSaving(false);
    if (res.success && res.data) {
      setPromoted(res.data);
      onCreated(res.data.advisor);
    } else {
      setFormError(res.message || 'Could not make this account an advisor.');
    }
  };

  const done = created || promoted;
  const step: 'form' | 'existing' | 'done' = done ? 'done' : existing ? 'existing' : 'form';

  const title =
    step === 'done'
      ? created
        ? 'Advisor added'
        : promoted?.alreadyAdvisor
          ? 'Already an advisor'
          : 'Account is now an advisor'
      : step === 'existing'
        ? 'Customer account found'
        : 'Add advisor';

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

  const footer =
    step === 'form' ? (
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={close} disabled={saving} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button type="submit" form="add-advisor-form" isLoading={saving} className="w-full sm:w-auto">
          Add advisor
        </Button>
      </div>
    ) : step === 'existing' ? (
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          onClick={() => {
            setExisting(null);
            setFormError(null);
          }}
          disabled={saving}
          className="w-full sm:w-auto"
        >
          Back
        </Button>
        <Button onClick={promote} isLoading={saving} className="w-full sm:w-auto">
          Make {existing?.fullName || existing?.email} an advisor
        </Button>
      </div>
    ) : (
      <div className="flex sm:justify-end">
        <Button onClick={close} className="w-full sm:w-auto">
          Done
        </Button>
      </div>
    );

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      size="md"
      title={title}
      description={step === 'form' ? 'They sign in with their mobile number.' : undefined}
      footer={footer}
    >
      {step === 'form' && (
        <form key={formKey} id="add-advisor-form" onSubmit={submit} className="space-y-4" noValidate>
          <FormError message={formError} />
          <Input
            id="advisor-name"
            label="Full name"
            autoComplete="off"
            maxLength={200}
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              clearError('fullName');
            }}
            error={errors.fullName}
            required
          />
          <PhoneInput
            id="advisor-mobile"
            label="Mobile number"
            autoComplete="off"
            value={mobile}
            onChange={(v) => {
              setMobile(v);
              clearError('mobile');
            }}
            error={errors.mobile}
            helperText="Used to sign in"
            required
          />
          <Input
            id="advisor-email"
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="off"
            maxLength={256}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError('email');
            }}
            error={errors.email}
            helperText="The welcome email goes here"
            required
          />
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <SpecializationField value={specialization} onChange={setSpecialization} error={errors.specialization} />
            <Input
              id="advisor-max-open"
              label="Max open requests"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_LIMIT}
              value={maxOpen}
              onChange={(e) => {
                setMaxOpen(e.target.value.replace(/\D/g, '').slice(0, 3));
                clearError('maxOpen');
              }}
              error={errors.maxOpen}
            />
          </div>
          <ChoiceChips
            label="Password"
            options={[
              { value: 'generate', label: 'Generate a temporary password' },
              { value: 'set', label: 'Set a password' },
            ]}
            value={[passwordMode]}
            onChange={(v) => setPasswordMode((v[0] as 'generate' | 'set') ?? passwordMode)}
          />
          {passwordMode === 'set' ? (
            <Input
              id="advisor-password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={PASSWORD_HINT}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError('password');
              }}
              minLength={PASSWORD_MIN_LENGTH}
              className="pr-12"
              rightIcon={passwordToggle}
              error={errors.password}
              required
            />
          ) : (
            <p className="text-sm text-navy-500">
              We&apos;ll make a 12-character password and show it to you once.
            </p>
          )}
        </form>
      )}

      {step === 'existing' && existing && (
        <div className="space-y-4">
          <FormError message={formError} />
          <p className="text-sm text-navy-700">
            This {existing.matchedBy} already belongs to a customer account. You can make that account an advisor
            instead. They keep their password and sign in as before.
          </p>
          <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm">
            <div className="font-semibold text-navy-900">{existing.fullName}</div>
            <div className="break-all text-navy-600">{existing.email}</div>
            {existing.phoneNumber && <div className="text-navy-600">{formatIndianMobile(existing.phoneNumber)}</div>}
          </div>
          <p className="text-xs text-navy-500">
            The account stops being a customer account, so they can&apos;t book services with it. Anyone signed in on
            it is signed out.
          </p>
        </div>
      )}

      {step === 'done' && created && (
        <div className="space-y-4">
          <p className="text-sm text-navy-700">
            <span className="font-semibold text-navy-900">{created.advisor.fullName}</span> can now sign in as an
            advisor ({created.advisor.employeeCode}).
          </p>
          <div className="divide-y divide-surface-200 rounded-xl border border-surface-200">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="text-xs text-navy-500">Sign in with mobile</div>
                <div className="font-semibold tabular-nums text-navy-900">{formatIndianMobile(created.loginMobile)}</div>
              </div>
              <CopyButton value={formatIndianMobile(created.loginMobile)} label="mobile number" />
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="text-xs text-navy-500">{created.passwordGenerated ? 'Temporary password' : 'Password'}</div>
                {created.temporaryPassword ? (
                  <div className="select-all break-all font-mono text-lg font-semibold tracking-wider text-navy-900">
                    {created.temporaryPassword}
                  </div>
                ) : (
                  <div className="text-sm font-medium text-navy-700">The password you set</div>
                )}
              </div>
              {created.temporaryPassword && <CopyButton value={created.temporaryPassword} label="password" />}
            </div>
          </div>
          {created.temporaryPassword && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Share this privately. It won&apos;t be shown again.</span>
            </div>
          )}
          <div
            className={`flex items-start gap-2 text-sm ${created.welcomeEmailSent ? 'text-emerald-700' : 'text-navy-600'}`}
          >
            {created.welcomeEmailSent ? (
              <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <MailX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>{created.welcomeEmailStatus}</span>
          </div>
        </div>
      )}

      {step === 'done' && promoted && (
        <div className="space-y-3 text-sm text-navy-700">
          <p>
            <span className="font-semibold text-navy-900">{promoted.advisor.fullName}</span>{' '}
            {promoted.alreadyAdvisor
              ? 'was already an advisor. Nothing changed.'
              : `is now an advisor (${promoted.advisor.employeeCode}).`}
          </p>
          {!promoted.alreadyAdvisor && (
            <p>They sign in with their usual mobile number or email and their existing password.</p>
          )}
        </div>
      )}
    </Modal>
  );
}

// ==========================================
// Edit advisor
// ==========================================

export function EditAdvisorSheet({
  advisor,
  onClose,
  onSaved,
}: {
  advisor: AdminAdvisorList | null;
  onClose: () => void;
  onSaved: (advisor: AdminAdvisorList) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [specialization, setSpecialization] = useState(DEFAULT_SPECIALIZATION);
  const [maxOpen, setMaxOpen] = useState('25');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const clearError = (key: keyof FieldErrors) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  useEffect(() => {
    if (!advisor) return;
    setFullName(advisor.fullName);
    setSpecialization(advisor.specialization || DEFAULT_SPECIALIZATION);
    setMaxOpen(String(advisor.maxAssignedRequests ?? 25));
    setErrors({});
    setFormError(null);
  }, [advisor]);

  const close = () => {
    if (!saving) onClose();
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!advisor) return;
    const e: FieldErrors = {};
    if (fullName.trim().length < 2) e.fullName = "Enter the advisor's full name";
    if (specialization.trim().length > 100) e.specialization = 'Keep it under 100 characters';
    if (validLimit(maxOpen) === null) e.maxOpen = `Enter a number from 1 to ${MAX_LIMIT}`;
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    const res = await apiFetch<AdminAdvisorList>(`/admin/advisors/${advisor.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        fullName: fullName.trim(),
        specialization: specialization.trim() || DEFAULT_SPECIALIZATION,
        maxAssignedRequests: validLimit(maxOpen),
      }),
    });
    setSaving(false);
    if (res.success && res.data) onSaved(res.data);
    else setFormError(res.message || 'Could not save the advisor.');
  };

  return (
    <Modal
      isOpen={!!advisor}
      onClose={close}
      size="md"
      title="Edit advisor"
      description={advisor?.email}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={close} disabled={saving} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="submit" form="edit-advisor-form" isLoading={saving} className="w-full sm:w-auto">
            Save
          </Button>
        </div>
      }
    >
      {advisor && (
        <form key={advisor.id} id="edit-advisor-form" onSubmit={submit} className="space-y-4" noValidate>
          <FormError message={formError} />
          <Input
            id="edit-advisor-name"
            label="Full name"
            maxLength={200}
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              clearError('fullName');
            }}
            error={errors.fullName}
            required
          />
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <SpecializationField value={specialization} onChange={setSpecialization} error={errors.specialization} />
            <Input
              id="edit-advisor-max-open"
              label="Max open requests"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_LIMIT}
              value={maxOpen}
              onChange={(e) => {
                setMaxOpen(e.target.value.replace(/\D/g, '').slice(0, 3));
                clearError('maxOpen');
              }}
              error={errors.maxOpen}
            />
          </div>
        </form>
      )}
    </Modal>
  );
}
