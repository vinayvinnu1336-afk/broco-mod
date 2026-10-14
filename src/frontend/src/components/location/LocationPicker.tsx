'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, LocateFixed, MapPin, Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ServiceArea } from '@/lib/catalogue';
import { isDemoMode } from '@/lib/demo';
import {
  GMap,
  GMarker,
  GoogleMapsApi,
  GLatLng,
  hasGoogleMapsKey,
  loadGoogleMaps,
  loadPublicConfig,
  onGoogleMapsFailure,
  peekGoogleMapsKey,
  resolveGoogleMapsKey,
} from '@/components/location/googleMaps';
import { AddressLookup, isAddressLookupEnabled, lookupAddress } from '@/components/location/addressLookup';
import {
  distanceFromCentreKm,
  findLiveAreaFor,
  isPincodeFormatValid,
  isPincodeServed,
  knownLiveAreas,
  liveCitiesLabel,
} from '@/components/location/serviceArea';

// Ask for the runtime Maps key as soon as the booking page loads, so step 3 opens in the right mode.
if (typeof window !== 'undefined') void loadPublicConfig();

/** What the booking flow sends to the API. */
export interface LocationValue {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  /** True only when the pin and the address are known to describe the same place. */
  confirmed: boolean;
}

/** Address fields that "fill from location" may write. */
const FILL_FIELDS = ['house', 'street', 'area', 'city', 'state', 'pincode'] as const;
type FillField = (typeof FILL_FIELDS)[number];
type FillValues = Record<FillField, string>;

/** What the last autofill wrote, so a later fill can tell its own text apart from what the customer typed. */
export interface AddressAutofill {
  /** "Google" or "OpenStreetMap" (attribution). */
  provider: string;
  source: 'gps' | 'pin';
  latitude: number;
  longitude: number;
  values: FillValues;
}

/**
 * Everything the picker needs to remember between steps. The parent owns this object so nothing
 * typed is lost when the user goes back and forth.
 */
export interface LocationDraft {
  /** 'map' = Google Maps with search and a draggable pin, 'manual' = no usable Maps key (GPS pin + form). */
  mode: 'map' | 'manual';
  house: string;
  street: string;
  area: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string;
  autofill: AddressAutofill | null;
  /**
   * "area|pincode" the user confirmed against the current pin ('' = not confirmed). On the map an
   * address read from the pin itself counts as confirmed.
   */
  confirmedFor: string;
}

export function emptyLocationDraft(area: Pick<ServiceArea, 'city' | 'state'>): LocationDraft {
  return {
    mode: hasGoogleMapsKey() ? 'map' : 'manual',
    house: '',
    street: '',
    area: '',
    landmark: '',
    city: area.city,
    state: area.state,
    pincode: '',
    latitude: null,
    longitude: null,
    formattedAddress: '',
    autofill: null,
    confirmedFor: '',
  };
}

const confirmKey = (d: Pick<LocationDraft, 'area' | 'pincode'>) => `${d.area.trim().toLowerCase()}|${d.pincode.trim()}`;

export interface LocationErrors {
  pin?: string;
  house?: string;
  area?: string;
  city?: string;
  pincode?: string;
  confirm?: string;
}

export const OUTSIDE_AREA_MESSAGE = (area: ServiceArea) =>
  knownLiveAreas().length > 1
    ? `We're in ${liveCitiesLabel()} for now. This pin is outside the areas we serve — move it to where your car is, or check back soon as we add more cities.`
    : `We're in ${area.city} only for now. This pin is outside the area we serve — move it to where your car is in ${area.city}, or check back soon as we add more cities.`;

/**
 * The live city the pin is in; `area` (the city picked on the public site) until there is a pin.
 * Any live city is fine: a customer who picked Hyderabad can still book for a car in Bengaluru.
 */
export function areaForPin(d: Pick<LocationDraft, 'latitude' | 'longitude'>, area: ServiceArea): ServiceArea | null {
  if (d.latitude === null || d.longitude === null) return area;
  return findLiveAreaFor(d.latitude, d.longitude);
}

