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
  parseGeocoderResults,
} from '@/components/location/googleMaps';
import {
  distanceFromCentreKm,
  isInsideArea,
  isPincodeFormatValid,
  isPincodeServed,
} from '@/components/location/serviceArea';

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

/**
 * Everything the picker needs to remember between steps. The parent owns this object so nothing
 * typed is lost when the user goes back and forth.
 */
export interface LocationDraft {
  /** 'map' = Google Maps (address comes from the pin), 'manual' = no Maps key / Maps failed to load. */
  mode: 'map' | 'manual';
  house: string;
  landmark: string;
  /** Street from reverse geocoding (map mode only). */
  street: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string;
  /** Map mode: area/city/pincode were filled from the current pin. */
  geocoded: boolean;
  /** Map mode: the geocoder returned no pincode, so the user may type one. */
  pincodeEditable: boolean;
  /** Manual mode: "area|pincode" the user confirmed against the current pin ('' = not confirmed). */
  confirmedFor: string;
}

export function emptyLocationDraft(area: Pick<ServiceArea, 'city' | 'state'>): LocationDraft {
  return {
    mode: hasGoogleMapsKey() ? 'map' : 'manual',
    house: '',
    landmark: '',
    street: '',
    area: '',
    city: area.city,
    state: area.state,
    pincode: '',
    latitude: null,
    longitude: null,
    formattedAddress: '',
    geocoded: false,
    pincodeEditable: false,
    confirmedFor: '',
  };
}

const confirmKey = (d: Pick<LocationDraft, 'area' | 'pincode'>) => `${d.area.trim().toLowerCase()}|${d.pincode.trim()}`;

export interface LocationErrors {
  pin?: string;
  house?: string;
  area?: string;
  pincode?: string;
  confirm?: string;
}

export const OUTSIDE_AREA_MESSAGE = (area: ServiceArea) =>
  `We're in ${area.city} only for now. This pin is outside the area we serve — move it to where your car is in ${area.city}, or check back soon as we add more cities.`;

