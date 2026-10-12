# BroCo Mod — mobile-first UI guidelines

Most users are on phones (375–430 px wide). Design every screen for a 375 px viewport first, then let it widen at `sm` (640), `md` (768, sidebar appears) and `lg` (1024).

## Shell (already built — do not re-implement)

- `PortalLayout` provides the top bar, the phone bottom tab bar (64 px + safe area) and the desktop sidebar. Pages render only their own content inside `<main>`, which already has horizontal padding and bottom padding for the tab bar.
- Never add another page-level header bar, sidebar, or full-bleed hero inside portal pages.

## Building blocks (`@/components/ui`)

| Need | Use |
|---|---|
| Page title, back link, page actions | `PageHeader` (`title`, `description`, `backHref`, `actions`, `eyebrow`) — every page starts with it |
| KPI numbers | `StatCard` in `grid grid-cols-2 lg:grid-cols-4 gap-3` |
| Lists of records | Phones: `ListGroup` + `ListItem` (`title`, `subtitle`, `meta`, `leading`, `trailing`, `href`). Desktop (`md+`): keep `Table` if it adds value: `<div className="hidden md:block"><Table/></div>` + `<div className="md:hidden"><ListGroup/></div>` |
| Leading icon in a list row | `IconTile` |
| Status | `StatusBadge status={x}` (handles every API enum, plain-language labels). Never hand-roll status colours |
| Status filters | `FilterChips` (horizontally scrolling on phones) |
| Main action of a screen (Submit, Accept, Pay, Send) | `ActionBar` (pinned above the tab bar on phones, inline on desktop) + `ActionBarSpacer` at the end of the page |
| Dialogs / pickers / confirmations | `Modal` (bottom sheet on phones; pass action buttons via `footer`) and `ConfirmationDialog` |
| Empty / loading / error | `EmptyState`, `LoadingState` (or `Skeleton`), `ErrorState` |
| Cards | `Card`, `CardHeader`, `CardTitle`, `CardContent` |
| Forms | `Input`, `Select`, `Textarea` (already 44 px tall, 16 px text on phones) |

## Formatting (`@/lib/format`)

- Money is INR: `formatINR(amount)` (₹1,23,456.00) for quotes/invoices/payments, `formatINRWhole` for list rows, `formatINRShort` for KPI tiles. Never print `$`.
- Dates: `formatDate`, `formatDateTime`, `formatRelative`. Enum text: `humanize`.

## Rules

1. **No horizontal scrolling** at 375 px, except intentional chip/tab rows. Wide tables are desktop-only; phones get list rows or stacked cards.
2. **Touch targets ≥ 44 px.** Whole list rows are tappable. Buttons in a row on phones should be full width (`w-full sm:w-auto`) or share the row equally.
3. **One primary action per screen**, in the `ActionBar` or `PageHeader` actions. Secondary actions are `outline`/`ghost` buttons.
4. **Typography**: page title from `PageHeader`; section titles `text-base font-semibold`; body `text-sm`; meta `text-xs text-navy-400/500`. Avoid ALL-CAPS labels and `tracking-wider` everywhere except tiny table headers on desktop. Use sentence case ("Service requests", not "Service Requests").
5. **Spacing**: sections `space-y-5 sm:space-y-6`; card padding `p-4 sm:p-5`; grids `gap-3`.
6. **Plain, honest copy**: no marketing jargon inside portals ("zero-trust isolation realm", "command centre", "telemetry"). Say what the screen does. Never show hard-coded fake data (fake ETAs, fake garage names, fake counts) as if it were real — show real API data or a neutral empty state.
7. **Colours**: navy-900 for text/strong surfaces, electric-600 for primary actions and active states, semantic colours only for status. White cards on `surface-50` background, `border-surface-200`, `rounded-2xl`.
8. **Loading**: show skeletons or `LoadingState`, never a blank screen. **Errors**: show `ErrorState` with retry where data failed to load; use toasts for action results.
9. **Keep behaviour identical**: same API calls, same request/response shapes, same routes and query params. Do not change files under `src/components`, `src/lib`, `src/context` or `src/types` (shared) — note needed changes in your report instead.
10. **Accessibility**: icon-only buttons need `aria-label`; inputs need labels; keep focus styles.
