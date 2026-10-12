'use client';

import { useEffect, useState } from 'react';
import { ServiceArea, catalogueApi } from '@/lib/catalogue';

/** Used until /service-areas answers (and if it cannot be reached). Matches the server defaults. */
export const DEFAULT_LIVE_AREA: ServiceArea = {
  city: 'Hyderabad',
  state: 'Telangana',
  latitude: 17.385,
  longitude: 78.4867,
  radiusKm: 40,
  isLive: true,
};

/** Pincode prefixes the server accepts per live city (not part of the public DTO). */
const PINCODE_PREFIXES: Record<string, string[]> = {
  hyderabad: ['500', '501', '502'],
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

let cachedArea: ServiceArea | null = null;

/** The live city we take bookings in (Hyderabad today). */
export function useLiveServiceArea(): ServiceArea {
  const [area, setArea] = useState<ServiceArea>(cachedArea ?? DEFAULT_LIVE_AREA);
  useEffect(() => {
    if (cachedArea) return;
    let cancelled = false;
    catalogueApi.serviceAreas().then((res) => {
      const live = res.success && res.data ? res.data.find((a) => a.isLive) : null;
      if (live && !cancelled) {
        cachedArea = live;
        setArea(live);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return area;
}
