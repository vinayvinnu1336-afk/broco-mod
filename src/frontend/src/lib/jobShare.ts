// Text a garage shares about a job (e.g. on WhatsApp with its pick-up driver or mechanic), plus the map links
// used by the customer-location card. Pure functions, no React, so they can be checked from a plain Node script.

export interface LatLng {
  lat: number;
  lng: number;
}

/** Pin link that opens Google Maps (the app on phones). Short maps.app.goo.gl links need an API, so we use this. */
export function mapsPinUrl(p: LatLng): string {
  return `https://www.google.com/maps?q=${coord(p)}`;
}

/** Driving directions from the workshop to the customer (or from "my location" when the workshop pin is unknown). */
export function directionsUrl(destination: LatLng, origin?: LatLng | null): string {
  const from = origin ? `&origin=${coord(origin)}` : '';
  return `https://www.google.com/maps/dir/?api=1${from}&destination=${coord(destination)}&travelmode=driving`;
}

/** Static OpenStreetMap embed (no key needed) framing the customer and, when known, the workshop. */
export function osmEmbedUrl(customer: LatLng, workshop?: LatLng | null): string {
  const pts = workshop ? [customer, workshop] : [customer];
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  // At least ~1 km around the pin, plus 20% padding around both pins.
  const padLat = Math.max(0.006, (Math.max(...lats) - Math.min(...lats)) * 0.2);
  const padLng = Math.max(0.006, (Math.max(...lngs) - Math.min(...lngs)) * 0.2);
  const bbox = [Math.min(...lngs) - padLng, Math.min(...lats) - padLat, Math.max(...lngs) + padLng, Math.max(...lats) + padLat]
    .map((n) => n.toFixed(5))
    .join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${customer.lat.toFixed(6)},${customer.lng.toFixed(6)}`;
}

function coord(p: LatLng): string {
  return `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
}