/** Client-side checks that must pass before the user can continue. Empty object = valid. */
export function validateLocation(d: LocationDraft, area: ServiceArea): LocationErrors {
  const errors: LocationErrors = {};
  const pinArea = areaForPin(d, area);
  if (d.latitude === null || d.longitude === null) {
    errors.pin =
      d.mode === 'map'
        ? 'Drop the pin where your car is: search, tap the map or use your current location.'
        : 'Tap “Use my current location” so we can pin where your car is.';
  } else if (!pinArea) {
    errors.pin = OUTSIDE_AREA_MESSAGE(area);
  }

  if (!d.house.trim()) errors.house = 'Enter your house, flat or building.';
  if (!d.area.trim()) errors.area = 'Enter your area or locality.';
  if (!d.city.trim()) errors.city = 'Enter your city.';

  const pin = d.pincode.trim();
  if (!pin) errors.pincode = 'Enter the 6-digit pincode.';
  else if (!isPincodeFormatValid(pin)) errors.pincode = 'Pincode must be 6 digits.';
  else if (!isPincodeServed(pinArea ?? area, pin)) errors.pincode = `This pincode is outside ${(pinArea ?? area).city}. Check the pincode or move the pin.`;

  if (!errors.pin && !errors.area && !errors.pincode && d.confirmedFor !== confirmKey(d)) {
    errors.confirm = d.confirmedFor
      ? 'You changed the area or pincode after confirming the pin. Please confirm your car is still at this pin.'
      : 'Please confirm your car is at this pin.';
  }
  return errors;
}

