'use client';

import { useEffect, useState } from 'react';
import { ServiceArea, catalogueApi, loadBookingIntent } from '@/lib/catalogue';

/** Used until /service-areas answers (and if it cannot be reached). Matches the server defaults. */
export const DEFAULT_LIVE_AREAS: ServiceArea[] = [
  { city: 'Hyderabad', state: 'Telangana', latitude: 17.385, longitude: 78.4867, radiusKm: 40, isLive: true },
  { city: 'Bengaluru', state: 'Karnataka', latitude: 12.9716, longitude: 77.5946, radiusKm: 40, isLive: true },
  { city: 'Mancherial', state: 'Telangana', latitude: 18.8714, longitude: 79.4443, radiusKm: 25, isLive: true },
];

export const DEFAULT_LIVE_AREA: ServiceArea = DEFAULT_LIVE_AREAS[0];

/** Pincode prefixes the server accepts per live city (not part of the public DTO). */
const PINCODE_PREFIXES: Record<string, string[]> = {
  hyderabad: ['500', '501', '502'],
  bengaluru: ['560', '562'],
  mancherial: ['504'],
};

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function distanceFromCentreKm(area: ServiceArea, lat: number, lng: number): number {
  return haversineKm(lat, lng, area.latitude, area.longitude);
}

export function isInsideArea(area: ServiceArea, lat: number, lng: number): boolean {
  return distanceFromCentreKm(area, lat, lng) <= area.radiusKm;
}

export function isPincodeFormatValid(pincode: string): boolean {
  return /^\d{6}$/.test(pincode.trim());
}

export function isPincodeServed(area: ServiceArea, pincode: string): boolean {
  const digits = pincode.replace(/\D/g, '');
  if (digits.length !== 6) return false;
  const prefixes = PINCODE_PREFIXES[area.city.toLowerCase()];
  return !prefixes || prefixes.some((p) => digits.startsWith(p));
}

let cachedAreas: ServiceArea[] | null = null;

/** Live cities as last loaded from the server (or the defaults until then). */
export function knownLiveAreas(): ServiceArea[] {
  return cachedAreas ?? DEFAULT_LIVE_AREAS;
}

/** The live city a pin falls in (nearest centre wins), like the server's check. Null = outside every live city. */
export function findLiveAreaFor(lat: number, lng: number, areas: ServiceArea[] = knownLiveAreas()): ServiceArea | null {
  let best: ServiceArea | null = null;
  let bestKm = Infinity;
  for (const area of areas) {
    const km = distanceFromCentreKm(area, lat, lng);
    if (area.isLive && km <= area.radiusKm && km < bestKm) {
      best = area;
      bestKm = km;
    }
  }
  return best;
}

/** "Hyderabad, Bengaluru and Mancherial". */
export function liveCitiesLabel(areas: ServiceArea[] = knownLiveAreas()): string {
  const cities = areas.filter((a) => a.isLive).map((a) => a.city);
  return cities.length > 1 ? `${cities.slice(0, -1).join(', ')} and ${cities[cities.length - 1]}` : cities[0] ?? '';
}

let pending: Promise<ServiceArea[]> | null = null;

function loadLiveAreas(): Promise<ServiceArea[]> {
  pending ??= catalogueApi.serviceAreas().then((res) => {
    const live = res.success && res.data ? res.data.filter((a) => a.isLive) : [];
    if (live.length) cachedAreas = live;
    else pending = null; // try again next time
    return knownLiveAreas();
  });
  return pending;
}

/** Every city we take bookings in. */
export function useLiveServiceAreas(): ServiceArea[] {
  const [areas, setAreas] = useState<ServiceArea[]>(knownLiveAreas);
  useEffect(() => {
    let cancelled = false;
    void loadLiveAreas().then((live) => {
      if (!cancelled) setAreas(live);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return areas;
}

function pickArea(areas: ServiceArea[]): ServiceArea {
  const chosen = typeof window !== 'undefined' ? loadBookingIntent()?.city?.trim().toLowerCase() : undefined;
  return areas.find((a) => a.city.toLowerCase() === chosen) ?? areas[0] ?? DEFAULT_LIVE_AREA;
}

/**
 * The live city the customer picked on the public site (Hyderabad when they haven't picked one).
 * The location step still accepts a pin in any live city; this one only centres the map and search.
 */
export function useLiveServiceArea(): ServiceArea {
  const areas = useLiveServiceAreas();
  const [area, setArea] = useState<ServiceArea>(() => pickArea(areas));
  useEffect(() => {
    setArea((current) => {
      const next = pickArea(areas);
      return next.city === current.city && next.radiusKm === current.radiusKm ? current : next;
    });
  }, [areas]);
  return area;
}