/** Client-side checks that must pass before the user can continue. Empty object = valid. */
export function validateLocation(d: LocationDraft, area: ServiceArea): LocationErrors {
  const errors: LocationErrors = {};
  if (d.latitude === null || d.longitude === null) {
    errors.pin =
      d.mode === 'map'
        ? 'Drop the pin where your car is: search, tap the map or use your current location.'
        : 'Tap “Use my current location” so we can pin where your car is.';
  } else if (!isInsideArea(area, d.latitude, d.longitude)) {
    errors.pin = OUTSIDE_AREA_MESSAGE(area);
  } else if (d.mode === 'map' && !d.geocoded) {
    errors.pin = 'Finding the address for this pin…';
  }

  if (!d.house.trim()) errors.house = 'Enter your house, flat or building.';
  if (d.mode === 'manual' && !d.area.trim()) errors.area = 'Enter your area or locality.';

  const pin = d.pincode.trim();
  if (!errors.pin || d.mode === 'manual') {
    if (!pin) {
      if (d.mode === 'manual' || d.pincodeEditable) errors.pincode = 'Enter the 6-digit pincode.';
      else if (d.geocoded) errors.pincode = 'We could not find a pincode for this pin. Move the pin slightly.';
    } else if (!isPincodeFormatValid(pin)) {
      errors.pincode = 'Pincode must be 6 digits.';
    } else if (!isPincodeServed(area, pin)) {
      errors.pincode = `This pincode is outside ${area.city}. We're in ${area.city} only for now.`;
    }
  }

  if (d.mode === 'manual' && !errors.pin && d.latitude !== null && d.confirmedFor !== confirmKey(d)) {
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
  const line1 = [d.house.trim(), d.mode === 'map' ? d.street.trim() : ''].filter(Boolean).join(', ');
  const line2 = [d.area.trim(), d.landmark.trim() ? `Near ${d.landmark.trim()}` : ''].filter(Boolean).join(', ');
  return {
    addressLine1: line1,
    addressLine2: line2,
    city: d.city.trim() || area.city,
    state: d.state.trim() || area.state,
    pincode: d.pincode.trim(),
    latitude: d.latitude,
    longitude: d.longitude,
    confirmed: !hasLocationErrors(validateLocation(d, area)),
  };
}

/** One-line address for review screens. */
export function formatLocationDraft(d: LocationDraft): string {
  return [d.house, d.mode === 'map' ? d.street : '', d.area, d.landmark ? `Near ${d.landmark}` : '', d.city, d.pincode]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ');
}

// Demo builds only: a quick way to pin a Hyderabad location on desktops without GPS.
const DEMO_PIN = { lat: 17.4126, lng: 78.4482, label: 'Banjara Hills' };

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
    (patch: Partial<LocationDraft>) => onChange({ ...valueRef.current, ...patch }),
    [onChange]
  );

  const [mapsError, setMapsError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const errors = validateLocation(value, serviceArea);
  const visible = (key: keyof LocationErrors) => (showErrors ? errors[key] : undefined);

  const pinned = value.latitude !== null && value.longitude !== null;
  const outside = pinned && !isInsideArea(serviceArea, value.latitude!, value.longitude!);

  // ---------- Current location (both modes) ----------
  const pinRef = useRef<(lat: number, lng: number) => void>(() => undefined);

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
        pinRef.current(Number(pos.coords.latitude.toFixed(6)), Number(pos.coords.longitude.toFixed(6)));
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

  // ---------- Manual (no Maps key) pinning ----------
  const pinManual = useCallback(
    (lat: number, lng: number) => {
      // A new pin always needs a fresh confirmation against the typed address.
      update({ latitude: lat, longitude: lng, confirmedFor: '' });
    },
    [update]
  );

  // ---------- Google Maps mode ----------
  const mapEl = useRef<HTMLDivElement>(null);
  const searchEl = useRef<HTMLDivElement>(null);
  const legacyInputEl = useRef<HTMLInputElement>(null);
  const mapsRef = useRef<GoogleMapsApi | null>(null);
  const mapRef = useRef<GMap | null>(null);
  const markerRef = useRef<GMarker | null>(null);
  const geocodeSeq = useRef(0);
  const [mapReady, setMapReady] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [useLegacySearch, setUseLegacySearch] = useState(false);

  const pinOnMap = useCallback(
    async (lat: number, lng: number, opts: { pan?: boolean } = {}) => {
      const maps = mapsRef.current;
      const map = mapRef.current;
      if (!maps || !map) return;
      const pos = { lat, lng };
      if (!markerRef.current) {
        const marker = new maps.Marker({ position: pos, map, draggable: true, title: 'Your car' });
        marker.addListener('dragend', () => {
          const p = marker.getPosition();
          if (p) void pinRef.current(Number(p.lat().toFixed(6)), Number(p.lng().toFixed(6)));
        });
        markerRef.current = marker;
      } else {
        markerRef.current.setPosition(pos);
      }
      if (opts.pan !== false) {
        map.panTo(pos);
        map.setZoom(17);
      }

      // Clear the old address straight away so a stale address can never sit next to a new pin.
      const seq = ++geocodeSeq.current;
      update({
        latitude: lat,
        longitude: lng,
        geocoded: false,
        street: '',
        area: '',
        pincode: '',
        formattedAddress: '',
        pincodeEditable: false,
      });
      setGeocoding(true);
      try {
        const geocoder = new maps.Geocoder();
        const { results } = await geocoder.geocode({ location: pos, region: 'IN' });
        if (seq !== geocodeSeq.current) return;
        const parsed = parseGeocoderResults(results);
        update({
          geocoded: true,
          street: parsed?.street ?? '',
          area: parsed?.area ?? '',
          city: parsed?.city || serviceArea.city,
          state: parsed?.state || serviceArea.state,
          pincode: parsed?.pincode ?? '',
          pincodeEditable: !parsed?.pincode,
          formattedAddress: parsed?.formattedAddress ?? '',
        });
      } catch {
        if (seq !== geocodeSeq.current) return;
        // Pin is still valid; let the user type the pincode while keeping the pin as the source of truth.
        update({ geocoded: true, pincodeEditable: true, city: serviceArea.city, state: serviceArea.state });
      } finally {
        if (seq === geocodeSeq.current) setGeocoding(false);
      }
    },
    [serviceArea.city, serviceArea.state, update]
  );

  useEffect(() => {
    pinRef.current = value.mode === 'map' ? (lat, lng) => void pinOnMap(lat, lng) : pinManual;
  }, [value.mode, pinOnMap, pinManual]);

  useEffect(() => {
    if (value.mode !== 'map') return;
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
          if (e.latLng) void pinOnMap(Number(e.latLng.lat().toFixed(6)), Number(e.latLng.lng().toFixed(6)), { pan: false });
        });
        if (start.latitude !== null && start.longitude !== null) {
          const marker = new maps.Marker({ position: centre, map, draggable: true, title: 'Your car' });
          marker.addListener('dragend', () => {
            const p = marker.getPosition();
            if (p) void pinOnMap(Number(p.lat().toFixed(6)), Number(p.lng().toFixed(6)), { pan: false });
          });
          markerRef.current = marker;
        }

        // Search box: Places API (New) element when available, else the legacy widget.
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
              if (place.location) void pinOnMap(Number(place.location.lat().toFixed(6)), Number(place.location.lng().toFixed(6)));
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
      .catch((err: Error) => {
        if (cancelled) return;
        setMapsError(`${err.message} You can enter the address by hand instead.`);
        // Fall back to the manual form; any address must be re-confirmed against the pin.
        update({ mode: 'manual', geocoded: false, pincodeEditable: false, confirmedFor: '' });
      });
    return () => {
      cancelled = true;
    };
    // The map is created once per mount of map mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.mode]);

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
      if (loc) void pinOnMap(Number(loc.lat().toFixed(6)), Number(loc.lng().toFixed(6)));
    });
    return () => listener.remove();
  }, [useLegacySearch, pinOnMap, serviceArea.latitude, serviceArea.longitude]);

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

  // =========================== MAP MODE ===========================
  if (value.mode === 'map') {
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

          {gpsButton}
          {gpsError && <p className="text-sm text-semantic-error">{gpsError}</p>}
          {mapsError && <p className="text-sm text-semantic-error">{mapsError}</p>}
        </div>

        {/* Address read from the pin — not editable, so it always matches the pin */}
        {pinned && (
          <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-card">
            <div className="flex items-start gap-3">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  outside ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                {geocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-navy-400">Your car is here</div>
                {geocoding ? (
                  <p className="mt-0.5 text-sm text-navy-500">Finding the address for this pin…</p>
                ) : (
                  <>
                    <p className="mt-0.5 text-[15px] font-semibold leading-snug text-navy-900">
                      {[value.street, value.area].filter(Boolean).join(', ') || value.city || 'Pinned location'}
                    </p>
                    <p className="text-sm text-navy-500">
                      {[value.city, value.state, value.pincode].filter(Boolean).join(', ')}
                    </p>
                  </>
                )}
                <p className="mt-1 text-xs text-navy-400">Drag the pin or tap the map to adjust. The address updates with the pin.</p>
              </div>
            </div>
          </div>
        )}

        {outsideAlert}
        {!outside && visible('pin') && <p className="text-sm text-semantic-error">{errors.pin}</p>}

        <div className="space-y-4 rounded-2xl border border-surface-200 bg-white p-4 shadow-card sm:p-5">
          <Input
            id="loc-house"
            label="House / flat / building"
            value={value.house}
            onChange={(e) => update({ house: e.target.value })}
            placeholder="e.g. Flat 302, Green Meadows Apartments"
            autoComplete="address-line1"
            error={visible('house')}
            required
          />
          <Input
            id="loc-landmark"
            label="Landmark (optional)"
            value={value.landmark}
            onChange={(e) => update({ landmark: e.target.value })}
            placeholder="e.g. Opposite City Centre Mall"
          />
          {value.pincodeEditable && (
            <Input
              id="loc-pincode"
              label="Pincode"
              value={value.pincode}
              onChange={(e) => update({ pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
              inputMode="numeric"
              autoComplete="postal-code"
              helperText="We could not read a pincode for this pin. Enter it here."
              error={visible('pincode')}
              required
            />
          )}
          {!value.pincodeEditable && visible('pincode') && <p className="text-sm text-semantic-error">{errors.pincode}</p>}
        </div>
      </div>
    );
  }

  // =========================== MANUAL MODE ===========================
  const confirmed = pinned && !outside && value.confirmedFor !== '' && value.confirmedFor === confirmKey(value);
  const changedAfterConfirm = pinned && value.confirmedFor !== '' && value.confirmedFor !== confirmKey(value);
  const readyToConfirm = pinned && !outside && !!value.area.trim() && isPincodeServed(serviceArea, value.pincode);
  const distance = pinned ? distanceFromCentreKm(serviceArea, value.latitude!, value.longitude!) : null;

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
                ? `${value.latitude!.toFixed(5)}, ${value.longitude!.toFixed(5)} · ${distance!.toFixed(1)} km from ${serviceArea.city} centre`
                : 'Stand near your car and share your location so we can match garages close to it.'}
            </div>
          </div>
        </div>
        {gpsButton}
        {gpsError && <p className="text-sm text-semantic-error">{gpsError}</p>}
        {isDemoMode && (
          <button
            type="button"
            onClick={() => pinManual(DEMO_PIN.lat, DEMO_PIN.lng)}
            className="min-h-[36px] text-xs font-medium text-navy-500 underline underline-offset-2"
          >
            Demo: pin {DEMO_PIN.label}, {serviceArea.city}
          </button>
        )}
        {!outside && visible('pin') && <p className="text-sm text-semantic-error">{errors.pin}</p>}
      </div>

      {outsideAlert}
      {mapsError && <p className="text-sm text-semantic-error">{mapsError}</p>}

      <div className="space-y-4 rounded-2xl border border-surface-200 bg-white p-4 shadow-card sm:p-5">
        <Input
          id="loc-house"
          label="House / flat / building"
          value={value.house}
          onChange={(e) => update({ house: e.target.value })}
          placeholder="e.g. Flat 302, Green Meadows Apartments"
          autoComplete="address-line1"
          error={visible('house')}
          required
        />
        <Input
          id="loc-area"
          label="Area / locality"
          value={value.area}
          onChange={(e) => update({ area: e.target.value })}
          placeholder="e.g. Madhapur"
          autoComplete="address-line2"
          error={visible('area')}
          required
        />
        <Input
          id="loc-landmark"
          label="Landmark (optional)"
          value={value.landmark}
          onChange={(e) => update({ landmark: e.target.value })}
          placeholder="e.g. Near Inorbit Mall"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-navy-800">City</span>
            <div className="flex min-h-[44px] items-center rounded-xl border border-surface-200 bg-surface-50 px-3.5 text-base text-navy-700 sm:text-sm">
              {serviceArea.city}
            </div>
          </div>
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

      {/* Pin ↔ address confirmation */}
      {pinned && !outside && (confirmed || readyToConfirm || changedAfterConfirm) && (
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
                      : `We will send garages to the pin (${distance!.toFixed(1)} km from ${serviceArea.city} centre). Make sure it is the same place as ${value.area.trim()}, ${value.pincode}.`}
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
      )}
      {showErrors && errors.confirm && !(pinned && !outside && (readyToConfirm || changedAfterConfirm)) && (
        <p className="text-sm text-semantic-error">{errors.confirm}</p>
      )}

      <p className="flex items-start gap-1.5 text-xs text-navy-400">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" />
        Map search turns on when a Google Maps key is configured.
      </p>
    </div>
  );
};
