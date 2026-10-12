// Car catalogue, service packages and the "booking intent" the public pages hand to the booking flow.
import { apiFetch, getApiBase } from '@/lib/api';

export interface Manufacturer {
  id: string;
  name: string;
  country: string;
  logoUrl: string;
  isActive: boolean;
  displayOrder: number;
  modelsCount: number;
  isPopular: boolean;
}

export interface CarModel {
  id: string;
  manufacturerId: string;
  manufacturerName: string;
  name: string;
  bodyType: string;
  yearFrom: number;
  yearTo: number | null;
  isActive: boolean;
  variantsCount: number;
  segment: string;
  fuels: string[];
}

export interface ServicePackage {
  id: string;
  code: 'BASIC' | 'STANDARD' | 'PREMIUM' | string;
  name: string;
  tagline: string;
  intervalKm: number;
  intervalMonths: number;
  durationHours: number;
  warrantyKm: number;
  warrantyDays: number;
  includes: string[];
  displayOrder: number;
  isActive: boolean;
  isRecommended: boolean;
}

export interface PackageOffer {
  package: ServicePackage;
  price: number | null;
  advanceAmount: number | null;
  payAtGarageAmount: number | null;
}

export interface PackageOffers {
  modelId: string;
  manufacturerName: string;
  modelName: string;
  fuelType: string;
  advancePercentage: number;
  offers: PackageOffer[];
}

export interface ServiceArea {
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  isLive: boolean;
}

export const SEGMENTS = ['Hatchback', 'Sedan', 'CompactSUV', 'SUV', 'Luxury'] as const;
export const SEGMENT_LABELS: Record<string, string> = {
  Hatchback: 'Hatchback',
  Sedan: 'Sedan',
  CompactSUV: 'Compact SUV',
  SUV: 'SUV / MUV',
  Luxury: 'Luxury',
};
export const FUELS = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'] as const;

/** Logos uploaded by admins are served by the API; bundled ones live in /public/brands. */
export function assetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/api/')) {
    const base = getApiBase().replace(/\/api\/v1$/, '');
    return `${base}${url}`;
  }
  return url;
}

export const catalogueApi = {
  manufacturers: (activeOnly = true) =>
    apiFetch<Manufacturer[]>(`/vehicle-manufacturers${activeOnly ? '' : '?activeOnly=false'}`),
  models: (manufacturerId: string, activeOnly = true) =>
    apiFetch<CarModel[]>(`/vehicle-manufacturers/${manufacturerId}/models${activeOnly ? '' : '?activeOnly=false'}`),
  model: (modelId: string) => apiFetch<CarModel>(`/vehicle-models/${modelId}`),
  packages: () => apiFetch<ServicePackage[]>('/service-packages'),
  offers: (modelId: string, fuelType: string) =>
    apiFetch<PackageOffers>(`/service-packages/offers?modelId=${modelId}&fuelType=${encodeURIComponent(fuelType)}`),
  serviceAreas: () => apiFetch<ServiceArea[]>('/service-areas'),
  createLead: (body: { mobileNumber: string; city: string; vehicleModelId?: string | null; fuelType?: string | null; serviceInterest?: string | null }) =>
    apiFetch<unknown>('/leads', { method: 'POST', body: JSON.stringify(body) }),
};

/** The car + service a visitor picked on the public site, carried into sign-up and booking. */
export interface BookingIntent {
  city: string;
  manufacturerId?: string;
  manufacturerName?: string;
  modelId?: string;
  modelName?: string;
  fuelType?: string;
  packageCode?: string;
  serviceCategory?: string;
}

const INTENT_KEY = 'broco_booking_intent';

export function loadBookingIntent(): BookingIntent | null {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(INTENT_KEY) : null;
    return raw ? (JSON.parse(raw) as BookingIntent) : null;
  } catch {
    return null;
  }
}

export function saveBookingIntent(intent: BookingIntent): void {
  try {
    window.localStorage.setItem(INTENT_KEY, JSON.stringify(intent));
  } catch {
    /* storage unavailable (private mode) - the flow still works, it just won't remember */
  }
}

export function clearBookingIntent(): void {
  try {
    window.localStorage.removeItem(INTENT_KEY);
  } catch {
    /* ignore */
  }
}

/** "Hyundai i20 · Petrol" */
export function carLabel(intent: Pick<BookingIntent, 'manufacturerName' | 'modelName' | 'fuelType'>): string {
  const car = [intent.manufacturerName, intent.modelName].filter(Boolean).join(' ');
  return intent.fuelType ? `${car} · ${intent.fuelType}` : car;
}
