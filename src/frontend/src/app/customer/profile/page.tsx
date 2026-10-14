'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { fieldErrors, firstApiError } from '@/lib/apiErrors';
import { formatIndianMobile, INVALID_MOBILE_MESSAGE, isValidIndianMobile, mobileDigits, toIndianMobile } from '@/lib/phone';
import { Lock, Mail, MapPin, MessageSquare, Pencil, Phone } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { useToast } from '@/components/ui/Toast';

interface CustomerProfileData {
  customerId: string;
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string;
  preferredContactMethod: string;
}

// Same values the API accepts (BroCoMod.Application.Common.ContactMethods).
const CONTACT_OPTIONS = [
  { value: 'Phone', label: 'Phone call' },
  { value: 'WhatsApp', label: 'WhatsApp' },
  { value: 'SMS', label: 'SMS' },
  { value: 'Email', label: 'Email' },
];

function contactLabel(value: string | null | undefined): string {
  if (!value) return '';
  return CONTACT_OPTIONS.find((o) => o.value.toLowerCase() === value.toLowerCase())?.label ?? value;
}

interface FormState {
  fullName: string;
  phone: string;
  address: string;
  preferredContactMethod: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

const NOT_ADDED = <span className="text-navy-400">Not added</span>;

export default function CustomerProfilePage() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState<CustomerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>({ fullName: '', phone: '', address: '', preferredContactMethod: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const res = await apiFetch<CustomerProfileData>('/customer/profile');
    if (res.success && res.data) {
      setProfile(res.data);
    } else {
      setLoadError(res.message || 'Could not load your profile.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const name = profile?.fullName || user?.fullName || '';
  const email = profile?.email || user?.email || '';
  const phone = formatIndianMobile(profile?.phoneNumber || user?.phoneNumber || '');
  const initial = name ? name.trim().charAt(0).toUpperCase() : '?';

  const openEdit = () => {
    if (!profile) return;
    const known = CONTACT_OPTIONS.find((o) => o.value.toLowerCase() === (profile.preferredContactMethod || '').toLowerCase());
    setForm({
      fullName: profile.fullName,
      // An older non-Indian number would only show as a confusing 10-digit fragment; ask for a new one.
      phone: isValidIndianMobile(profile.phoneNumber) ? mobileDigits(profile.phoneNumber) : '',
      address: profile.address,
      preferredContactMethod: known?.value ?? '',
    });
    setErrors({});
    setFormError(null);
    setEditing(true);
  };

  const closeEdit = () => {
    if (!saving) setEditing(false);
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    const trimmed = form.fullName.trim();
    if (!trimmed) next.fullName = 'Enter your full name';
    else if (trimmed.length < 2 || trimmed.length > 100) next.fullName = 'Name must be 2 to 100 characters';
    if (!isValidIndianMobile(form.phone)) next.phone = INVALID_MOBILE_MESSAGE;
    if (form.address.trim().length > 500) next.address = 'Address must be 500 characters or fewer';
    return next;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      if (found.fullName) nameRef.current?.focus();
      else if (found.phone) phoneRef.current?.focus();
      return;
    }

    setSaving(true);
    const res = await apiFetch<CustomerProfileData>('/customer/profile', {
      method: 'PUT',
      body: JSON.stringify({
        fullName: form.fullName.trim(),
        phoneNumber: toIndianMobile(form.phone),
        address: form.address.trim(),
        preferredContactMethod: form.preferredContactMethod || null,
      }),
    });
    setSaving(false);

    if (res.success && res.data) {
      setProfile(res.data);
      updateUser({ fullName: res.data.fullName, phoneNumber: res.data.phoneNumber });
      setEditing(false);
      toast.success('Profile updated');
      return;
    }

    const byField = fieldErrors(res);
    const mapped: FormErrors = {
      fullName: byField.fullName,
      phone: byField.phoneNumber,
      address: byField.address,
      preferredContactMethod: byField.preferredContactMethod,
    };
    if (Object.values(mapped).some(Boolean)) {
      setErrors(mapped);
      if (mapped.fullName) nameRef.current?.focus();
      else if (mapped.phone) phoneRef.current?.focus();
    } else {
      setFormError(firstApiError(res, 'We couldn’t save your profile. Please try again.'));
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 sm:space-y-6">
      <PageHeader
        title="Profile"
        description="Your contact details."
        actions={
          profile ? (
            <Button variant="outline" onClick={openEdit} leftIcon={<Pencil className="h-4 w-4" />}>
              Edit profile
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading profile">
          <Skeleton className="h-20" />
          <Skeleton className="h-56" />
        </div>
      ) : loadError && !profile ? (
        <ErrorState title="Couldn’t load your profile" error={loadError} onRetry={loadProfile} />
      ) : (
        <>
          <div className="flex items-center gap-4 rounded-2xl border border-surface-200 bg-white p-4 shadow-card sm:p-5">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-electric-50 text-xl font-bold text-electric-700"
              aria-hidden="true"
            >
              {initial}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-navy-900">{name || 'Your account'}</h2>
              {email && <p className="truncate text-sm text-navy-500">{email}</p>}
            </div>
          </div>

          <ListGroup title="Contact details">
            <ListItem
              leading={<IconTile icon={Mail} tone="neutral" />}
              title="Email"
              subtitle={email || NOT_ADDED}
            />
            <ListItem
              leading={<IconTile icon={Phone} tone="neutral" />}
              title="Mobile"
              subtitle={phone ? <span className="tabular-nums">{phone}</span> : NOT_ADDED}
            />
            <ListItem
              leading={<IconTile icon={MapPin} tone="neutral" />}
              title="Address"
              subtitle={profile?.address ? <span className="whitespace-normal break-words">{profile.address}</span> : NOT_ADDED}
            />
            <ListItem
              leading={<IconTile icon={MessageSquare} tone="neutral" />}
              title="Preferred contact"
              subtitle={contactLabel(profile?.preferredContactMethod) || NOT_ADDED}
            />
          </ListGroup>
        </>
      )}

      <Modal
        isOpen={editing}
        onClose={closeEdit}
        title="Edit profile"
        description="Garages and our team use these details to reach you about your bookings."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={closeEdit} disabled={saving} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" form="profile-form" variant="primary" isLoading={saving} className="w-full sm:w-auto">
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        }
      >
        <form id="profile-form" onSubmit={handleSave} noValidate className="space-y-4">
          {formError && (
            <Alert type="error" onClose={() => setFormError(null)}>
              {formError}
            </Alert>
          )}

          <Input
            ref={nameRef}
            id="profile-full-name"
            label="Full name"
            autoComplete="name"
            autoCapitalize="words"
            maxLength={100}
            value={form.fullName}
            onChange={(e) => setField('fullName', e.target.value)}
            error={errors.fullName}
            aria-invalid={errors.fullName ? true : undefined}
            required
          />

          <PhoneInput
            ref={phoneRef}
            id="profile-mobile"
            label="Mobile number"
            value={form.phone}
            onChange={(digits) => setField('phone', digits)}
            error={errors.phone}
            helperText={
              profile?.phoneNumber && !isValidIndianMobile(profile.phoneNumber)
                ? `Your saved number ${profile.phoneNumber} isn’t an Indian mobile. Enter a new one.`
                : undefined
            }
            required
          />

          <div>
            <label htmlFor="profile-email" className="mb-1.5 block text-sm font-medium text-navy-800">
              Email
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" aria-hidden />
              <input
                id="profile-email"
                type="email"
                readOnly
                value={email}
                aria-describedby="profile-email-note"
                className="min-h-[44px] w-full truncate rounded-xl border border-surface-200 bg-surface-50 py-2.5 pl-10 pr-3.5 text-base text-navy-600 focus:outline-none focus:ring-2 focus:ring-electric-600/20 sm:text-sm"
              />
            </div>
            <p id="profile-email-note" className="mt-1 text-xs text-navy-500">
              You sign in with this email, so it can’t be changed here.
            </p>
          </div>

          <Textarea
            id="profile-address"
            label="Address"
            rows={3}
            maxLength={500}
            autoComplete="street-address"
            placeholder="House or flat no., street, area, city, PIN code"
            value={form.address}
            onChange={(e) => setField('address', e.target.value)}
            error={errors.address}
          />

          <Select
            id="profile-contact"
            label="Preferred contact"
            value={form.preferredContactMethod}
            onChange={(e) => setField('preferredContactMethod', e.target.value)}
            error={errors.preferredContactMethod}
            helperText="How you’d like us to reach you about bookings."
          >
            <option value="" disabled>
              Choose one
            </option>
            {CONTACT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </form>
      </Modal>
    </div>
  );
}
