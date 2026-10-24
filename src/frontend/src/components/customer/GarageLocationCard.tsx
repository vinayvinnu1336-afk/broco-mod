import React from 'react';
import { MapPin, Navigation, Phone } from 'lucide-react';
import type { CustomerGarageLocationDto } from '@/types/serviceJob';
import { directionsUrl, mapsPinUrl, osmEmbedUrl } from '@/lib/jobShare';

/**
 * Where a drive-in customer takes the car: the workshop's name, address and pin, with one-tap directions and call.
 * The API sends it once the 10% advance is paid. The map is an OpenStreetMap embed, so it needs no Maps key.
 */
export function GarageLocationCard({
  location,
  className = '',
}: {
  location: CustomerGarageLocationDto;
  className?: string;
}) {
  const pin = { lat: location.latitude, lng: location.longitude };
  const phone = location.phone?.trim();
  const linkClass =
    'inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-600 focus-visible:ring-offset-2';

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-card ${className}`}
    >
      <iframe
        title={`Map showing ${location.name}`}
        src={osmEmbedUrl(pin)}
        className="block h-44 w-full border-0 sm:h-52"
        loading="lazy"
      />
      <div className="space-y-3 p-4 text-sm sm:p-5">
        <div>
          <h2 className="text-base font-semibold text-navy-900">
            Where to take your car
          </h2>
          <p className="mt-0.5 text-xs text-navy-500">
            You chose to drive in. The garage is expecting you.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-electric-50 text-electric-600">
            <MapPin className="h-4 w-4" aria-hidden />
          </span>
          <address className="min-w-0 flex-1 not-italic">
            <div className="break-words font-semibold text-navy-900">
              {location.name}
            </div>
            {location.address && (
              <div className="break-words text-navy-700">
                {location.address}
              </div>
            )}
            {location.city &&
              !location.address
                ?.toLowerCase()
                .includes(location.city.toLowerCase()) && (
                <div className="text-navy-500">{location.city}</div>
              )}
            <a
              href={mapsPinUrl(pin)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-xs font-medium text-electric-700 hover:underline"
            >
              Open in Google Maps
            </a>
          </address>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href={directionsUrl(pin)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${linkClass} bg-electric-600 text-white shadow-sm hover:bg-electric-700`}
          >
            <Navigation className="h-4 w-4" aria-hidden />
            Get directions
          </a>
          {phone && (
            <a
              href={`tel:${phone.replace(/\s+/g, '')}`}
              className={`${linkClass} border border-surface-300 bg-white text-navy-800 hover:bg-surface-50`}
            >
              <Phone className="h-4 w-4" aria-hidden />
              Call garage
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
