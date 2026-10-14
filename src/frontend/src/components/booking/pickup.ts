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
