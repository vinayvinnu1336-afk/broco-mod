import React from 'react';

/**
 * The BroCo app icon: white car on a blue gradient tile (same artwork as /icon.svg).
 * Every copy defines the same gradient id, so repeated logos on one page render identically.
 */
export function BroCoMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="brocoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#062A9E" />
          <stop offset="0.55" stopColor="#0A72E0" />
          <stop offset="1" stopColor="#5CC4FF" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#brocoGrad)" />
      <g fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19.5 30 22.4 21.6A3.4 3.4 0 0 1 25.6 19.3h12.8a3.4 3.4 0 0 1 3.2 2.3L44.5 30" />
        <rect x="13" y="30" width="38" height="14.5" rx="4.2" />
        <path d="M15.5 44.5v5.6a1.9 1.9 0 0 0 3.8 0v-5.6M44.7 44.5v5.6a1.9 1.9 0 0 0 3.8 0v-5.6" />
      </g>
      <g fill="#fff">
        <ellipse cx="11.9" cy="27.7" rx="3.4" ry="2.3" />
        <ellipse cx="52.1" cy="27.7" rx="3.4" ry="2.3" />
        <circle cx="20.6" cy="37.3" r="2.6" />
        <circle cx="43.4" cy="37.3" r="2.6" />
      </g>
    </svg>
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
