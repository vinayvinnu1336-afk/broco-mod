// Minimal, dependency-free loader and typed wrapper for the Google Maps JavaScript API.
// We only use a handful of classes, so instead of pulling in @types/google.maps the surface we touch
// is declared here and everything else stays behind `unknown`.
//
// The browser key comes from NEXT_PUBLIC_GOOGLE_MAPS_API_KEY when it was baked in at build time,
// otherwise from the API at runtime (GET /config/public), so a new key needs only an API restart.
// Address lookups (pin -> address) go through our API (GET /geo/reverse), never the browser key.

import { apiFetch } from '@/lib/api';

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface GLatLng {
  lat(): number;
  lng(): number;
}

export interface GMapsEventListener {
  remove(): void;
}

export interface GMap {
  setCenter(latLng: LatLngLiteral): void;
  setZoom(zoom: number): void;
  panTo(latLng: LatLngLiteral): void;
  addListener(event: string, handler: (e: { latLng?: GLatLng }) => void): GMapsEventListener;
}

export interface GMarker {
  setPosition(latLng: LatLngLiteral): void;
  getPosition(): GLatLng | null;
  addListener(event: string, handler: () => void): GMapsEventListener;
  setMap(map: GMap | null): void;
}

/** The parts of `google.maps` this app uses. */
export interface GoogleMapsApi {
  Map: new (el: HTMLElement, options: Record<string, unknown>) => GMap;
  Marker: new (options: Record<string, unknown>) => GMarker;
  Circle?: new (options: Record<string, unknown>) => unknown;
  places?: {
    // Places API (New) web component.
    PlaceAutocompleteElement?: new (options: Record<string, unknown>) => HTMLElement;
    // Places API (Legacy) widget, used only when the new element is not available.
    Autocomplete?: new (
      input: HTMLInputElement,
      options: Record<string, unknown>
    ) => {
      addListener(event: string, handler: () => void): GMapsEventListener;
      getPlace(): { geometry?: { location?: GLatLng } } | undefined;
    };
  };
  importLibrary?: (name: string) => Promise<unknown>;
}

type MapsWindow = Window & { google?: { maps?: GoogleMapsApi } } & Record<string, unknown>;

/** Runtime settings from GET /config/public. */
export interface PublicSiteConfig {
  googleMapsBrowserKey: string;
  /** "Google", "OpenStreetMap" or "None". */
  addressLookupProvider: string;
}

const BUILD_TIME_KEY = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim();

// undefined = not fetched yet; null = the API could not tell us (old API, offline): treat as "no key".
let siteConfig: PublicSiteConfig | null | undefined;
let siteConfigPromise: Promise<PublicSiteConfig | null> | null = null;
let mapsFailed = false;
const failureListeners = new Set<() => void>();

/** Fetches the runtime settings once per page load (later calls share the same answer). */
export function loadPublicConfig(): Promise<PublicSiteConfig | null> {
  if (siteConfig !== undefined) return Promise.resolve(siteConfig);
  if (!siteConfigPromise) {
    siteConfigPromise = apiFetch<PublicSiteConfig>('/config/public').then((res) => {
      siteConfig = res.success && res.data ? res.data : null;
      return siteConfig;
    });
  }
  return siteConfigPromise;
}

/** Settings already fetched, or undefined while still unknown. */
export function peekPublicConfig(): PublicSiteConfig | null | undefined {
  return siteConfig;
}

/**
 * The browser key if it is known right now: '' = no usable key (none configured, or Google refused it),
 * undefined = still asking the API.
 */
export function peekGoogleMapsKey(): string | undefined {
  if (mapsFailed) return '';
  if (BUILD_TIME_KEY) return BUILD_TIME_KEY;
  if (siteConfig === undefined) return undefined;
  return siteConfig?.googleMapsBrowserKey?.trim() || '';
}

export async function resolveGoogleMapsKey(): Promise<string> {
  const known = peekGoogleMapsKey();
  if (known !== undefined) return known;
  await loadPublicConfig();
  return peekGoogleMapsKey() ?? '';
}

/** True only when a key is already known (no network wait). */
export function hasGoogleMapsKey(): boolean {
  return !!peekGoogleMapsKey();
}

/**
 * Called when Google rejects the key after the script loaded (gm_authFailure: wrong key, referrer
 * not allowed, billing off) or the script cannot load. From then on this page uses the no-map form.
 */
export function onGoogleMapsFailure(listener: () => void): () => void {
  failureListeners.add(listener);
  return () => {
    failureListeners.delete(listener);
  };
}

function markMapsFailed(reason: string) {
  if (!mapsFailed) {
    // For whoever is setting up the keys; customers only see the no-map form.
    console.warn(`Google Maps is unavailable (${reason}). See docs/google-maps-setup.md.`);
  }
  mapsFailed = true;
  failureListeners.forEach((l) => l());
}

let loadPromise: Promise<GoogleMapsApi> | null = null;
const CALLBACK = '__brocoGoogleMapsReady';

/** Loads the Maps JS API (maps + places) once per page. */
export function loadGoogleMaps(): Promise<GoogleMapsApi> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google Maps can only load in the browser.'));
  const w = window as unknown as MapsWindow;
  if (mapsFailed) return Promise.reject(new Error('The map is not available right now.'));
  if (w.google?.maps?.Map) return Promise.resolve(w.google.maps);
  if (loadPromise) return loadPromise;

  loadPromise = resolveGoogleMapsKey().then(
    (key) =>
      new Promise<GoogleMapsApi>((resolve, reject) => {
        if (!key) {
          loadPromise = null;
          reject(new Error('Google Maps key is not configured.'));
          return;
        }
        // Google calls this global when it refuses the key (the map would show "Oops! Something went wrong").
        w.gm_authFailure = () => markMapsFailed('the browser key was refused');
        w[CALLBACK] = async () => {
          try {
            const maps = w.google?.maps;
            if (!maps) throw new Error('Google Maps did not initialise.');
            // With loading=async the individual libraries are fetched on demand.
            if (maps.importLibrary) {
              await Promise.all([maps.importLibrary('maps'), maps.importLibrary('marker'), maps.importLibrary('places')]);
            }
            resolve(w.google!.maps!);
          } catch (err) {
            loadPromise = null;
            markMapsFailed('the libraries did not load');
            reject(err instanceof Error ? err : new Error('Google Maps failed to load.'));
          }
        };
        const script = document.createElement('script');
        script.src =
          'https://maps.googleapis.com/maps/api/js' +
          `?key=${encodeURIComponent(key)}` +
          `&libraries=places&region=IN&language=en&loading=async&callback=${CALLBACK}`;
        script.async = true;
        script.defer = true;
        script.onerror = () => {
          loadPromise = null;
          script.remove();
          markMapsFailed('the script did not load');
          reject(new Error('Could not load Google Maps.'));
        };
        document.head.appendChild(script);
      })
  );
  return loadPromise;
}
