// Pin -> address fields through our API (Google with a server key, else OpenStreetMap).

import { getApiBase } from '@/lib/api';
import { peekPublicConfig } from '@/components/location/googleMaps';

/** GET /geo/reverse answer. */
export interface AddressLookup {
  houseNumber?: string | null;
  street?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  formattedAddress: string;
  /** "Google" or "OpenStreetMap": decides the attribution we must show. */
  provider: string;
}

export type LookupOutcome = { status: 'found'; address: AddressLookup } | { status: 'none' } | { status: 'error' };

const TIMEOUT_MS = 8000;

/** False only when the API said address lookup is switched off. */
export function isAddressLookupEnabled(): boolean {
  return peekPublicConfig()?.addressLookupProvider !== 'None';
}

/**
 * Asks the API for the address at a pin. Uses fetch directly instead of apiFetch so an expired
 * session never redirects the customer away from a half-filled booking; it just means no autofill.
 */
export async function lookupAddress(lat: number, lng: number): Promise<LookupOutcome> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('broco_access_token') : null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${getApiBase()}/geo/reverse?lat=${lat}&lng=${lng}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: controller.signal,
    });
    if (!res.ok) return { status: 'error' };
    const body = (await res.json().catch(() => null)) as { success?: boolean; data?: AddressLookup | null } | null;
    if (!body?.success) return { status: 'error' };
    return body.data ? { status: 'found', address: body.data } : { status: 'none' };
  } catch {
    return { status: 'error' };
  } finally {
    clearTimeout(timer);
  }
}
