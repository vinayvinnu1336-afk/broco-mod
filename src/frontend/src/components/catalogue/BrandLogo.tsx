'use client';

import React, { useState } from 'react';
import { assetUrl } from '@/lib/catalogue';

const TILE_COLOURS = [
  'bg-electric-50 text-electric-700',
  'bg-emerald-50 text-emerald-700',
  'bg-amber-50 text-amber-700',
  'bg-rose-50 text-rose-700',
  'bg-violet-50 text-violet-700',
  'bg-sky-50 text-sky-700',
];

function initials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, ' ').split(' ').filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export interface BrandLogoProps {
  name: string;
  logoUrl?: string | null;
  /** Pixel size of the square tile. */
  size?: number;
  className?: string;
}

/**
 * Manufacturer logo in a neutral square tile; falls back to the brand's initials when there is
 * no logo (or it fails to load). Logos only identify the car — see /public/brands/NOTICE.md.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ name, logoUrl, size = 40, className = '' }) => {
  const [failed, setFailed] = useState(false);
  const src = assetUrl(logoUrl);
  const colour = TILE_COLOURS[name.length % TILE_COLOURS.length];

  if (!src || failed) {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.34)) }}
        className={`inline-flex shrink-0 items-center justify-center rounded-xl font-bold tracking-tight ${colour} ${className}`}
      >
        {initials(name)}
      </span>
    );
  }

  return (
    <span
      style={{ width: size, height: size }}
      className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-white ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        onError={() => setFailed(true)}
        // Wider than tall so wordmarks (BYD, Isuzu, Jaguar) get the tile's width; square marks stay at 72%.
        style={{ width: Math.round(size * 0.86), height: Math.round(size * 0.72) }}
        className="object-contain"
      />
    </span>
  );
};
