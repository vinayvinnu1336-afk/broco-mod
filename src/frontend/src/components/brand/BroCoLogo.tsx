import React from 'react';

/**
 * The tile gradient of the owner's logo (docs/brand/logo-original.png): deep blue top-left to sky blue
 * bottom-right. Same stops as the <linearGradient> in /icon.svg.
 */
export const BROCO_TILE_GRADIENT =
  'linear-gradient(135deg, #0130BA 0%, #0433BF 12%, #0389FC 50%, #44C5FE 85%, #54CCFE 100%)';

/**
 * The white car of the owner's logo, traced from docs/brand/logo-original.png on a 128x128 grid
 * (0.1 unit = 1 px of the original). Roof + A-pillars are one stroked path; the body is an outer
 * rounded shape minus an inner one (the corners are rounder at the shoulders than at the bottom);
 * mirrors, headlights and the two wheel stubs are filled shapes. Keep in sync with /icon.svg.
 */
export function BroCoCar() {
  return (
    <>
      <path
        d="M39.6 60.4 46.4 45.7A6 6 0 0 1 51.8 42.2H76.2A6 6 0 0 1 81.6 45.7L88.4 60.4"
        fill="none"
        stroke="#fff"
        strokeWidth="5"
      />
      <g fill="#fff" fillRule="evenodd">
        <path d="M41.9 57.7H86.1A10.4 10.4 0 0 1 96.5 68.1V78.1A6.5 6.5 0 0 1 90 84.6H38A6.5 6.5 0 0 1 31.5 78.1V68.1A10.4 10.4 0 0 1 41.9 57.7ZM42 62.3H86A5.6 5.6 0 0 1 91.8 68.1V76.4A3.9 3.9 0 0 1 87.9 80.3H40.1A3.9 3.9 0 0 1 36.2 76.4V68.1A5.6 5.6 0 0 1 42 62.3Z" />
        <path d="M36.6 81.7H44.8V87.3A4.1 4.1 0 0 1 36.6 87.3ZM39 84.6H42.5V87.2A1.75 1.75 0 0 1 39 87.2ZM83.2 81.7H91.4V87.3A4.1 4.1 0 0 1 83.2 87.3ZM85.5 84.6H89V87.2A1.75 1.75 0 0 1 85.5 87.2Z" />
        <ellipse cx="35" cy="54.9" rx="4.9" ry="4" />
        <ellipse cx="93" cy="54.9" rx="4.9" ry="4" />
        <circle cx="46.5" cy="71.9" r="4" />
        <circle cx="81.5" cy="71.9" r="4" />
      </g>
    </>
  );
}

/**
 * The BroCo app icon: white car on a blue gradient tile (same artwork as /icon.svg).
 * The tile is a CSS gradient, not an SVG <linearGradient>, so it never depends on element ids:
 * SVG gradients defined inside a hidden copy of the logo (e.g. a desktop-only header variant)
 * would otherwise disappear from the visible copy.
 * The car is cropped tighter than in the original artwork (70% of the tile instead of 53%) so it
 * stays legible at header sizes. Decorative by default; pass `label` when it stands alone.
 */
export function BroCoMark({ size = 36, className = '', label }: { size?: number; className?: string; label?: string }) {
  return (
    <span
      aria-hidden={label ? undefined : 'true'}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        background: BROCO_TILE_GRADIENT,
      }}
    >
      <svg
        viewBox="15.5 17 97 97"
        width={size}
        height={size}
        focusable="false"
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : 'true'}
      >
        <BroCoCar />
      </svg>
    </span>
  );
}

export interface BroCoLogoProps {
  size?: number;
  /** "dark" = for dark backgrounds (white wordmark). */
  tone?: 'light' | 'dark';
  /** Show "Your Vehicle, Our Responsibility" under the name. */
  tagline?: boolean;
  /** Small text under the name instead of the tagline (e.g. "Garage"). */
  caption?: React.ReactNode;
  className?: string;
}

export const BROCO_TAGLINE = 'Your Vehicle, Our Responsibility';

/** Icon + "BroCo" wordmark. */
export function BroCoLogo({ size = 36, tone = 'light', tagline = false, caption, className = '' }: BroCoLogoProps) {
  const name = tone === 'dark' ? 'text-white' : 'text-navy-900';
  const accent = tone === 'dark' ? 'text-sky-300' : 'text-electric-600';
  const sub = tone === 'dark' ? 'text-surface-300' : 'text-surface-500';
  return (
    <span className={`inline-flex min-w-0 items-center gap-2.5 ${className}`}>
      <BroCoMark size={size} />
      <span className="min-w-0 leading-tight">
        <span className={`block text-[17px] font-extrabold tracking-tight sm:text-lg ${name}`}>
          Bro<span className={accent}>Co</span>
        </span>
        {(tagline || caption) && (
          <span className={`block truncate text-[11px] font-medium ${sub}`}>{caption ?? BROCO_TAGLINE}</span>
        )}
      </span>
    </span>
  );
}