export function hasLocationErrors(errors: LocationErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function toLocationValue(d: LocationDraft, area: ServiceArea): LocationValue {
  const line1 = [d.house.trim(), d.street.trim()].filter(Boolean).join(', ');
  const line2 = [d.area.trim(), d.landmark.trim() ? `Near ${d.landmark.trim()}` : ''].filter(Boolean).join(', ');
  const cityArea = areaForPin(d, area) ?? area;
  return {
    addressLine1: line1,
    addressLine2: line2,
    city: d.city.trim() || cityArea.city,
    state: d.state.trim() || cityArea.state,
    pincode: d.pincode.trim(),
    latitude: d.latitude,
    longitude: d.longitude,
    confirmed: !hasLocationErrors(validateLocation(d, area)),
  };
}

/** One-line address for review screens. */
export function formatLocationDraft(d: LocationDraft): string {
  return [d.house, d.street, d.area, d.landmark ? `Near ${d.landmark}` : '', d.city, d.pincode]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ');
}

const currentValues = (d: LocationDraft): FillValues => ({
  house: d.house,
  street: d.street,
  area: d.area,
  city: d.city,
  state: d.state,
  pincode: d.pincode,
});

function fromLookup(a: AddressLookup): FillValues {
  const clip = (s: string | null | undefined, max: number) => (s ?? '').trim().slice(0, max);
  const pincode = (a.pincode ?? '').replace(/\D/g, '');
  return {
    house: clip(a.houseNumber, 120),
    street: clip(a.street, 120),
    area: clip(a.area, 120),
    city: clip(a.city, 60),
    state: clip(a.state, 60),
    pincode: pincode.length === 6 ? pincode : '',
  };
}

// Demo builds only: a quick way to pin a location in the chosen city on desktops without GPS.
const DEMO_PINS: Record<string, { lat: number; lng: number; label: string }> = {
  hyderabad: { lat: 17.4126, lng: 78.4482, label: 'Banjara Hills' },
  bengaluru: { lat: 12.9719, lng: 77.6412, label: 'Indiranagar' },
  mancherial: { lat: 18.87, lng: 79.446, label: 'Mancherial town' },
};

export interface LocationPickerProps {
  value: LocationDraft;
  onChange: (next: LocationDraft) => void;
  serviceArea: ServiceArea;
  /** Show validation messages (set after the user tries to continue). */
  showErrors?: boolean;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({ value, onChange, serviceArea, showErrors = false }) => {
  const valueRef = useRef(value);
  valueRef.current = value;
  const update = useCallback(
    (patch: Partial<LocationDraft>) => {
      // Keep the ref ahead of the re-render so two quick updates never undo each other.
      const next = { ...valueRef.current, ...patch };
      valueRef.current = next;
      onChange(next);
    },
    [onChange]
  );

  const [mapsKey, setMapsKey] = useState<string | undefined>(() => peekGoogleMapsKey());
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<'idle' | 'loading' | 'failed'>('idle');

  const errors = validateLocation(value, serviceArea);
  const visible = (key: keyof LocationErrors) => (showErrors ? errors[key] : undefined);

  const pinned = value.latitude !== null && value.longitude !== null;
  const pinArea = areaForPin(value, serviceArea);
  const outside = pinned && !pinArea;

  // The city/state start as the city picked on the public site. A pin in another live city moves them
  // there, unless the customer typed their own.
  const prefilledCity = !value.city.trim() || knownLiveAreas().some((a) => a.city === value.city.trim());
  useEffect(() => {
    if (pinArea && prefilledCity && value.city !== pinArea.city) update({ city: pinArea.city, state: pinArea.state });
  }, [pinArea, prefilledCity, value.city, update]);

  // ---------- Map or form: decided once the Maps key is known, so the wrong one never flashes ----------
  useEffect(() => {
    if (mapsKey !== undefined) return;
    let cancelled = false;
    void resolveGoogleMapsKey().then((key) => {
      if (!cancelled) setMapsKey(key);
    });
    return () => {
      cancelled = true;
    };
  }, [mapsKey]);

  const untouched =
    value.latitude === null && ![value.house, value.street, value.area, value.landmark, value.pincode].some((s) => s.trim());
  const wantedMode: LocationDraft['mode'] | null =
    mapsKey === undefined ? null : mapsKey && (value.mode === 'map' || untouched) ? 'map' : 'manual';
  useEffect(() => {
    // Leaving the map means the typed address must be confirmed against the pin again.
    if (wantedMode && wantedMode !== value.mode) update({ mode: wantedMode, confirmedFor: '' });
  }, [wantedMode, value.mode, update]);
  const showMap = wantedMode === 'map' && value.mode === 'map';

  useEffect(
    () =>
      onGoogleMapsFailure(() => {
        setMapsKey('');
        setMapsError('The map could not load. Please enter your address below.');
      }),
    []
  );

  // ---------- Address autofill (both modes) ----------
  const lookupSeq = useRef(0);
  // Answers that arrive after the step is closed are dropped.
  useEffect(
    () => () => {
      lookupSeq.current++;
    },
    []
  );

  const fillFromPin = useCallback(
    async (lat: number, lng: number, source: 'gps' | 'pin') => {
      const seq = ++lookupSeq.current;
      if (!findLiveAreaFor(lat, lng) || !isAddressLookupEnabled()) {
        setLookup('idle');
        return;
      }
      const before = currentValues(valueRef.current);
      setLookup('loading');
      const outcome = await lookupAddress(lat, lng);
      const cur = valueRef.current;
      if (seq !== lookupSeq.current || cur.latitude !== lat || cur.longitude !== lng) return;
      if (outcome.status !== 'found') {
        setLookup('failed');
        return;
      }
      setLookup('idle');

      const found = fromLookup(outcome.address);
      const previous = cur.autofill?.values;
      const patch: Partial<FillValues> = {};
      for (const f of FILL_FIELDS) {
        // Typed while we were looking up: what the customer typed wins.
        if (cur[f] !== before[f]) continue;
        const next = found[f];
        const stillOurs = !!previous && cur[f] === previous[f];
        if (f === 'house') {
          // Geocoders guess house numbers, so never replace a house/flat the customer typed.
          if (next ? !cur.house.trim() || stillOurs : stillOurs) patch.house = next;
        } else if (f === 'city' || f === 'state') {
          if (next) patch[f] = next;
        } else if (next || stillOurs) {
          patch[f] = next;
        }
      }
      const filled = { ...cur, ...patch };
      // On the map the customer sees the pin, so the pin's own address needs no extra confirmation.
      const pinsOwnAddress = !!found.area && !!found.pincode && filled.area === found.area && filled.pincode === found.pincode;
      update({
        ...patch,
        formattedAddress: outcome.address.formattedAddress,
        autofill: { provider: outcome.address.provider, source, latitude: lat, longitude: lng, values: found },
        ...(cur.mode === 'map' && pinsOwnAddress ? { confirmedFor: confirmKey(filled) } : {}),
      });
    },
    [update]
  );

  // ---------- Manual (no map) pinning ----------
  const pinManual = useCallback(
    (lat: number, lng: number) => {
      // A new pin always needs a fresh confirmation against the typed address.
      update({ latitude: lat, longitude: lng, confirmedFor: '' });
      void fillFromPin(lat, lng, 'gps');
    },
    [update, fillFromPin]
  );

  // ---------- Google Maps mode ----------
  const mapEl = useRef<HTMLDivElement>(null);
  const searchEl = useRef<HTMLDivElement>(null);
  const legacyInputEl = useRef<HTMLInputElement>(null);
  const mapsRef = useRef<GoogleMapsApi | null>(null);
  const mapRef = useRef<GMap | null>(null);
  const markerRef = useRef<GMarker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [useLegacySearch, setUseLegacySearch] = useState(false);

  const pinOnMap = useCallback(
    (lat: number, lng: number, opts: { pan?: boolean; source?: 'gps' | 'pin' } = {}) => {
      const maps = mapsRef.current;
      const map = mapRef.current;
      if (maps && map) {
        const pos = { lat, lng };
        if (!markerRef.current) {
          const marker = new maps.Marker({ position: pos, map, draggable: true, title: 'Your car' });
          marker.addListener('dragend', () => {
            const p = marker.getPosition();
            if (p) pinOnMapRef.current(Number(p.lat().toFixed(6)), Number(p.lng().toFixed(6)), { pan: false });
          });
          markerRef.current = marker;
        } else {
          markerRef.current.setPosition(pos);
        }
        if (opts.pan !== false) {
          map.panTo(pos);
          map.setZoom(17);
        }
      }
      update({ latitude: lat, longitude: lng, confirmedFor: '' });
      void fillFromPin(lat, lng, opts.source ?? 'pin');
    },
    [update, fillFromPin]
  );
  // Map listeners are bound once; they call the latest version through this ref.
  const pinOnMapRef = useRef(pinOnMap);
  pinOnMapRef.current = pinOnMap;

  // ---------- Current location (both modes) ----------
  const useCurrentLocation = () => {
    setGpsError(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('Your browser cannot share your location.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        if (valueRef.current.mode === 'map') pinOnMapRef.current(lat, lng, { source: 'gps' });
        else pinManual(lat, lng);
      },
      (err) => {
        setLocating(false);
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? 'Location access is blocked. Allow location for this site in your browser settings and try again.'
            : 'We could not get your location. Move to an open area or try again.'
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  useEffect(() => {
    if (!showMap) return;
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapEl.current) return;
        mapsRef.current = maps;
        const start = valueRef.current;
        const centre =
          start.latitude !== null && start.longitude !== null
            ? { lat: start.latitude, lng: start.longitude }
            : { lat: serviceArea.latitude, lng: serviceArea.longitude };
        const map = new maps.Map(mapEl.current, {
          center: centre,
          zoom: start.latitude !== null ? 17 : 11,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
        });
        mapRef.current = map;
        map.addListener('click', (e: { latLng?: GLatLng }) => {
          if (e.latLng) pinOnMapRef.current(Number(e.latLng.lat().toFixed(6)), Number(e.latLng.lng().toFixed(6)), { pan: false });
        });
        if (start.latitude !== null && start.longitude !== null) {
          const marker = new maps.Marker({ position: centre, map, draggable: true, title: 'Your car' });
          marker.addListener('dragend', () => {
            const p = marker.getPosition();
            if (p) pinOnMapRef.current(Number(p.lat().toFixed(6)), Number(p.lng().toFixed(6)), { pan: false });
          });
          markerRef.current = marker;
        }

        // Search box: Places API (New) element when available, else the legacy widget. India only, the chosen city first.
        const bias = { center: { lat: serviceArea.latitude, lng: serviceArea.longitude }, radius: serviceArea.radiusKm * 1000 };
        const PlaceAutocompleteElement = maps.places?.PlaceAutocompleteElement;
        if (PlaceAutocompleteElement && searchEl.current) {
          const el = new PlaceAutocompleteElement({ includedRegionCodes: ['in'], locationBias: bias });
          el.setAttribute('placeholder', 'Search your area, street or building');
          el.style.width = '100%';
          el.style.colorScheme = 'light';
          const onPicked = async (place: { fetchFields?: (o: { fields: string[] }) => Promise<unknown>; location?: GLatLng } | undefined) => {
            if (!place) return;
            try {
              if (place.fetchFields) await place.fetchFields({ fields: ['location'] });
              if (place.location) pinOnMapRef.current(Number(place.location.lat().toFixed(6)), Number(place.location.lng().toFixed(6)));
            } catch {
              setMapsError('Could not open that place. Try tapping the map instead.');
            }
          };
          el.addEventListener('gmp-select', (ev: Event) => {
            const e = ev as Event & { placePrediction?: { toPlace(): Parameters<typeof onPicked>[0] } };
            void onPicked(e.placePrediction?.toPlace());
          });
          el.addEventListener('gmp-placeselect', (ev: Event) => {
            void onPicked((ev as Event & { place?: Parameters<typeof onPicked>[0] }).place);
          });
          searchEl.current.replaceChildren(el);
        } else if (maps.places?.Autocomplete) {
          setUseLegacySearch(true);
        }
        setMapReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        // Falls back to the form (the mode effect switches once the key is cleared).
        setMapsKey('');
        setMapsError('The map could not load. Please enter your address below.');
      });
    return () => {
      cancelled = true;
      mapRef.current = null;
      markerRef.current = null;
      setMapReady(false);
    };
    // The map is created once each time map mode is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMap]);

  // Legacy Places widget needs a real <input>, rendered only when the new element is unavailable.
  useEffect(() => {
    const maps = mapsRef.current;
    if (!useLegacySearch || !maps?.places?.Autocomplete || !legacyInputEl.current) return;
    const ac = new maps.places.Autocomplete(legacyInputEl.current, {
      componentRestrictions: { country: 'in' },
      fields: ['geometry'],
      bounds: {
        north: serviceArea.latitude + 0.4,
        south: serviceArea.latitude - 0.4,
        east: serviceArea.longitude + 0.4,
        west: serviceArea.longitude - 0.4,
      },
      strictBounds: false,
    });
    const listener = ac.addListener('place_changed', () => {
      const loc = ac.getPlace()?.geometry?.location;
      if (loc) pinOnMapRef.current(Number(loc.lat().toFixed(6)), Number(loc.lng().toFixed(6)));
    });
    return () => listener.remove();
  }, [useLegacySearch, serviceArea.latitude, serviceArea.longitude]);

  // =========================== Shared pieces ===========================
  const gpsButton = (
    <button
      type="button"
      onClick={useCurrentLocation}
      disabled={locating}
      className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-electric-200 bg-electric-50 px-4 text-sm font-semibold text-electric-700 transition hover:bg-electric-100 disabled:opacity-70 touch-manipulation"
    >
      {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
      {locating ? 'Finding your location…' : 'Use my current location'}
    </button>
  );

  const outsideAlert = outside && (
    <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <span>{OUTSIDE_AREA_MESSAGE(serviceArea)}</span>
    </div>
  );

  const fill = value.autofill;
  const fillIsForThisPin = !!fill && fill.latitude === value.latitude && fill.longitude === value.longitude;
  const fillStatus =
    !pinned || outside ? null : lookup === 'loading' ? (
      <div role="status" className="flex items-center gap-2 rounded-xl bg-surface-50 px-3 py-2.5 text-sm text-navy-600">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-electric-600" />
        Filling in the address…
      </div>
    ) : lookup === 'failed' ? (
      <div role="status" className="flex items-start gap-2 rounded-xl bg-surface-50 px-3 py-2.5 text-sm text-navy-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" />
        We couldn&apos;t fill in the address for this spot. Please type it below.
      </div>
    ) : fillIsForThisPin ? (
      <div role="status" className="flex items-start gap-2.5 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <p>{fill!.source === 'gps' ? 'Filled from your location' : 'Filled from the pin'} — please check.</p>
          {fill!.provider === 'OpenStreetMap' && (
            <p className="mt-0.5 text-xs text-emerald-800">
              Address data ©{' '}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                OpenStreetMap contributors
              </a>
            </p>
          )}
          {fill!.provider === 'Google' && !showMap && <p className="mt-0.5 text-xs text-emerald-800">Address data © Google</p>}
        </div>
      </div>
    ) : null;

  const addressCard = (
    <div className="space-y-4 rounded-2xl border border-surface-200 bg-white p-4 shadow-card sm:p-5">
      {fillStatus}
      <Input
        id="loc-house"
        label="House / flat / building"
        value={value.house}
        onChange={(e) => update({ house: e.target.value })}
        placeholder="e.g. Flat 302, Green Meadows Apartments"
        autoComplete="address-line1"
        maxLength={120}
        error={visible('house')}
        required
      />
      <Input
        id="loc-street"
        label="Street / colony (optional)"
        value={value.street}
        onChange={(e) => update({ street: e.target.value })}
        placeholder="e.g. Road No. 12, Sri Ram Nagar Colony"
        autoComplete="address-line2"
        maxLength={120}
      />
      <Input
        id="loc-area"
        label="Area / locality"
        value={value.area}
        onChange={(e) => update({ area: e.target.value })}
        placeholder="e.g. Madhapur"
        autoComplete="address-line3"
        maxLength={120}
        error={visible('area')}
        required
      />
      <Input
        id="loc-landmark"
        label="Landmark (optional)"
        value={value.landmark}
        onChange={(e) => update({ landmark: e.target.value })}
        placeholder="e.g. Near Inorbit Mall"
        maxLength={80}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          id="loc-city"
          label="City"
          value={value.city}
          onChange={(e) => update({ city: e.target.value })}
          autoComplete="address-level2"
          maxLength={60}
          error={visible('city')}
          required
        />
        <Input
          id="loc-state"
          label="State"
          value={value.state}
          onChange={(e) => update({ state: e.target.value })}
          autoComplete="address-level1"
          maxLength={60}
        />
        <Input
          id="loc-pincode"
          label="Pincode"
          value={value.pincode}
          onChange={(e) => update({ pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="500081"
          error={visible('pincode') || (value.pincode.length === 6 ? errors.pincode : undefined)}
          required
        />
      </div>
    </div>
  );

  // Pin <-> address confirmation. On the map it is only needed when the address no longer comes from the pin.
  const confirmed = pinned && !outside && value.confirmedFor !== '' && value.confirmedFor === confirmKey(value);
  const changedAfterConfirm = pinned && !outside && value.confirmedFor !== '' && value.confirmedFor !== confirmKey(value);
  const centreArea = pinArea ?? serviceArea;
  const readyToConfirm = pinned && !outside && !!value.area.trim() && isPincodeServed(centreArea, value.pincode);
  const distance = pinned ? distanceFromCentreKm(centreArea, value.latitude!, value.longitude!) : null;
  const showConfirmCard = showMap
    ? lookup !== 'loading' && !confirmed && (readyToConfirm || changedAfterConfirm)
    : pinned && !outside && (confirmed || readyToConfirm || changedAfterConfirm);

  const confirmCard = showConfirmCard && (
    <div
      role={changedAfterConfirm ? 'alert' : undefined}
      className={`rounded-2xl border p-4 ${
        confirmed
          ? 'border-emerald-200 bg-emerald-50'
          : changedAfterConfirm
          ? 'border-amber-200 bg-amber-50'
          : 'border-electric-200 bg-electric-50'
      }`}
    >
      {confirmed ? (
        <div className="flex items-start gap-2.5 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            You confirmed your car is at this pin in <strong>{value.area.trim()}</strong>, {value.pincode}.
          </span>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2.5 text-sm">
            {changedAfterConfirm ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-electric-600" />
            )}
            <div className={changedAfterConfirm ? 'text-amber-900' : 'text-navy-800'}>
              <div className="font-semibold">
                {changedAfterConfirm ? 'You changed the address after pinning' : 'Is your car at this pin?'}
              </div>
              <p className="mt-0.5">
                {changedAfterConfirm
                  ? `The pin was confirmed for a different area or pincode. Is your car still at this pin in ${value.area.trim() || 'this area'}, ${value.pincode || '—'}? If not, re-pin from where the car is.`
                  : `We will send garages to the pin (${distance!.toFixed(1)} km from ${centreArea.city} centre). Make sure it is the same place as ${value.area.trim()}, ${value.pincode}.`}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => update({ confirmedFor: confirmKey(valueRef.current) })}
              disabled={!readyToConfirm}
            >
              Yes, it&apos;s here
            </Button>
            <Button variant="outline" size="md" onClick={useCurrentLocation} isLoading={locating}>
              Re-pin
            </Button>
          </div>
        </>
      )}
    </div>
  );
  const confirmError = showErrors && errors.confirm && !showConfirmCard && (
    <p className="text-sm text-semantic-error">{errors.confirm}</p>
  );

  // Still finding out whether a Maps key exists (or switching mode): hold the space instead of flashing a form.
  if (!wantedMode || wantedMode !== value.mode) {
    return (
      <div
        role="status"
        className="flex min-h-[160px] items-center justify-center gap-2 rounded-2xl border border-surface-200 bg-white text-sm text-navy-500 shadow-card"
      >
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  // =========================== MAP MODE ===========================
  if (showMap) {
    return (
      <div className="space-y-4">
        <div className="space-y-3 rounded-2xl border border-surface-200 bg-white p-3 shadow-card sm:p-4">
          {useLegacySearch ? (
            <label className="relative block">
              <span className="sr-only">Search address</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
              <input
                ref={legacyInputEl}
                placeholder="Search your area, street or building"
                className="h-11 w-full rounded-xl border border-surface-200 bg-surface-50 pl-9 pr-3 text-base text-navy-900 outline-none focus:border-electric-500 focus:bg-white focus:ring-2 focus:ring-electric-100"
              />
            </label>
          ) : (
            <div ref={searchEl} className="min-h-[44px]" aria-label="Search address" />
          )}

          <div className="relative overflow-hidden rounded-xl border border-surface-200 bg-surface-100">
            <div ref={mapEl} className="h-[260px] w-full sm:h-[320px]" role="application" aria-label="Map: tap or drag the pin to where your car is" />
            {!mapReady && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-navy-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading map…
              </div>
            )}
            {mapReady && !pinned && (
              <div className="pointer-events-none absolute inset-x-3 top-3 rounded-lg bg-white/95 px-3 py-2 text-center text-xs font-medium text-navy-700 shadow-card">
                Tap the map to drop a pin where your car is
              </div>
            )}
          </div>
          {mapReady && pinned && <p className="text-xs text-navy-400">Drag the pin or tap the map to move it.</p>}

          {gpsButton}
          {gpsError && <p className="text-sm text-semantic-error">{gpsError}</p>}
          {mapsError && <p className="text-sm text-semantic-error">{mapsError}</p>}
        </div>

        {outsideAlert}
        {!outside && visible('pin') && <p className="text-sm text-semantic-error">{errors.pin}</p>}
        {addressCard}
        {confirmCard}
        {confirmError}
      </div>
    );
  }

  // =========================== MANUAL MODE ===========================
  const demoPin = DEMO_PINS[serviceArea.city.toLowerCase()] ?? DEMO_PINS.hyderabad;
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-surface-200 bg-white p-4 shadow-card sm:p-5">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              !pinned ? 'bg-surface-100 text-navy-400' : outside ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            <MapPin className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-navy-900">
              {pinned ? (outside ? 'Pinned outside our area' : 'Location pinned') : 'Pin where your car is'}
            </div>
            <div className="mt-0.5 text-sm text-navy-500">
              {pinned
                ? `${value.latitude!.toFixed(5)}, ${value.longitude!.toFixed(5)} · ${distance!.toFixed(1)} km from ${centreArea.city} centre`
                : 'Stand near your car and share your location. We fill in the address and match garages close to it.'}
            </div>
          </div>
        </div>
        {gpsButton}
        {gpsError && <p className="text-sm text-semantic-error">{gpsError}</p>}
        {isDemoMode && (
          <button
            type="button"
            onClick={() => pinManual(demoPin.lat, demoPin.lng)}
            className="min-h-[36px] text-xs font-medium text-navy-500 underline underline-offset-2"
          >
            Demo: pin {demoPin.label}, {DEMO_PINS[serviceArea.city.toLowerCase()] ? serviceArea.city : 'Hyderabad'}
          </button>
        )}
        {!outside && visible('pin') && <p className="text-sm text-semantic-error">{errors.pin}</p>}
      </div>

      {outsideAlert}
      {mapsError && <p className="text-sm text-semantic-error">{mapsError}</p>}
      {addressCard}
      {confirmCard}
      {confirmError}

      {isDemoMode && (
        <p className="flex items-start gap-1.5 text-xs text-navy-400">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          Map search turns on when a Google Maps key is configured.
        </p>
      )}
    </div>
  );
};
