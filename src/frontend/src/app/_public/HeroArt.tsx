import React from 'react';

/**
 * Line-art "BroCo service centre" scene in the logo's style: a workshop facade with three bays and
 * the logo car, headlights on, in the middle bay. Pure SVG, so it is crisp and costs ~3 KB.
 */
export function HeroArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 560 400" className={className} role="img" aria-label="BroCo service centre">
      <defs>
        <linearGradient id="heroSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#DCEBFF" />
          <stop offset="1" stopColor="#F4F8FF" />
        </linearGradient>
        <linearGradient id="heroFacade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0B2A63" />
          <stop offset="1" stopColor="#0A192F" />
        </linearGradient>
        <linearGradient id="heroBay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1B3B7A" />
          <stop offset="1" stopColor="#24508F" />
        </linearGradient>
        <linearGradient id="heroFloor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C9D6EA" />
          <stop offset="1" stopColor="#EEF3FA" />
        </linearGradient>
        <linearGradient id="heroCar" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0A4FCF" />
          <stop offset="1" stopColor="#3FA9FF" />
        </linearGradient>
        <radialGradient id="heroBeam" cx="0.5" cy="0" r="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sky + skyline */}
      <rect width="560" height="400" rx="28" fill="url(#heroSky)" />
      <g fill="#C3D5F0">
        <rect x="24" y="118" width="26" height="92" rx="3" />
        <rect x="56" y="96" width="34" height="114" rx="3" />
        <rect x="96" y="132" width="22" height="78" rx="3" />
        <rect x="470" y="104" width="30" height="106" rx="3" />
        <rect x="506" y="128" width="28" height="82" rx="3" />
      </g>

      {/* Workshop facade */}
      <path d="M118 210V92a14 14 0 0 1 9-13l150-56a14 14 0 0 1 10 0l150 56a14 14 0 0 1 9 13v118Z" fill="url(#heroFacade)" />
      {/* Sign */}
      <rect x="214" y="70" width="132" height="44" rx="10" fill="#0E3A86" stroke="#3FA9FF" strokeOpacity="0.5" />
      <text x="280" y="96" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontWeight="800" fontSize="21" fill="#FFFFFF">
        Bro<tspan fill="#7CC8FF">Co</tspan>
      </text>
      <text x="280" y="108" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontWeight="700" fontSize="7.5" letterSpacing="2.4" fill="#A9C8F5">
        SERVICE CENTRE
      </text>

      {/* Bays */}
      {[132, 232, 342].map((x, i) => (
        <g key={x}>
          <rect x={x} y="128" width={i === 1 ? 96 : 86} height="82" rx="6" fill="url(#heroBay)" />
          {[0, 1, 2, 3].map((r) => (
            <rect key={r} x={x} y={128 + r * 7} width={i === 1 ? 96 : 86} height="3" fill="#0A192F" opacity="0.35" />
          ))}
        </g>
      ))}

      {/* Floor */}
      <path d="M0 210h560v162a28 28 0 0 1-28 28H28A28 28 0 0 1 0 372Z" fill="url(#heroFloor)" />
      <g stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.8">
        <path d="M280 236v18M280 270v18M280 304v18M280 338v20" />
      </g>

      {/* Headlight beams */}
      <path d="M232 300 150 400h80Z" fill="url(#heroBeam)" opacity="0.5" />
      <path d="M328 300 410 400h-80Z" fill="url(#heroBeam)" opacity="0.5" />

      {/* Car (logo artwork, scaled) */}
      <ellipse cx="280" cy="352" rx="118" ry="12" fill="#0A192F" opacity="0.18" />
      <g transform="translate(176 176) scale(3.25)">
        <path d="M19.5 30 22.4 21.6A3.4 3.4 0 0 1 25.6 19.3h12.8a3.4 3.4 0 0 1 3.2 2.3L44.5 30Z" fill="#9FD3FF" opacity="0.55" />
        <rect x="13" y="30" width="38" height="14.5" rx="4.2" fill="url(#heroCar)" />
        <g fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19.5 30 22.4 21.6A3.4 3.4 0 0 1 25.6 19.3h12.8a3.4 3.4 0 0 1 3.2 2.3L44.5 30" />
          <rect x="13" y="30" width="38" height="14.5" rx="4.2" />
          <path d="M15.5 44.5v5.6a1.9 1.9 0 0 0 3.8 0v-5.6M44.7 44.5v5.6a1.9 1.9 0 0 0 3.8 0v-5.6" />
        </g>
        <g fill="#FFFFFF">
          <ellipse cx="11.9" cy="27.7" rx="3.4" ry="2.3" />
          <ellipse cx="52.1" cy="27.7" rx="3.4" ry="2.3" />
          <circle cx="20.6" cy="37.3" r="2.8" />
          <circle cx="43.4" cy="37.3" r="2.8" />
        </g>
        <rect x="27" y="39.5" width="10" height="3" rx="1" fill="#FFFFFF" opacity="0.9" />
      </g>
    </svg>
  );
}
