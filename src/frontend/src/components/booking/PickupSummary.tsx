import React from 'react';
import { CarFront, Truck } from 'lucide-react';
import { PickupFields, formatPickup, formatPreferredVisit } from '@/components/booking/pickup';

/**
 * "Pick-up & drop: Yes, Morning 9-12 - Gate 2" plus the customer's chosen day, as a small block for
 * staff screens (garage, advisor, admin).
 */
export function PickupSummary({
  className = '',
  preferredServiceDate,
  ...pickup
}: PickupFields & { className?: string; preferredServiceDate?: string | null }) {
  const yes = !!pickup.needsPickup;
  const visit = formatPreferredVisit(preferredServiceDate, pickup.pickupSlot);
  const Icon = yes ? Truck : CarFront;
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl p-3 text-sm ${
        yes ? 'bg-electric-50 text-electric-900' : 'bg-surface-50 text-navy-700'
      } ${className}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${yes ? 'text-electric-600' : 'text-navy-400'}`} aria-hidden />
      <div className="min-w-0">
        <div className={`text-xs font-medium ${yes ? 'text-electric-700' : 'text-navy-500'}`}>Pick-up &amp; drop</div>
        <div className="break-words font-semibold">{formatPickup(pickup)}</div>
        {visit && (
          <div className="mt-1.5 break-words">
            <span className={`text-xs font-medium ${yes ? 'text-electric-700' : 'text-navy-500'}`}>
              {yes ? 'Pick-up date' : 'Preferred visit'}:{' '}
            </span>
            <span className="font-semibold">{visit}</span>
          </div>
        )}
      </div>
    </div>
  );
}
