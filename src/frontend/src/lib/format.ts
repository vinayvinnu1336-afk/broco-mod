// Shared display formatting. The platform operates in India: amounts are INR and dates use en-IN.

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrWholeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** ₹1,23,456.00 — use for invoices, quotes and anything the user pays. */
export function formatINR(amount: number | null | undefined, currency = 'INR'): string {
  const value = Number(amount ?? 0);
  if (currency && currency !== 'INR') {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(value);
  }
  return inrFormatter.format(value);
}

/** ₹1,23,456 — compact form for dashboards and list rows. */
export function formatINRWhole(amount: number | null | undefined): string {
  return inrWholeFormatter.format(Math.round(Number(amount ?? 0)));
}

/** ₹1.2L / ₹3.4Cr — very compact form for KPI tiles. */
export function formatINRShort(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  const abs = Math.abs(value);
  if (abs >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(abs >= 10_00_00_000 ? 0 : 1)}Cr`;
  if (abs >= 1_00_000) return `₹${(value / 1_00_000).toFixed(abs >= 10_00_000 ? 0 : 1)}L`;
  if (abs >= 1_000) return `₹${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return formatINRWhole(value);
}

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 12 Oct 2026 */
export function formatDate(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** 12 Oct, 4:30 pm */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", then a date. */
export function formatRelative(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 0) return formatDateTime(date);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(date);
}

/** Turns API enum values like "WorkInProgress" or "WORK_IN_PROGRESS" into "Work in progress". */
export function humanize(value: string | null | undefined): string {
  if (!value) return '';
  const spaced = value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
