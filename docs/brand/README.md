# BroCo brand assets

| File | What it is | Used for |
|---|---|---|
| `app-icon-512.png` | Blue tile with white car (from the owner's artwork) | Source for `src/frontend/public/icon-*.png`, `apple-touch-icon.png`, `favicon-48.png` |
| `hero-service-centre-original.png` | Car outside the "BRO Co Service Center" (890×380) | Source for the home-page hero photos |

The website also has a hand-drawn SVG copy of the icon (`src/frontend/public/icon.svg` and
`src/frontend/src/components/brand/BroCoLogo.tsx`) so it stays sharp at any size.

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
