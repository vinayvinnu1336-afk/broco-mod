// Staff (admin + advisor) view of BroCo commission garages still owe, and on-demand reminders.
import { apiFetch } from '@/lib/api';
import type { Commission } from '@/components/admin/catalogueAdminApi';
import type { PagedResult } from '@/components/admin/FormControls';

export type DuesPortal = 'admin' | 'advisor';
export type DuesStatus = 'Due' | 'Overdue' | 'Paid' | 'Waived' | 'All';
export type DuesSort = 'due' | 'garage' | 'amount' | 'reminded';

/** A commission row on the staff lists, with the garage's contact and collection state. */
export interface GarageDue extends Commission {
  garagePhone?: string | null;
  daysOverdue?: number;
  /** The garage has a due older than the blocking threshold, so it gets no new jobs. */
  garageBlocked?: boolean;
  /** Staff can send the next manual reminder after this time; null = now. */
  nextManualReminderAtUtc?: string | null;
}

export interface GarageDuesOverview {
  outstandingAmount: number;
  outstandingCount: number;
  overdueAmount: number;
  overdueCount: number;
  garagesWithDues: number;
  garagesWithOverdue: number;
  garagesBlocked: number;
  /** Admin only. */
  collectedAmount?: number;
}

export interface GarageDuesSummary {
  garageId: string;
  garageName: string;
  garagePhone: string;
  outstandingAmount: number;
  outstandingCount: number;
  overdueAmount: number;
  overdueCount: number;
  oldestDueAtUtc: string | null;
  newJobsBlocked: boolean;
  lastReminderAtUtc: string | null;
}

export interface ReminderResult {
  sent: boolean;
  message: string;
  commission: GarageDue;
  notSentReason?: string | null;
}

export interface BulkReminderResult {
  duesReminded: number;
  garagesReminded: number;
  skippedRecentlyReminded: number;
}

export interface DuesQuery {
  search?: string;
  status: DuesStatus;
  garageId?: string;
  /** ISO timestamps. */
  dueFrom?: string;
  dueTo?: string;
  sort?: DuesSort;
  page: number;
  pageSize: number;
  /** Garages of one city (admins; advisors always get their own city). */
  city?: string;
}

const base = (portal: DuesPortal) => (portal === 'admin' ? '/admin/commissions' : '/advisor/commissions');

export const garageDuesApi = {
  list: (portal: DuesPortal, query: DuesQuery) => {
    const q = new URLSearchParams();
    q.set('status', query.status);
    if (query.search?.trim()) q.set('search', query.search.trim());
    if (query.garageId) q.set('garageId', query.garageId);
    if (query.dueFrom) q.set('dueFrom', query.dueFrom);
    if (query.dueTo) q.set('dueTo', query.dueTo);
    if (query.sort && query.sort !== 'due') q.set('sort', query.sort);
    if (query.city) q.set('city', query.city);
    q.set('page', String(query.page));
    q.set('pageSize', String(query.pageSize));
    return apiFetch<PagedResult<GarageDue>>(`${base(portal)}?${q.toString()}`);
  },
  overview: (portal: DuesPortal, city?: string) =>
    apiFetch<GarageDuesOverview>(`${base(portal)}/overview${city ? `?city=${encodeURIComponent(city)}` : ''}`),
  garages: (portal: DuesPortal, city?: string) =>
    apiFetch<GarageDuesSummary[]>(`${base(portal)}/garages${city ? `?city=${encodeURIComponent(city)}` : ''}`),
  remind: (portal: DuesPortal, id: string) => apiFetch<ReminderResult>(`${base(portal)}/${id}/remind`, { method: 'POST' }),
  remindOverdue: (portal: DuesPortal, garageId?: string) =>
    apiFetch<BulkReminderResult>(`${base(portal)}/remind-overdue`, {
      method: 'POST',
      body: JSON.stringify({ garageId: garageId || null }),
    }),
};

export const duesPageHref = (portal: DuesPortal) => (portal === 'admin' ? '/admin/commissions' : '/advisor/garage-dues');

/** Fired after a reminder, payment or waiver so nav badges and cards refresh. */
export const GARAGE_DUES_CHANGED = 'broco:garage-dues-changed';
export function announceGarageDuesChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(GARAGE_DUES_CHANGED));
}

/** Start / end of a local calendar day ("2026-10-14") as an ISO timestamp. */
export const dayStartIso = (day: string) => new Date(`${day}T00:00:00`).toISOString();
export const dayEndIso = (day: string) => new Date(`${day}T23:59:59.999`).toISOString();

export const isOpenDue = (c: Commission) => c.status.toLowerCase() === 'due';
