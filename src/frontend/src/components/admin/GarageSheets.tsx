'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Mail, MailX, MapPin, Wand2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ServiceArea } from '@/lib/catalogue';
import { formatIndianMobile, isValidIndianMobile, toIndianMobile } from '@/lib/phone';
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT } from '@/lib/password';
import { AdminGarageList, CreatedGarageAccount } from '@/types/adminOperations';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ChoiceChips, FormError, ToggleField } from '@/components/admin/FormControls';
import { CopyButton } from '@/components/admin/AdvisorSheets';
import { GLatLng, GMap, GMarker, hasGoogleMapsKey, loadGoogleMaps, loadPublicConfig } from '@/components/location/googleMaps';
import { isAddressLookupEnabled, lookupAddress } from '@/components/location/addressLookup';
import { findLiveAreaFor, liveCitiesLabel, useLiveServiceAreas } from '@/components/location/serviceArea';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Field =
  | 'garageName'
  | 'ownerName'
  | 'ownerMobile'
  | 'ownerEmail'
  | 'garagePhone'
  | 'garageEmail'
  | 'address'
  | 'pin'
  | 'city'
  | 'password';
type FieldErrors = Partial<Record<Field, string>>;

function parseCoordinate(raw: string, min: number, max: number): number | null {
  const text = raw.trim();
  if (!/^-?\d{1,3}(\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/** "17.4485, 78.3908" (as copied from Google Maps) split into its two numbers. */
function splitPastedPair(raw: string): [string, string] | null {
  const m = raw.trim().match(/^(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  return m ? [m[1], m[2]] : null;
}

// ==========================================
// Workshop pin: map (when Google Maps is set up) or typed coordinates
// ==========================================

function PinMap({
  lat,
  lng,
  area,
  onPick,
}: {
  lat: number | null;
  lng: number | null;
  area: ServiceArea;
  onPick: (lat: number, lng: number) => void;
}) {
  const el = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GMap | null>(null);
  const markerRef = useRef<GMarker | null>(null);
  const mapsRef = useRef<Awaited<ReturnType<typeof loadGoogleMaps>> | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [failed, setFailed] = useState(false);

  const place = (position: { lat: number; lng: number }) => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;
    if (markerRef.current) {
      markerRef.current.setPosition(position);
      return;
    }
    const marker = new maps.Marker({ position, map, draggable: true, title: 'Workshop' });
    marker.addListener('dragend', () => {
      const p = marker.getPosition();
      if (p) onPickRef.current(Number(p.lat().toFixed(6)), Number(p.lng().toFixed(6)));
    });
    markerRef.current = marker;
  };

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !el.current) return;
        mapsRef.current = maps;
        const start = lat !== null && lng !== null ? { lat, lng } : { lat: area.latitude, lng: area.longitude };
        const map = new maps.Map(el.current, {
          center: start,
          zoom: lat !== null ? 16 : 11,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
        });
        mapRef.current = map;
        map.addListener('click', (e: { latLng?: GLatLng }) => {
          if (e.latLng) onPickRef.current(Number(e.latLng.lat().toFixed(6)), Number(e.latLng.lng().toFixed(6)));
        });
        if (lat !== null && lng !== null) place(start);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // The map is created once; later pins move the marker below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (lat === null || lng === null || !mapRef.current) return;
    place({ lat, lng });
    mapRef.current.panTo({ lat, lng });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  // Re-centre on the city when the admin picks another one before there is a pin.
  useEffect(() => {
    if (lat === null && mapRef.current) mapRef.current.setCenter({ lat: area.latitude, lng: area.longitude });
  }, [area, lat]);

  if (failed) return null;
  return (
    <div
      ref={el}
      className="h-56 w-full overflow-hidden rounded-xl border border-surface-200 bg-surface-100"
      role="application"
      aria-label="Map: tap to place the workshop pin, drag the pin to move it"
    />
  );
}

// ==========================================
// Add garage
// ==========================================

export function AddGarageSheet({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Called after the garage is created, so the list can refresh. */
  onCreated: (garage: AdminGarageList) => void;
}) {
  const areas = useLiveServiceAreas();
  const [garageName, setGarageName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerMobile, setOwnerMobile] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [sameContact, setSameContact] = useState(true);
  const [garagePhone, setGaragePhone] = useState('');
  const [garageEmail, setGarageEmail] = useState('');
  const [address, setAddress] = useState('');
  const [latText, setLatText] = useState('');
  const [lngText, setLngText] = useState('');
  const [city, setCity] = useState('');
  const [cityTouched, setCityTouched] = useState(false);
  const [verified, setVerified] = useState(true);
  const [passwordMode, setPasswordMode] = useState<'generate' | 'set'>('generate');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupNote, setLookupNote] = useState<string | null>(null);
  const [mapsReady, setMapsReady] = useState(() => hasGoogleMapsKey());
  const [created, setCreated] = useState<CreatedGarageAccount | null>(null);
  const [formKey, setFormKey] = useState(0);
  const clearError = (key: Field) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  useEffect(() => {
    if (!isOpen) return;
    setGarageName('');
    setOwnerName('');
    setOwnerMobile('');
    setOwnerEmail('');
    setSameContact(true);
    setGaragePhone('');
    setGarageEmail('');
    setAddress('');
    setLatText('');
    setLngText('');
    setCity('');
    setCityTouched(false);
    setVerified(true);
    setPasswordMode('generate');
    setPassword('');
    setShowPassword(false);
    setErrors({});
    setFormError(null);
    setLookupNote(null);
    setCreated(null);
    setFormKey((k) => k + 1);
    void loadPublicConfig().then(() => setMapsReady(hasGoogleMapsKey()));
  }, [isOpen]);

  const lat = parseCoordinate(latText, -90, 90);
  const lng = parseCoordinate(lngText, -180, 180);
  const pinArea = lat !== null && lng !== null ? findLiveAreaFor(lat, lng, areas) : null;
  const mapArea = areas.find((a) => a.city === city) ?? pinArea ?? areas[0];

  // The city follows the pin until the admin picks one themselves.
  useEffect(() => {
    if (!cityTouched && pinArea) setCity(pinArea.city);
  }, [pinArea, cityTouched]);

  const cityOptions = useMemo(() => areas.map((a) => ({ value: a.city, label: a.city })), [areas]);

  const setPin = (newLat: number, newLng: number) => {
    setLatText(String(newLat));
    setLngText(String(newLng));
    clearError('pin');
    setLookupNote(null);
  };

  const fillAddressFromPin = async () => {
    if (lat === null || lng === null) return;
    setLookingUp(true);
    setLookupNote(null);
    const result = await lookupAddress(lat, lng);
    setLookingUp(false);
    if (result.status === 'found') {
      setAddress(result.address.formattedAddress.slice(0, 500));
      clearError('address');
    } else {
      setLookupNote(result.status === 'none' ? 'No address found for this pin. Type it in.' : 'Address lookup is not available right now.');
    }
  };

  const close = () => {
    if (saving) return;
    setCreated(null);
    setPassword('');
    onClose();
  };

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    const name = garageName.trim();
    if (name.length < 2 || name.length > 120) e.garageName = 'Enter the garage name (2 to 120 characters)';
    if (ownerName.trim().length < 2) e.ownerName = "Enter the owner's full name";
    if (!isValidIndianMobile(ownerMobile)) e.ownerMobile = 'Enter a valid 10-digit mobile number';
    if (!EMAIL_PATTERN.test(ownerEmail.trim())) e.ownerEmail = 'Enter a valid email address';
    if (!sameContact) {
      if (garagePhone && !isValidIndianMobile(garagePhone)) e.garagePhone = 'Enter a valid 10-digit number';
      if (garageEmail.trim() && !EMAIL_PATTERN.test(garageEmail.trim())) e.garageEmail = 'Enter a valid email address';
    }
    if (address.trim().length < 5) e.address = 'Enter the workshop address';
    if (lat === null || lng === null) e.pin = 'Set the workshop pin: tap the map or enter latitude and longitude';
    else if (!pinArea) e.pin = `This pin is outside our cities. Pin the workshop inside ${liveCitiesLabel(areas)}.`;
    if (!city) e.city = 'Choose the city';
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
    const res = await apiFetch<CreatedGarageAccount>('/admin/garages', {
      method: 'POST',
      body: JSON.stringify({
        garageName: garageName.trim(),
        ownerFullName: ownerName.trim(),
        ownerMobile: toIndianMobile(ownerMobile),
        ownerEmail: ownerEmail.trim(),
        garagePhone: !sameContact && garagePhone ? toIndianMobile(garagePhone) : null,
        garageEmail: !sameContact && garageEmail.trim() ? garageEmail.trim() : null,
        address: address.trim(),
        latitude: lat,
        longitude: lng,
        city,
        verified,
        password: passwordMode === 'set' ? password : null,
      }),
    });
    setSaving(false);

    if (res.success && res.data) {
      setPassword('');
      setCreated(res.data);
      onCreated(res.data.garage);
      return;
    }
    const code = res.errors?.[0];
    if (code === 'MOBILE_TAKEN' && res.message?.toLowerCase().includes('garage phone')) setErrors({ garagePhone: res.message });
    else if (code === 'MOBILE_TAKEN') setErrors({ ownerMobile: res.message });
    else if (code === 'EMAIL_TAKEN') setErrors({ ownerEmail: res.message });
    else setFormError(res.message || 'Could not add the garage.');
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

  const footer = created ? (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Link href={`/admin/garages/${created.garage.id}`} className="w-full sm:w-auto">
        <Button variant="outline" className="w-full sm:w-auto">
          Open garage
        </Button>
      </Link>
      <Button onClick={close} className="w-full sm:w-auto">
        Done
      </Button>
    </div>
  ) : (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="outline" onClick={close} disabled={saving} className="w-full sm:w-auto">
        Cancel
      </Button>
      <Button type="submit" form="add-garage-form" isLoading={saving} className="w-full sm:w-auto">
        Add garage
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      size="lg"
      title={created ? 'Garage added' : 'Add garage'}
      description={created ? undefined : 'Creates the garage and its owner account. The owner signs in with their mobile number.'}
      footer={footer}
    >
      {!created && (
        <form key={formKey} id="add-garage-form" onSubmit={submit} className="space-y-5" noValidate>
          <FormError message={formError} />

          <section className="space-y-4" aria-labelledby="garage-owner-heading">
            <h3 id="garage-owner-heading" className="text-sm font-semibold text-navy-900">
              Garage and owner
            </h3>
            <Input
              id="garage-name"
              label="Garage name"
              autoComplete="off"
              maxLength={120}
              value={garageName}
              onChange={(e) => {
                setGarageName(e.target.value);
                clearError('garageName');
              }}
              error={errors.garageName}
              required
            />
            <Input
              id="garage-owner-name"
              label="Owner's full name"
              autoComplete="off"
              maxLength={100}
              value={ownerName}
              onChange={(e) => {
                setOwnerName(e.target.value);
                clearError('ownerName');
              }}
              error={errors.ownerName}
              required
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <PhoneInput
                id="garage-owner-mobile"
                label="Owner's mobile"
                autoComplete="off"
                value={ownerMobile}
                onChange={(v) => {
                  setOwnerMobile(v);
                  clearError('ownerMobile');
                }}
                error={errors.ownerMobile}
                helperText="Used to sign in"
                required
              />
              <Input
                id="garage-owner-email"
                label="Owner's email"
                type="email"
                inputMode="email"
                autoComplete="off"
                maxLength={200}
                value={ownerEmail}
                onChange={(e) => {
                  setOwnerEmail(e.target.value);
                  clearError('ownerEmail');
                }}
                error={errors.ownerEmail}
                helperText="The welcome email goes here"
                required
              />
            </div>
            <ToggleField
              label="Garage phone and email are the owner's"
              description="Turn off to give the garage its own contact details."
              checked={sameContact}
              onChange={setSameContact}
            />
            {!sameContact && (
              <div className="grid gap-4 sm:grid-cols-2">
                <PhoneInput
                  id="garage-phone"
                  label="Garage phone"
                  autoComplete="off"
                  value={garagePhone}
                  onChange={(v) => {
                    setGaragePhone(v);
                    clearError('garagePhone');
                  }}
                  error={errors.garagePhone}
                  helperText="Leave empty to use the owner's"
                />
                <Input
                  id="garage-email"
                  label="Garage email"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  maxLength={200}
                  value={garageEmail}
                  onChange={(e) => {
                    setGarageEmail(e.target.value);
                    clearError('garageEmail');
                  }}
                  error={errors.garageEmail}
                  helperText="Leave empty to use the owner's"
                />
              </div>
            )}
          </section>

          <section className="space-y-4" aria-labelledby="garage-location-heading">
            <h3 id="garage-location-heading" className="text-sm font-semibold text-navy-900">
              Workshop location
            </h3>
            {mapsReady && <PinMap lat={lat} lng={lng} area={mapArea} onPick={setPin} />}
            <div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  id="garage-lat"
                  label="Latitude"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="17.4485"
                  value={latText}
                  onChange={(e) => {
                    const pair = splitPastedPair(e.target.value);
                    if (pair) {
                      setLatText(pair[0]);
                      setLngText(pair[1]);
                    } else {
                      setLatText(e.target.value);
                    }
                    clearError('pin');
                  }}
                />
                <Input
                  id="garage-lng"
                  label="Longitude"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="78.3908"
                  value={lngText}
                  onChange={(e) => {
                    setLngText(e.target.value);
                    clearError('pin');
                  }}
                />
              </div>
              <p className="mt-1.5 text-xs text-navy-500">
                {mapsReady
                  ? 'Tap the map or drag the pin, or paste coordinates such as “17.4485, 78.3908” from Google Maps.'
                  : 'Paste coordinates such as “17.4485, 78.3908” from Google Maps (long-press the workshop there).'}
              </p>
              {errors.pin ? (
                <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-red-600">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {errors.pin}
                </p>
              ) : lat !== null && lng !== null ? (
                pinArea ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Inside {pinArea.city}
                  </p>
                ) : (
                  <p className="mt-1.5 flex items-start gap-1.5 text-sm text-amber-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    Outside our cities ({liveCitiesLabel(areas)})
                  </p>
                )
              ) : null}
            </div>
            <div className="space-y-2">
              <Textarea
                id="garage-address"
                label="Address"
                rows={2}
                maxLength={500}
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  clearError('address');
                }}
                placeholder="Plot, street, area, city and pincode"
                error={errors.address}
                required
              />
              {isAddressLookupEnabled() && lat !== null && lng !== null && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={fillAddressFromPin}
                    disabled={lookingUp}
                    leftIcon={lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  >
                    Fill address from the pin
                  </Button>
                  {lookupNote && <span className="text-xs text-navy-500">{lookupNote}</span>}
                </div>
              )}
            </div>
            <Select
              id="garage-city"
              label="City"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setCityTouched(true);
                clearError('city');
              }}
              placeholder="Choose a city"
              options={cityOptions}
              error={errors.city}
              helperText={
                pinArea && city && city !== pinArea.city
                  ? `The pin is in ${pinArea.city}. The garage gets ${city}'s bookings and advisors.`
                  : "Set from the pin. The garage gets this city's bookings and advisors."
              }
              required
            />
          </section>

          <section className="space-y-4" aria-labelledby="garage-account-heading">
            <h3 id="garage-account-heading" className="text-sm font-semibold text-navy-900">
              Account
            </h3>
            <ToggleField
              label="Verified now"
              description={verified ? 'The garage starts getting bookings straight away.' : 'It stays out of bookings until you verify it.'}
              checked={verified}
              onChange={setVerified}
            />
            <ChoiceChips
              label="Owner's password"
              options={[
                { value: 'generate', label: 'Generate a temporary password' },
                { value: 'set', label: 'Set a password' },
              ]}
              value={[passwordMode]}
              onChange={(v) => setPasswordMode((v[0] as 'generate' | 'set') ?? passwordMode)}
            />
            {passwordMode === 'set' ? (
              <Input
                id="garage-password"
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
              <p className="text-sm text-navy-500">We&apos;ll make a 12-character password and show it to you once.</p>
            )}
          </section>
        </form>
      )}

      {created && (
        <div className="space-y-4">
          <p className="text-sm text-navy-700">
            <span className="font-semibold text-navy-900">{created.garage.name}</span> is listed in{' '}
            <span className="font-semibold text-navy-900">{created.garage.city || 'its city'}</span>
            {created.garage.status === 'PendingVerification' || String(created.garage.status) === '1'
              ? ' and waits for verification.'
              : ' and can take bookings now.'}{' '}
            {created.ownerName} signs in as the owner.
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
          <div className={`flex items-start gap-2 text-sm ${created.welcomeEmailSent ? 'text-emerald-700' : 'text-navy-600'}`}>
            {created.welcomeEmailSent ? (
              <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <MailX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>{created.welcomeEmailStatus}</span>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ==========================================
// Change a garage's city
// ==========================================

export function ChangeGarageCitySheet({
  garage,
  onClose,
  onSaved,
}: {
  garage: { id: string; name: string; city?: string } | null;
  onClose: () => void;
  onSaved: (garage: AdminGarageList) => void;
}) {
  const areas = useLiveServiceAreas();
  const [city, setCity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!garage) return;
    setCity(garage.city ?? '');
    setError(null);
  }, [garage]);

  const close = () => {
    if (!saving) onClose();
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!garage) return;
    if (!city) {
      setError('Choose a city.');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await apiFetch<AdminGarageList>(`/admin/garages/${garage.id}/city`, {
      method: 'PUT',
      body: JSON.stringify({ city }),
    });
    setSaving(false);
    if (res.success && res.data) onSaved(res.data);
    else setError(res.message || 'Could not change the city.');
  };

  const options = areas.map((a) => ({ value: a.city, label: a.city }));
  if (garage?.city && !options.some((o) => o.value === garage.city)) options.unshift({ value: garage.city, label: garage.city });

  return (
    <Modal
      isOpen={!!garage}
      onClose={close}
      size="sm"
      title="Change city"
      description={garage?.name}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={close} disabled={saving} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="submit" form="garage-city-form" isLoading={saving} className="w-full sm:w-auto">
            Save
          </Button>
        </div>
      }
    >
      <form id="garage-city-form" onSubmit={save} className="space-y-4" noValidate>
        <FormError message={error} />
        <Select
          id="garage-city-change"
          label="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Choose a city"
          options={options}
          required
        />
        <p className="flex items-start gap-2 text-sm text-navy-600">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" aria-hidden="true" />
          New bookings come only from this city, and only this city&apos;s advisors see the garage. Jobs it already has
          are not moved.
        </p>
      </form>
    </Modal>
  );
}
