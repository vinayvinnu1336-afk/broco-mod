'use client';

import { useCallback, useMemo, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * List-screen filters kept in the URL query string, so a refresh or a shared link shows the same list.
 * A value equal to its default is left out of the URL. Changing any filter drops `page` (back to page 1).
 *
 * Pages using this must render under a <Suspense> boundary (Next.js requirement for useSearchParams).
 *
 *   const filters = useUrlFilters({ q: '', status: '', range: '', from: '', to: '' });
 *   filters.values.status; filters.set({ status: 'Paid' }); filters.page; filters.setPage(2);
 */
export function useUrlFilters<K extends string>(defaults: Record<K, string>) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const query = searchParams?.toString() ?? '';

  const values = useMemo(() => {
    const params = new URLSearchParams(query);
    const next = { ...defaultsRef.current };
    (Object.keys(next) as K[]).forEach((key) => {
      const v = params.get(key);
      if (v !== null) next[key] = v;
    });
    return next;
  }, [query]);

  const page = useMemo(() => {
    const n = parseInt(new URLSearchParams(query).get('page') ?? '1', 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, [query]);

  // Build from the live URL, not the last render, so two quick updates (typing + a chip) don't undo each other.
  const write = useCallback(
    (edit: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : query);
      edit(params);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, query, router]
  );

  const set = useCallback(
    (patch: Partial<Record<K, string>>) =>
      write((params) => {
        (Object.keys(patch) as K[]).forEach((key) => {
          const v = patch[key] ?? '';
          if (v === '' || v === defaultsRef.current[key]) params.delete(key);
          else params.set(key, v);
        });
        params.delete('page');
      }),
    [write]
  );

  const setPage = useCallback(
    (p: number) =>
      write((params) => {
        if (p <= 1) params.delete('page');
        else params.set('page', String(p));
      }),
    [write]
  );

  /** Back to defaults for the given keys (all filter keys when omitted). */
  const reset = useCallback(
    (keys?: K[]) =>
      write((params) => {
        (keys ?? (Object.keys(defaultsRef.current) as K[])).forEach((key) => params.delete(key));
        params.delete('page');
      }),
    [write]
  );

  const isActive = useCallback((key: K) => values[key] !== defaultsRef.current[key], [values]);

  return { values, set, setPage, reset, page, isActive, defaults: defaultsRef.current };
}

export type UrlFilters<K extends string> = ReturnType<typeof useUrlFilters<K>>;

// ---------------------------------------------------------------------------------------------
// Date range: `range` is '' (any time), 'today', '7d', '30d' or 'custom' with `from` / `to` as
// local calendar dates (YYYY-MM-DD).

export type DateRangeValues = { range?: string; from?: string; to?: string };

export const DATE_RANGE_OPTIONS = [
  { value: '', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom dates' },
];

/** The API accepts at most this many days in one custom range. */
export const MAX_RANGE_DAYS = 366;

function parseLocalDate(value?: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Start and end of the chosen range as Date objects (either may be missing). */
export function dateRangeBounds(v: DateRangeValues): { from?: Date; to?: Date } {
  switch (v.range) {
    case 'today':
      return { from: startOfToday() };
    case '7d': {
      const d = startOfToday();
      d.setDate(d.getDate() - 6);
      return { from: d };
    }
    case '30d': {
      const d = startOfToday();
      d.setDate(d.getDate() - 29);
      return { from: d };
    }
    case 'custom': {
      const from = parseLocalDate(v.from) ?? undefined;
      const toDay = parseLocalDate(v.to);
      const to = toDay ? new Date(toDay.getFullYear(), toDay.getMonth(), toDay.getDate(), 23, 59, 59, 999) : undefined;
      return { from, to };
    }
    default:
      return {};
  }
}

/** Problem with a custom range the user typed, or null when it is fine. */
export function dateRangeError(v: DateRangeValues): string | null {
  if (v.range !== 'custom') return null;
  const { from, to } = dateRangeBounds(v);
  if (from && to && from > to) return 'The start date is after the end date.';
  if (from && to && (to.getTime() - from.getTime()) / 86_400_000 > MAX_RANGE_DAYS) return `Pick at most ${MAX_RANGE_DAYS} days.`;
  return null;
}

/**
 * API query values for the range as UTC ISO strings, e.g. { fromDateUtc, toDateUtc }.
 * Nothing is sent while a custom range is invalid. Pass other key names for endpoints that use them.
 */
export function dateRangeQuery(v: DateRangeValues, keys: [string, string] = ['fromDateUtc', 'toDateUtc']): Record<string, string> {
  if (dateRangeError(v)) return {};
  const { from, to } = dateRangeBounds(v);
  const out: Record<string, string> = {};
  if (from) out[keys[0]] = from.toISOString();
  if (to) out[keys[1]] = to.toISOString();
  return out;
}

/** Client-side check for lists that are fully loaded in the browser. */
export function inDateRange(value: string | null | undefined, v: DateRangeValues): boolean {
  if (!v.range) return true;
  if (dateRangeError(v)) return true;
  if (!value) return false;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return false;
  const { from, to } = dateRangeBounds(v);
  return (!from || t >= from.getTime()) && (!to || t <= to.getTime());
}

/** Case-insensitive match of the search box against any of the given fields (spaces ignored for numbers). */
export function matchesSearch(search: string, ...fields: (string | number | null | undefined)[]): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const compact = q.replace(/\s+/g, '');
  return fields.some((f) => {
    if (f === null || f === undefined) return false;
    const text = String(f).toLowerCase();
    return text.includes(q) || (compact.length > 0 && text.replace(/\s+/g, '').includes(compact));
  });
}

/** `?a=1&b=x` from the non-empty entries (an empty string when there are none). */
export function toQueryString(params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    sp.set(key, String(value));
  });
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}
