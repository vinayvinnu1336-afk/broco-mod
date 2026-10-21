'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Phone, StickyNote, ExternalLink } from 'lucide-react';
import type { GarageCustomerLocationDto } from '@/types/serviceJob';
import { loadGoogleMaps, onGoogleMapsFailure, resolveGoogleMapsKey } from '@/components/location/googleMaps';
import { directionsUrl, LatLng, mapsPinUrl, osmEmbedUrl } from '@/lib/jobShare';

export interface CustomerLocationCardProps {
  location: GarageCustomerLocationDto;
  customerName?: string | null;
  /** Shown as "Call customer" only when the API gave it to this garage. */
  customerPhone?: string | null;
  needsPickup?: boolean | null;
  pickupNotes?: string | null;
  className?: string;
}

function formatDistance(km: number): string {
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km from your workshop`;
}

/**
 * Where the car is, for the garage doing the job: full address, landmark and pick-up notes, distance, a map with
 * the customer (and workshop) pin, and one-tap directions / call. Google Maps when a browser key is set up,
 * otherwise a static OpenStreetMap view.
 */
export function CustomerLocationCard({
  location,
  customerName,
  customerPhone,
  needsPickup,
  pickupNotes,
  className = '',
}: CustomerLocationCardProps) {
  const customer: LatLng = { lat: location.latitude, lng: location.longitude };
  const workshop: LatLng | null =
    location.workshopLatitude != null && location.workshopLongitude != null
      ? { lat: location.workshopLatitude, lng: location.workshopLongitude }
      : null;
  const phone = customerPhone?.trim();
  const cityLine = [location.city, location.pincode].filter((s) => s?.trim()).join(' – ');
  const hasAddress = !!(location.addressLine1?.trim() || location.addressLine2?.trim() || cityLine);

  return (
    <div className={`overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-card ${className}`}>
      <CustomerMap customer={customer} workshop={workshop} />

      <div className="space-y-3 p-4 text-sm sm:p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-electric-50 text-electric-600">
            <MapPin className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            {customerName && <div className="text-xs text-navy-500">{customerName}</div>}
            {hasAddress ? (
              <address className="not-italic">
                {location.addressLine1 && <div className="break-words font-semibold text-navy-900">{location.addressLine1}</div>}
                {location.addressLine2 && <div className="break-words text-navy-700">{location.addressLine2}</div>}
                {cityLine && (
                  <div className="text-navy-700">
                    {cityLine}
                    {location.state ? `, ${location.state}` : ''}
                  </div>
                )}
              </address>
            ) : (
              <div className="font-semibold text-navy-900">Pinned on the map</div>
            )}
            {location.distanceKm != null && (
              <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-electric-700">
                <Navigation className="h-3.5 w-3.5" aria-hidden />
                {formatDistance(location.distanceKm)}
              </div>
            )}
          </div>
        </div>

        {needsPickup && pickupNotes?.trim() && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-amber-900">
            <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <span className="min-w-0 break-words">
              <span className="font-medium">Pick-up notes: </span>
              {pickupNotes.trim()}
            </span>
          </p>
        )}

        <div className={`grid gap-2 ${phone ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
          <a
            href={directionsUrl(customer, workshop)}
            target="_blank"
            rel="noopener noreferrer"
            className="col-span-2 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-electric-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-electric-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-600 focus-visible:ring-offset-2 sm:col-span-1"
          >
            <Navigation className="h-4 w-4" aria-hidden />
            Get directions
          </a>
          <a
            href={mapsPinUrl(customer)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-surface-300 bg-white px-3 text-sm font-semibold text-navy-800 transition hover:bg-surface-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-600"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            Open in Maps
          </a>
          {phone && (
            <a
              href={`tel:${phone.replace(/\s+/g, '')}`}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-surface-300 bg-white px-3 text-sm font-semibold text-navy-800 transition hover:bg-surface-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-600"
            >
              <Phone className="h-4 w-4" aria-hidden />
              Call customer
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

type MapMode = 'pending' | 'google' | 'osm';

/** Google map with both pins when the browser key works; otherwise (or if Google refuses it) the OSM embed. */
function CustomerMap({ customer, workshop }: { customer: LatLng; workshop: LatLng | null }) {
  const [mode, setMode] = useState<MapMode>('pending');
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const offFailure = onGoogleMapsFailure(() => !cancelled && setMode('osm'));
    resolveGoogleMapsKey().then((key) => {
      if (!cancelled) setMode(key ? 'google' : 'osm');
    });
    return () => {
      cancelled = true;
      offFailure();
    };
  }, []);

  useEffect(() => {
    if (mode !== 'google') return;
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !el.current) return;
        const map = new maps.Map(el.current, {
          center: customer,
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: 'cooperative',
        });
        new maps.Marker({ position: customer, map, title: 'Customer', label: { text: 'C', color: '#ffffff', fontWeight: '700' } });
        if (workshop) {
          new maps.Marker({ position: workshop, map, title: 'Your workshop', label: { text: 'W', color: '#ffffff', fontWeight: '700' } });
          // Frame both pins (LatLngBounds isn't in our small typed surface).
          const g = maps as unknown as { LatLngBounds?: new () => { extend(p: LatLng): void } };
          const m = map as unknown as { fitBounds?: (b: unknown, padding?: number) => void };
          if (g.LatLngBounds && m.fitBounds) {
            const bounds = new g.LatLngBounds();
            bounds.extend(customer);
            bounds.extend(workshop);
            m.fitBounds(bounds, 48);
          }
        }
      })
      .catch(() => !cancelled && setMode('osm'));
    return () => {
      cancelled = true;
    };
    // The pins don't move while the page is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <div className="relative h-48 w-full bg-surface-100 sm:h-60">
      {mode === 'google' && <div ref={el} className="h-full w-full" role="region" aria-label="Map of the customer location" />}
      {mode === 'osm' && (
        <iframe
          title="Map of the customer location"
          src={osmEmbedUrl(customer, workshop)}
          className="h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      )}
      {mode === 'osm' && (
        <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-navy-700 shadow-sm">
          Pin shows the customer
        </span>
      )}
    </div>
  );
}
