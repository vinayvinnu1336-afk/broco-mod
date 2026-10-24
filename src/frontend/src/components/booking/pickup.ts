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

/** A stored slot ("Afternoon 12-3") as people read it: "Afternoon (12 – 3 pm)". Unknown text is shown as is. */
export function formatSlot(slot: string | null | undefined): string | null {
  const s = slot?.trim();
  if (!s) return null;
  const known = PICKUP_SLOTS.find((x) => x.value.toLowerCase() === s.toLowerCase() || x.key === s.toLowerCase());
  return known ? `${known.label} (${known.hint})` : s;
}

/** "Yes, Morning (9 am – 12 pm) - Gate 2" or "No, customer drives in". */
export function formatPickup(p: PickupFields, driveInText = 'No, customer drives in'): string {
  if (!p.needsPickup) return driveInText;
  const slot = formatSlot(p.pickupSlot);
  const notes = p.pickupNotes?.trim();
  const head = slot ? `Yes, ${slot}` : 'Yes';
  return notes ? `${head} - ${notes}` : head;
}

/**
 * The day and time the customer asked for, e.g. "Fri, 24 Oct 2026 · Afternoon (12 – 3 pm)", or "Any day · Morning
 * (9 am – 12 pm)" when they picked no day. Older drive-in bookings stored no slot, so it is read back from the hour
 * the booking form puts on the date.
 */
export function formatPreferredVisit(preferredServiceDate: string | null | undefined, pickupSlot?: string | null): string | null {
  const when = preferredServiceDate ? new Date(preferredServiceDate) : null;
  const hasDay = !!when && !Number.isNaN(when.getTime());
  const fromHour = hasDay ? PICKUP_SLOTS.find((s) => s.hour === when!.getHours() && when!.getMinutes() === 0)?.value : undefined;
  const slot = formatSlot(pickupSlot) ?? formatSlot(fromHour);
  if (!hasDay) return slot ? `Any day · ${slot}` : null;
  const day = when!.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return slot ? `${day} · ${slot}` : day;
}
