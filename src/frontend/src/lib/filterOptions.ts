'use client';

import { useEffect, useState } from 'react';
import { catalogueApi } from '@/lib/catalogue';

/** Option lists shared by the staff list filters. */

export const SERVICE_TYPE_OPTIONS = [
  { value: 'package', label: 'Packages' },
  { value: 'quote', label: 'Repairs (quoted)' },
];

/** Services customers can ask garages to quote for (matched as "contains", so multi-service requests match too). */
export const SERVICE_CATEGORY_OPTIONS = [
  'Periodic Service',
  'AC Service & Repair',
  'Batteries',
  'Tyres & Wheel Care',
  'Denting & Painting',
  'Detailing & Car Spa',
  'Clutch & Body Parts',
  'Suspension & Fitments',
  'Windshields & Lights',
  'Insurance Claims',
  'General Repair',
].map((name) => ({ value: name, label: name }));

/** Cities BroCo serves (from the public service-area list), for city filters. */
export function useCityOptions(): { value: string; label: string }[] {
  const [cities, setCities] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    let alive = true;
    catalogueApi.serviceAreas().then((res) => {
      if (!alive || !res.success || !res.data) return;
      const names = Array.from(new Set(res.data.map((a) => a.city).filter(Boolean))).sort((a, b) => a.localeCompare(b));
      setCities(names.map((c) => ({ value: c, label: c })));
    });
    return () => {
      alive = false;
    };
  }, []);
  return cities;
}
