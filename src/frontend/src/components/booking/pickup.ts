/** Free pick-up & drop: what the customer chose at booking, shown the same way on every screen. */

export const PICKUP_SLOTS = [
  { key: 'morning', label: 'Morning', hint: '9 am – 12 pm', value: 'Morning 9-12', hour: 9 },
  { key: 'afternoon', label: 'Afternoon', hint: '12 – 3 pm', value: 'Afternoon 12-3', hour: 12 },
  { key: 'evening', label: 'Evening', hint: '3 – 6 pm', value: 'Evening 3-6', hour: 15 },
] as const;

export type PickupSlotKey = (typeof PICKUP_SLOTS)[number]['key'];

export interface PickupFields {
  needsPickup?: boolean | null;
  pickupNotes?: string | null;
  pickupSlot?: string | null;
}

/** "Yes, Morning 9-12 - Gate 2" or "No, customer drives in". */
export function formatPickup(p: PickupFields, driveInText = 'No, customer drives in'): string {
  if (!p.needsPickup) return driveInText;
  const slot = p.pickupSlot?.trim();
  const notes = p.pickupNotes?.trim();
  const head = slot ? `Yes, ${slot}` : 'Yes';
  return notes ? `${head} - ${notes}` : head;
}

/**
 * The day (and slot) the customer asked for, e.g. "Fri, 24 Oct 2026 · Morning 9-12".
 * Drive-in bookings carry no pickupSlot, so their slot is read back from the hour the booking form stores.
 */
export function formatPreferredVisit(preferredServiceDate: string | null | undefined, pickupSlot?: string | null): string | null {
  if (!preferredServiceDate) return null;
  const when = new Date(preferredServiceDate);
  if (Number.isNaN(when.getTime())) return null;
  const day = when.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const slot = pickupSlot?.trim() || PICKUP_SLOTS.find((s) => s.hour === when.getHours() && when.getMinutes() === 0)?.value;
  return slot ? `${day} · ${slot}` : day;
}