/** 11229 -> "11,229"; 1234567 -> "12,34,567" (Indian grouping, whole rupees). */
export function formatIndianNumber(amount: number): string {
  const whole = Math.round(Math.abs(amount)).toString();
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return amount < 0 ? `-${grouped}` : grouped;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "28 Sep" in the viewer's time zone. */
export function formatShortDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function hourLabel(h: number): string {
  // Slots are day-time hours: 9-11 are am, 12 is noon, 1-8 are pm.
  const pm = h === 12 || (h >= 1 && h <= 8);
  return `${String(h).padStart(2, '0')} ${pm ? 'pm' : 'am'}`;
}

/** "Afternoon 12-3" -> "12 pm to 03 pm"; anything else is returned as typed. */
export function formatPickupSlot(slot: string | null | undefined): string | null {
  const s = slot?.trim();
  if (!s) return null;
  const m = /(\d{1,2})\s*-\s*(\d{1,2})\s*$/.exec(s);
  if (!m) return s;
  const from = Number(m[1]);
  const to = Number(m[2]);
  if (from < 1 || from > 12 || to < 1 || to > 12) return s;
  return `${hourLabel(from)} to ${hourLabel(to)}`;
}

/** Splits a catalogue line like "Fluids & Filters: Engine Oil (5W-30 Synthetic) + Oil Filter Replacement". */
function splitItem(item: string): string[] {
  const withoutGroup = item.includes(':') ? item.slice(item.indexOf(':') + 1) : item;
  return withoutGroup
    .split(/\s\+\s/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "Engine Oil (5W-30 Synthetic)" -> "5W-30 (Synthetic) Engine Oil"; null when the item isn't engine oil. */
export function engineOilLine(item: string): string | null {
  if (!/engine\s*oil/i.test(item)) return null;
  const inside = /\(([^)]*)\)/.exec(item)?.[1]?.trim() ?? '';
  const grade = /\b\d{1,2}W-?\d{2}\b/i.exec(inside)?.[0]?.toUpperCase() ?? null;
  const kind = inside.replace(/\b\d{1,2}W-?\d{2}\b/i, '').replace(/^[\s,/-]+|[\s,/-]+$/g, '').trim();
  if (!grade && !kind) return null; // nothing beyond "Engine Oil": the plain item says it already
  return [grade, kind ? `(${kind})` : null, 'Engine Oil'].filter(Boolean).join(' ');
}

/** Item lines for the share text, with the engine oil pulled out to its own line when the data has a grade. */
export function shareItems(items: string[] | null | undefined): { items: string[]; engineOil: string | null } {
  const out: string[] = [];
  let engineOil: string | null = null;
  for (const raw of items ?? []) {
    for (const part of splitItem(raw)) {
      const oil: string | null = engineOil ? null : engineOilLine(part);
      if (oil) {
        engineOil = oil;
        continue;
      }
      if (!out.includes(part)) out.push(part);
    }
  }
  return { items: out, engineOil };
}

export interface JobShareInput {
  location?: LatLng | null;
  /** Heading, e.g. "Standard Service Package" or "AC Service & Repair". */
  title: string;
  /** The service on the customer line block, e.g. "Standard Service". */
  serviceName?: string | null;
  items?: string[] | null;
  price?: number | null;
  customerName?: string | null;
  /** Only when the garage may see it; the API leaves it empty otherwise. */
  customerPhone?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleFuel?: string | null;
  city?: string | null;
  needsPickup?: boolean | null;
  pickupSlot?: string | null;
  /** The planned drop-off / pick-up day. */
  date?: string | Date | null;
}

/**
 * The owner's format:
 *   <maps link>
 *
 *   <title>
 *
 *   * item ...
 *
 *   <engine oil>
 *
 *   Price value - Rs.11,229/-
 *
 *   <customer> / <mobile> / <service> / <car> / <city>
 *
 *   Pickup schedule - 28 Sep, 12 pm to 03 pm   (or "Customer drives in - 28 Sep")
 */
export function buildJobShareText(input: JobShareInput): string {
  const blocks: string[][] = [];
  if (input.location) blocks.push([mapsPinUrl(input.location)]);
  blocks.push([input.title.trim()]);

  const { items, engineOil } = shareItems(input.items);
  if (items.length) blocks.push(items.map((i) => `* ${i}`));
  if (engineOil) blocks.push([engineOil]);

  if (input.price != null && input.price > 0) blocks.push([`Price value - Rs.${formatIndianNumber(input.price)}/-`]);

  const car = [input.vehicleMake, input.vehicleModel, input.vehicleFuel].map((s) => s?.trim()).filter(Boolean).join(' ');
  const people = [input.customerName, input.customerPhone?.trim() ? input.customerPhone : null, input.serviceName, car, input.city]
    .map((s) => s?.trim())
    .filter((s): s is string => !!s);
  if (people.length) blocks.push(people);

  const day = formatShortDate(input.date);
  if (input.needsPickup) {
    const slot = formatPickupSlot(input.pickupSlot);
    const when = [day, slot].filter(Boolean).join(', ');
    blocks.push([`Pickup schedule - ${when || 'to be confirmed'}`]);
  } else {
    blocks.push([day ? `Customer drives in - ${day}` : 'Customer drives in']);
  }

  return blocks.map((b) => b.join('\n')).join('\n\n');
}

/** What the garage job detail gives us, in the shape the share text needs. */
export interface ShareableJob {
  servicePackageName?: string | null;
  serviceCategory?: string | null;
  serviceItems?: string[] | null;
  serviceValue?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleFuel?: string | null;
  needsPickup?: boolean | null;
  pickupSlot?: string | null;
  scheduledStartAtUtc?: string | null;
  preferredServiceDate?: string | null;
  customerLocation?: { latitude: number; longitude: number; city?: string | null } | null;
}

export function jobShareInput(job: ShareableJob): JobShareInput {
  const pkg = job.servicePackageName?.trim();
  const service = pkg || job.serviceCategory?.trim() || 'Car service';
  const title = pkg ? (/package/i.test(pkg) ? pkg : `${pkg} Package`) : service;
  const loc = job.customerLocation;
  return {
    location: loc ? { lat: loc.latitude, lng: loc.longitude } : null,
    title,
    serviceName: service,
    items: job.serviceItems,
    price: job.serviceValue,
    customerName: job.customerName,
    customerPhone: job.customerPhone,
    vehicleMake: job.vehicleMake,
    vehicleModel: job.vehicleModel,
    vehicleFuel: job.vehicleFuel,
    city: loc?.city,
    needsPickup: job.needsPickup,
    pickupSlot: job.pickupSlot,
    date: job.scheduledStartAtUtc || job.preferredServiceDate,
  };
}
