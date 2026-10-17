'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { fieldErrors, firstApiError } from '@/lib/apiErrors';
import { useAuth } from '@/context/AuthContext';
import { Building2, Crosshair, Mail, MapPin, Pencil, Phone, ShieldCheck, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { useToast } from '@/components/ui/Toast';
import { humanize } from '@/lib/format';
import {
  formatIndianMobile,
  INVALID_MOBILE_MESSAGE,
  isValidIndianMobile,
  mobileDigits,
  mobileTelHref,
  toIndianMobile,
} from '@/lib/phone';
import { findLiveAreaFor, liveCitiesLabel, useLiveServiceAreas } from '@/components/location/serviceArea';
import { AddressLookup, isAddressLookupEnabled, lookupAddress } from '@/components/location/addressLookup';

interface GarageProfileData {
  garageId: string;
  name: string;
  email: string;
  phoneNumber: string;
  address: string;
  longitude: number;
  latitude: number;
  isActive: boolean;
  status?: string;
  isVerified?: boolean;
  updatedAtUtc?: string | null;
  teamMembers: Array<{
    userId: string;
    fullName: string;
    email: string;
    roleName: string;
    title: string;
  }>;
}

// Staff can look; only owners and managers may change the listing (the API enforces the same).
const EDIT_ROLES = ['GARAGE_OWNER', 'GARAGE_MANAGER'];

const STATUS_COPY: Record<string, { label: string; variant: BadgeVariant; note: string }> = {
  Verified: { label: 'Verified', variant: 'green', note: 'Your garage is verified and can receive bookings.' },
  PendingVerification: {
    label: 'Awaiting verification',
    variant: 'amber',
    note: 'Our team checks every new garage before it receives bookings.',
  },
  Suspended: { label: 'Suspended', variant: 'red', note: 'Bookings are paused. Contact BroCo support for help.' },
  Inactive: { label: 'Inactive', variant: 'neutral', note: 'This garage is switched off. Contact BroCo support for help.' },
};

interface FormState {
  name: string;
  phone: string;
  email: string;
  address: string;
  yourName: string;
  latitude: number | null;
  longitude: number | null;
}

type FormErrors = Partial<Record<'name' | 'phone' | 'email' | 'address' | 'yourName' | 'location', string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hasPin(lat: number | null | undefined, lng: number | null | undefined): lat is number {
  return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

function samePin(aLat: number | null, aLng: number | null, bLat: number, bLng: number): boolean {
  return aLat != null && aLng != null && Math.abs(aLat - bLat) < 0.00001 && Math.abs(aLng - bLng) < 0.00001;
}

export default function GarageProfilePage() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const areas = useLiveServiceAreas();
  const [profile, setProfile] = useState<GarageProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: '',
    phone: '',
    email: '',
    address: '',
    yourName: '',
    latitude: null,
    longitude: null,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [suggested, setSuggested] = useState<AddressLookup | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const canEdit = !!user && (user.roles ?? []).some((r) => EDIT_ROLES.includes(r));
  const me = profile?.teamMembers?.find((m) => m.userId === user?.id);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await apiFetch<GarageProfileData>('/garage/profile');
    if (res.success && res.data) {
      setProfile(res.data);
    } else {
      setError(res.message || 'Could not load the workshop profile.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const hasLocation = profile != null && hasPin(profile.latitude, profile.longitude);
  const status = STATUS_COPY[profile?.status ?? ''] ?? null;

  const openEdit = () => {
    if (!profile) return;
    setForm({
      name: profile.name,
      // An older non-Indian number would only show as a confusing fragment; ask for a new one.
      phone: isValidIndianMobile(profile.phoneNumber) ? mobileDigits(profile.phoneNumber) : '',
      email: profile.email,
      address: profile.address,
      yourName: me?.fullName ?? '',
      latitude: hasPin(profile.latitude, profile.longitude) ? profile.latitude : null,
      longitude: hasPin(profile.latitude, profile.longitude) ? profile.longitude : null,
    });
    setErrors({});
    setFormError(null);
    setSuggested(null);
    setEditing(true);
  };

  const closeEdit = () => {
    if (!saving) setEditing(false);
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key === 'latitude' || key === 'longitude' ? 'location' : key]: undefined }));
  };

  const pinMoved = profile != null && hasPin(form.latitude, form.longitude) && !samePin(form.latitude, form.longitude, profile.latitude, profile.longitude);
  const nameChanged = profile != null && form.name.trim() !== profile.name;

  const shareCurrentLocation = () => {
    setErrors((e) => ({ ...e, location: undefined }));
    setSuggested(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setErrors((e) => ({ ...e, location: 'Your browser cannot share your location.' }));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setForm((f) => ({ ...f, latitude: lat, longitude: lng }));
        if (!findLiveAreaFor(lat, lng, areas)) {
          setLocating(false);
          setErrors((e) => ({
            ...e,
            location: `This spot is outside the cities we serve (${liveCitiesLabel(areas)}). Share the location from your workshop.`,
          }));
          return;
        }
        if (isAddressLookupEnabled()) {
          const found = await lookupAddress(lat, lng);
          if (found.status === 'found' && found.address.formattedAddress) setSuggested(found.address);
        }
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setErrors((e) => ({
          ...e,
          location:
            err.code === err.PERMISSION_DENIED
              ? 'Location access is blocked. Allow location for this site in your browser settings and try again.'
              : 'We could not get your location. Move to an open area or try again.',
        }));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  const resetPin = () => {
    if (!profile) return;
    setSuggested(null);
    setErrors((e) => ({ ...e, location: undefined }));
    setForm((f) => ({
      ...f,
      latitude: hasLocation ? profile.latitude : null,
      longitude: hasLocation ? profile.longitude : null,
    }));
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    const name = form.name.trim();
    if (!name) next.name = 'Enter the garage name';
    else if (name.length < 2 || name.length > 120) next.name = 'Garage name must be 2 to 120 characters';
    if (!isValidIndianMobile(form.phone)) next.phone = INVALID_MOBILE_MESSAGE;
    const email = form.email.trim();
    if (!email) next.email = 'Enter the garage email';
    else if (!EMAIL_RE.test(email) || email.length > 200) next.email = 'Enter a valid email address';
    const address = form.address.trim();
    if (address.length < 5) next.address = 'Enter the workshop address';
    else if (address.length > 500) next.address = 'Address must be 500 characters or fewer';
    if (me) {
      const yourName = form.yourName.trim();
      if (yourName.length < 2 || yourName.length > 100) next.yourName = 'Your name must be 2 to 100 characters';
    }
    if (pinMoved && !findLiveAreaFor(form.latitude!, form.longitude!, areas))
      next.location = `This spot is outside the cities we serve (${liveCitiesLabel(areas)}).`;
    return next;
  };

  const focusFirst = (found: FormErrors) => {
    if (found.name) nameRef.current?.focus();
    else if (found.phone) phoneRef.current?.focus();
    else if (found.email) emailRef.current?.focus();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const found = validate();
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      focusFirst(found);
      return;
    }

    setSaving(true);
    const res = await apiFetch<GarageProfileData>('/garage/profile', {
      method: 'PUT',
      body: JSON.stringify({
        name: form.name.trim(),
        phoneNumber: toIndianMobile(form.phone),
        email: form.email.trim(),
        address: form.address.trim(),
        // Unchanged pin: send nothing so the saved one is kept exactly.
        latitude: pinMoved ? form.latitude : null,
        longitude: pinMoved ? form.longitude : null,
        yourFullName: me ? form.yourName.trim() : null,
      }),
    });
    setSaving(false);

    if (res.success && res.data) {
      setProfile(res.data);
      const myRow = res.data.teamMembers?.find((m) => m.userId === user?.id);
      if (myRow && myRow.fullName !== user?.fullName) updateUser({ fullName: myRow.fullName });
      setEditing(false);
      toast.success('Garage profile updated');
      return;
    }

    const byField = fieldErrors(res);
    const message = firstApiError(res, 'We couldn’t save the garage profile. Please try again.');
    const mapped: FormErrors = {
      name: byField.name,
      phone: byField.phoneNumber,
      email: byField.email,
      address: byField.address,
      yourName: byField.yourFullName,
      location:
        byField.latitude || byField.longitude || (/serve only|workshop pin/i.test(message) ? message : undefined),
    };
    if (Object.values(mapped).some(Boolean)) {
      setErrors(mapped);
      focusFirst(mapped);
    } else {
      setFormError(message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Workshop profile"
        description="Your workshop’s contact details and the people who can use this portal."
        actions={
          profile && canEdit ? (
            <Button variant="outline" onClick={openEdit} leftIcon={<Pencil className="h-4 w-4" />}>
              Edit profile
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : error || !profile ? (
        <ErrorState title="Couldn’t load the profile" error={error} onRetry={loadProfile} />
      ) : (
        <div className="space-y-5 sm:space-y-6">
          <section className="flex items-center gap-4 rounded-2xl border border-surface-200 bg-white p-4 shadow-card sm:p-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Building2 className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-navy-900">{profile.name}</h2>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {profile.isActive ? (
                  <Badge variant="green" dot>
                    Active partner
                  </Badge>
                ) : (
                  <Badge variant="neutral" dot>
                    Inactive
                  </Badge>
                )}
                {status && profile.status !== 'Verified' && profile.status !== 'Inactive' && (
                  <Badge variant={status.variant} dot>
                    {status.label}
                  </Badge>
                )}
              </div>
            </div>
          </section>

          <ListGroup title="Contact">
            <ListItem
              leading={<IconTile icon={Phone} tone="neutral" />}
              title={profile.phoneNumber ? formatIndianMobile(profile.phoneNumber) : 'Not set'}
              subtitle="Phone"
              href={profile.phoneNumber ? mobileTelHref(profile.phoneNumber) : undefined}
              hideChevron
            />
            <ListItem
              leading={<IconTile icon={Mail} tone="neutral" />}
              title={profile.email || 'Not set'}
              subtitle="Email"
              href={profile.email ? `mailto:${profile.email}` : undefined}
              hideChevron
            />
            <ListItem
              leading={<IconTile icon={MapPin} tone="neutral" />}
              title={<span className="whitespace-normal">{profile.address || 'Not set'}</span>}
              subtitle={hasLocation ? 'Address · open in Maps' : 'Address · workshop pin not set'}
              href={
                hasLocation
                  ? `https://www.google.com/maps/search/?api=1&query=${profile.latitude},${profile.longitude}`
                  : undefined
              }
            />
          </ListGroup>

          {status && (
            <ListGroup title="Verification">
              <ListItem
                leading={<IconTile icon={ShieldCheck} tone="neutral" />}
                title={
                  <span className="inline-flex items-center gap-2">
                    <Badge variant={status.variant} dot>
                      {status.label}
                    </Badge>
                  </span>
                }
                subtitle={<span className="whitespace-normal">{status.note} Only BroCo admins can change this.</span>}
              />
            </ListGroup>
          )}

          <ListGroup
            title={
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4 text-navy-400" />
                Team ({profile.teamMembers?.length ?? 0})
              </span>
            }
          >
            {profile.teamMembers && profile.teamMembers.length > 0 ? (
              profile.teamMembers.map((m) => (
                <ListItem
                  key={m.userId}
                  leading={<Avatar name={m.fullName || m.email} size="sm" />}
                  title={m.fullName || m.email}
                  subtitle={m.email}
                  meta={[m.title, humanize(m.roleName)].filter(Boolean).join(' · ')}
                />
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-navy-500">No team members linked to this workshop yet.</div>
            )}
          </ListGroup>

          {!canEdit && (
            <p className="text-sm text-navy-500">Only the garage owner or a manager can edit these details.</p>
          )}
        </div>
      )}

      <Modal
        isOpen={editing}
        onClose={closeEdit}
        title="Edit garage profile"
        description="Customers and the BroCo team use these details to find and reach your workshop."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={closeEdit} disabled={saving} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              type="submit"
              form="garage-profile-form"
              variant="primary"
              isLoading={saving}
              disabled={locating}
              className="w-full sm:w-auto"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        }
      >
        <form id="garage-profile-form" onSubmit={handleSave} noValidate className="space-y-4">
          {formError && (
            <Alert type="error" onClose={() => setFormError(null)}>
              {formError}
            </Alert>
          )}

          <Input
            ref={nameRef}
            id="garage-name"
            label="Garage name"
            autoComplete="organization"
            autoCapitalize="words"
            maxLength={120}
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            error={errors.name}
            aria-invalid={errors.name ? true : undefined}
            required
          />

          <PhoneInput
            ref={phoneRef}
            id="garage-phone"
            label="Contact phone"
            value={form.phone}
            onChange={(digits) => setField('phone', digits)}
            error={errors.phone}
            helperText={
              profile?.phoneNumber && !isValidIndianMobile(profile.phoneNumber)
                ? `The saved number ${profile.phoneNumber} isn’t an Indian mobile. Enter a new one.`
                : 'Customers and our advisors call this number.'
            }
            required
          />

          <Input
            ref={emailRef}
            id="garage-email"
            type="email"
            inputMode="email"
            label="Contact email"
            autoComplete="email"
            maxLength={200}
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            error={errors.email}
            aria-invalid={errors.email ? true : undefined}
            helperText="For bookings and invoices. Your sign-in email doesn’t change."
            required
          />

          <Textarea
            id="garage-address"
            label="Workshop address"
            rows={3}
            maxLength={500}
            autoComplete="street-address"
            placeholder="Shop no., street, area, city, PIN code"
            value={form.address}
            onChange={(e) => setField('address', e.target.value)}
            error={errors.address}
            required
          />

          <fieldset className="space-y-2 rounded-xl border border-surface-200 p-3 sm:p-4" aria-describedby="garage-pin-help">
            <legend className="px-1 text-sm font-medium text-navy-800">Workshop location</legend>
            <p id="garage-pin-help" className="text-xs text-navy-500">
              We match nearby customers to this pin. Stand at your workshop and use your current location.
            </p>
            <p className="text-sm text-navy-700 tabular-nums" aria-live="polite">
              {hasPin(form.latitude, form.longitude)
                ? `${form.latitude!.toFixed(5)}, ${form.longitude!.toFixed(5)}${pinMoved ? ' (new)' : ''}`
                : 'Not set yet'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={shareCurrentLocation}
                isLoading={locating}
                leftIcon={<Crosshair className="h-4 w-4" />}
              >
                {locating ? 'Finding you…' : 'Use my current location'}
              </Button>
              {pinMoved && (
                <Button type="button" variant="ghost" onClick={resetPin} disabled={locating}>
                  Keep saved pin
                </Button>
              )}
            </div>
            {errors.location && (
              <p role="alert" className="text-sm text-semantic-error">
                {errors.location}
              </p>
            )}
            {suggested && pinMoved && !errors.location && (
              <div className="rounded-lg bg-surface-50 px-3 py-2 text-sm text-navy-700">
                <p className="whitespace-normal break-words">{suggested.formattedAddress}</p>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    className="text-sm font-semibold text-electric-700 underline-offset-2 hover:underline"
                    onClick={() => {
                      setField('address', suggested.formattedAddress);
                      setSuggested(null);
                    }}
                  >
                    Use this address
                  </button>
                  <span className="text-xs text-navy-500">
                    {suggested.provider === 'OpenStreetMap' ? (
                      <>
                        Address data ©{' '}
                        <a
                          href="https://www.openstreetmap.org/copyright"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2"
                        >
                          OpenStreetMap contributors
                        </a>
                      </>
                    ) : (
                      'Address data © Google'
                    )}
                  </span>
                </div>
              </div>
            )}
          </fieldset>

          {me && (
            <Input
              id="garage-your-name"
              label="Your name"
              autoComplete="name"
              autoCapitalize="words"
              maxLength={100}
              value={form.yourName}
              onChange={(e) => setField('yourName', e.target.value)}
              error={errors.yourName}
              aria-invalid={errors.yourName ? true : undefined}
              helperText="Shown to your team in this portal."
            />
          )}

          <div className="flex items-start gap-2 rounded-xl bg-surface-50 px-3 py-2.5 text-xs text-navy-600">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" aria-hidden />
            <p>
              Verification status: <span className="font-semibold">{status?.label ?? 'Unknown'}</span>. BroCo admins verify
              garages.
              {profile?.isVerified && (nameChanged || pinMoved)
                ? ' A new name or location is shared with our team so they can re-check your listing; you stay verified.'
                : ''}
            </p>
          </div>
        </form>
      </Modal>
    </div>
  );
}
