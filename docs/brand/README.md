# BroCo brand assets

| File | What it is | Used for |
|---|---|---|
| `logo-original.png` | The owner's logo (1254×1254): white line-art car on a blue gradient | Reference for the vector mark below and for every app icon |
| `app-icon-512.png` | Earlier, tighter-cropped export of the same artwork | Superseded by `logo-original.png`; kept for reference |
| `hero-service-centre-original.png` | Car outside the "BRO Co Service Center" (890×380) | Source for the home-page hero photos |

## The mark

The website never shows the PNG. The car is traced as vectors so it is crisp at every size:

- `src/frontend/src/components/brand/BroCoLogo.tsx` — `BroCoCar` (the white car on a 128×128 grid,
  0.1 unit = 1 px of `logo-original.png`), `BroCoMark` (car on the gradient tile, rounded corners) and
  `BroCoLogo` (mark + "BroCo" wordmark, optional tagline/caption). Used by the public header and footer,
  the portal header and the auth pages.
- `src/frontend/public/icon.svg` — the same car and gradient as a standalone SVG (favicon and the
  `"sizes": "any"` entry of the web manifest).

How the car is built (all white, measured from the original):

| Part | Geometry |
|---|---|
| Roof + A-pillars | One stroked path, stroke 5 (47 px), pillars at ~65° from horizontal, 6-unit corner arcs |
| Body | Outer rounded shape (corner radius 10.4 at the shoulders, 6.5 at the bottom) minus an inner one (5.6 / 3.9), `fill-rule="evenodd"` |
| Wing mirrors | Ellipses rx 4.9, ry 4 touching the pillars |
| Headlights | Circles r 4 |
| Wheel stubs | 8.2-wide U shapes with a 3.5-wide slot, hanging from the body bottom |

Gradient (135°, top-left to bottom-right): `#0130BA` 0% → `#0433BF` 12% → `#0389FC` 50% →
`#44C5FE` 85% → `#54CCFE` 100%. It is a CSS gradient in `BroCoMark` (so a hidden copy of the logo can
never break the visible one through duplicate SVG ids) and an SVG `<linearGradient>` in `icon.svg`.

Framing: the original artwork leaves generous padding (the car is 53% of the tile wide). The full-bleed
app icons keep that framing because it falls inside the maskable safe zone (centre 80% circle), which is
why one `icon-512.png` serves both `"purpose": "any"` and `"maskable"` in `manifest.webmanifest`. The
header mark and the favicon crop tighter (car = 70% of the tile, `viewBox="15.5 17 97 97"` / the
`scale(1.32)` group in `icon.svg`) so the car is still readable at 16–40 px.

## Regenerating the icons

`src/frontend/public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180 px) and `favicon-48.png`
are rendered from `icon.svg`, not drawn by hand. After changing the car or the gradient:

1. Make the same change in `BroCoLogo.tsx` and `icon.svg` (the path data is identical).
2. Render `icon.svg` with headless Chrome (Playwright is already in `src/frontend/node_modules`): load the
   SVG in a page sized to the target, screenshot it. For the three full-bleed icons drop the `rx` on the
   background rect and the `transform` on the car group first (original framing, square corners — iOS
   and Android round the corners themselves). For `favicon-48.png` render `icon.svg` as is with a
   transparent page background.
3. Look at every output at 100% and at the size it is shown (favicon 16–32 px, home-screen icon ~60 px).

Keep the file names: `src/frontend/src/app/layout.tsx` and `manifest.webmanifest` reference them, and
browsers cache them.

## Replacing the hero photo

The current photo is only 890 px wide, so it is slightly soft on large and high-resolution screens.
A version **at least 2400 px wide** (same framing: empty, light left side; car right of centre; nothing
important touching the bottom edge) will look crisp everywhere.

1. Export JPEGs at 640, 1280 and 2400 px wide (quality ~82) with a **new name**, e.g.
   `hero-service-centre-v2-640.jpg`, `-1280.jpg`, `-2400.jpg`, into `src/frontend/public/images/`.
   Browsers cache `/images/*` for a year, so never overwrite an existing file name.
2. In `src/frontend/src/app/page.tsx` (hero `<picture>`), point `src`, `srcSet` and the `<source>` at the new
   files and list all three widths in `srcSet`.
3. Keep the composition in mind: on laptops the photo is right-aligned behind the headline, on phones it is
   cropped to the right-hand ~85% (car and sign).
