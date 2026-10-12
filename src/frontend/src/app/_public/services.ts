// Service categories shown on the public site (home grid, /services) and how each one links into booking.
import type { ComponentType } from 'react';
import {
  BatteryCharging,
  CalendarCheck,
  Cog,
  Disc3,
  FileCheck2,
  Lightbulb,
  Snowflake,
  Sparkles,
  SprayCan,
  Wrench,
} from 'lucide-react';
import type { CarModel, Manufacturer } from '@/lib/catalogue';

export interface ServiceCategory {
  name: string;
  desc: string;
  icon: ComponentType<{ className?: string }>;
  /** Periodic packages have fixed prices; everything else is quoted by garages. */
  periodic?: boolean;
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    name: 'Car Services',
    desc: 'Basic, Standard and Premium periodic service packages at a fixed price for your car.',
    icon: CalendarCheck,
    periodic: true,
  },
  { name: 'AC Service & Repair', desc: 'Gas top-up, poor cooling, cabin filter, compressor and leak checks.', icon: Snowflake },
  { name: 'Batteries', desc: 'Battery testing, jump-start issues and new battery fitment.', icon: BatteryCharging },
  { name: 'Tyres & Wheel Care', desc: 'New tyres, wheel alignment, balancing and puncture repair.', icon: Disc3 },
  { name: 'Denting & Painting', desc: 'Scratches, dents and panel repaint with colour matching.', icon: SprayCan },
  { name: 'Detailing & Car Spa', desc: 'Deep cleaning, interior detailing, polishing and coating.', icon: Sparkles },
  { name: 'Clutch & Body Parts', desc: 'Clutch wear, gear shifting trouble and body part replacement.', icon: Cog },
  { name: 'Suspension & Fitments', desc: 'Shock absorbers, noises over bumps, steering and accessory fitment.', icon: Wrench },
  { name: 'Windshields & Lights', desc: 'Windshield and glass replacement, headlights and tail lights.', icon: Lightbulb },
  { name: 'Insurance Claims', desc: 'Accident repairs with help through your insurance claim.', icon: FileCheck2 },
];

export const CAR_SERVICE_PATH = '/services/car-service';
export const NEW_REQUEST_PATH = '/customer/requests/new';

/** Only allow same-origin relative paths (never "//host" or "/\host"). */
export function isSafePath(path: string | null | undefined): path is string {
  return !!path && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\');
}

export function isCustomer(roles: string[] | undefined | null): boolean {
  return !!roles?.some((r) => r.toUpperCase() === 'CUSTOMER');
}

/**
 * Where a booking step should send the visitor: straight to the (login-protected) customer page when
 * signed in as a customer, otherwise through log-in/sign-up with the target kept in `?next=`.
 */
export function viaAuth(target: string, signedInCustomer: boolean, via: 'login' | 'register' = 'login'): string {
  return signedInCustomer ? target : `/${via}?next=${encodeURIComponent(target)}`;
}

export function quoteRequestPath(category: string): string {
  return `${NEW_REQUEST_PATH}?category=${encodeURIComponent(category)}`;
}

export function serviceHref(category: ServiceCategory, signedInCustomer: boolean): string {
  if (category.periodic) return CAR_SERVICE_PATH;
  return viaAuth(quoteRequestPath(category.name), signedInCustomer);
}

/** The car a visitor has chosen, with what the UI needs to display it. */
export interface CarChoice {
  manufacturerId: string;
  manufacturerName: string;
  logoUrl?: string | null;
  modelId: string;
  modelName: string;
  fuelType: string;
}

export function carChoiceFrom(manufacturer: Manufacturer, model: CarModel, fuelType: string): CarChoice {
  return {
    manufacturerId: manufacturer.id,
    manufacturerName: manufacturer.name,
    logoUrl: manufacturer.logoUrl,
    modelId: model.id,
    modelName: model.name,
    fuelType,
  };
}

export function formatKm(km: number): string {
  return `${km.toLocaleString('en-IN')} km`;
}
