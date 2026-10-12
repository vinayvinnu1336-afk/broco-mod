// Minimal, dependency-free loader and typed wrapper for the Google Maps JavaScript API.
// We only use a handful of classes, so instead of pulling in @types/google.maps the surface we touch
// is declared here and everything else stays behind `unknown`.

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

export interface GAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

export interface GGeocoderResult {
  formatted_address: string;
  address_components: GAddressComponent[];
  types: string[];
}

export interface GGeocoder {
  geocode(request: { location: LatLngLiteral; region?: string }): Promise<{ results: GGeocoderResult[] }>;
}

/** The parts of `google.maps` this app uses. */
export interface GoogleMapsApi {
  Map: new (el: HTMLElement, options: Record<string, unknown>) => GMap;
  Marker: new (options: Record<string, unknown>) => GMarker;
  Geocoder: new () => GGeocoder;
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

export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export function hasGoogleMapsKey(): boolean {
  return GOOGLE_MAPS_API_KEY.trim().length > 0;
}

let loadPromise: Promise<GoogleMapsApi> | null = null;
const CALLBACK = '__brocoGoogleMapsReady';

/** Loads the Maps JS API (maps + places + geocoding) once per page. */
export function loadGoogleMaps(): Promise<GoogleMapsApi> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google Maps can only load in the browser.'));
  const w = window as unknown as MapsWindow;
  if (w.google?.maps?.Map && w.google.maps.Geocoder) return Promise.resolve(w.google.maps);
  if (loadPromise) return loadPromise;
  if (!hasGoogleMapsKey()) return Promise.reject(new Error('Google Maps key is not configured.'));

  loadPromise = new Promise<GoogleMapsApi>((resolve, reject) => {
    w[CALLBACK] = async () => {
      try {
        const maps = w.google?.maps;
        if (!maps) throw new Error('Google Maps did not initialise.');
        // With loading=async the individual libraries are fetched on demand.
        if (maps.importLibrary) {
          await Promise.all([
            maps.importLibrary('maps'),
            maps.importLibrary('marker'),
            maps.importLibrary('places'),
            maps.importLibrary('geocoding'),
          ]);
        }
        resolve(w.google!.maps!);
      } catch (err) {
        loadPromise = null;
        reject(err instanceof Error ? err : new Error('Google Maps failed to load.'));
      }
    };
    const script = document.createElement('script');
    script.src =
      'https://maps.googleapis.com/maps/api/js' +
      `?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}` +
      `&libraries=places&region=IN&loading=async&callback=${CALLBACK}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      loadPromise = null;
      script.remove();
      reject(new Error('Could not load Google Maps. Check your connection and try again.'));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}

/** Address parts we fill from a reverse-geocoding result. */
export interface GeocodedAddress {
  street: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  formattedAddress: string;
}

function component(components: GAddressComponent[], ...types: string[]): string {
  for (const type of types) {
    const match = components.find((c) => c.types.includes(type));
    if (match) return match.long_name;
  }
  return '';
}

/** Picks the most specific result and turns its components into our address fields. */
export function parseGeocoderResults(results: GGeocoderResult[]): GeocodedAddress | null {
  if (!results.length) return null;
  const best =
    results.find((r) => r.types.includes('street_address') || r.types.includes('premise')) ??
    results.find((r) => r.address_components.some((c) => c.types.includes('postal_code'))) ??
    results[0];
  const comps = best.address_components;
  // Pincode may only be on a broader result; look across all of them.
  const pincode =
    component(comps, 'postal_code') ||
    results.map((r) => component(r.address_components, 'postal_code')).find(Boolean) ||
    '';
  const street = [component(comps, 'street_number'), component(comps, 'route')].filter(Boolean).join(' ');
  const area = [
    component(comps, 'sublocality_level_2', 'neighborhood'),
    component(comps, 'sublocality_level_1', 'sublocality'),
  ]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(', ');
  return {
    street,
    area: area || component(comps, 'locality'),
    city: component(comps, 'locality', 'administrative_area_level_3', 'administrative_area_level_2'),
    state: component(comps, 'administrative_area_level_1'),
    pincode,
    formattedAddress: best.formatted_address,
  };
}
