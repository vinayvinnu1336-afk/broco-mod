'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { Car, CheckCircle2, ChevronRight, ClipboardList, FileCheck2, Plus, Wrench, X } from 'lucide-react';
import { BookingIntent, carLabel, clearBookingIntent, loadBookingIntent } from '@/lib/catalogue';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatINR, formatINRWhole, formatRelative } from '@/lib/format';
import {
  RequestProgress,
  SectionTitle,
  isRequestFinished,
  requestNextStep,
  statusKey,
} from '@/app/customer/_lib/customer-ui';

interface CustomerDashboardData {
  customerId: string;
  customerName: string;
  activeRequestsCount: number;
  availableQuotesCount: number;
  registeredVehiclesCount: number;
  recentRequests: Array<{
    id: string;
    vehicleMake: string;
    vehicleModel: string;
    vehicleYear: number;
    description: string;
    status: string;
    createdAtUtc: string;
    quotesReceivedCount: number;
  }>;
  pendingQuotes: Array<{
    id: string;
    serviceRequestId: string;
    vehicleSummary: string;
    customerFacingPrice: number;
    scopeSummary: string;
    status: string;
    createdAtUtc: string;
  }>;
}

/** Package / advance fields on GET /customer/requests rows. */
interface RequestSummaryExtras {
  id: string;
  servicePackageName?: string | null;
  packagePrice?: number | null;
  isAdvancePaid?: boolean;
}

const PACKAGE_NAMES: Record<string, string> = {
  BASIC: 'Basic Service',
  STANDARD: 'Standard Service',
  PREMIUM: 'Premium Service',
};

function intentHref(intent: BookingIntent): string {
  if (intent.packageCode) return `/customer/requests/new?package=${encodeURIComponent(intent.packageCode)}`;
  if (intent.serviceCategory) return `/customer/requests/new?category=${encodeURIComponent(intent.serviceCategory)}`;
  return '/customer/requests/new';
}

function intentTitle(intent: BookingIntent): string {
  const service = intent.packageCode
    ? PACKAGE_NAMES[intent.packageCode.toUpperCase()] ?? `${intent.packageCode} service`
    : intent.serviceCategory || 'a service';
  const car = carLabel(intent);
  return car ? `${service} for ${car}` : service;
}

type ActivityRow =
  | { kind: 'request'; id: string; at: string; item: CustomerDashboardData['recentRequests'][number] }
  | { kind: 'quote'; id: string; at: string; item: CustomerDashboardData['pendingQuotes'][number] };

function vehicleName(r: { vehicleYear: number; vehicleMake: string; vehicleModel: string }) {
  return [r.vehicleYear, r.vehicleMake, r.vehicleModel].filter(Boolean).join(' ');
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5 sm:space-y-6" aria-busy="true" aria-label="Loading your dashboard">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-40" />
      <Skeleton className="h-56" />
    </div>
  );
}

export default function CustomerDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<CustomerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<BookingIntent | null>(null);
  const [extras, setExtras] = useState<Record<string, RequestSummaryExtras>>({});

  useEffect(() => {
    const saved = loadBookingIntent();
    if (saved && (saved.modelId || saved.packageCode || saved.serviceCategory)) setIntent(saved);
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Request rows carry package and advance status; the dashboard summary does not.
      apiFetch<{ items?: RequestSummaryExtras[] } | RequestSummaryExtras[]>('/customer/requests?page=1&pageSize=20').then((r) => {
        const items = Array.isArray(r.data) ? r.data : r.data?.items ?? [];
        setExtras(Object.fromEntries(items.map((i) => [i.id, i])));
      });
      const res = await apiFetch<CustomerDashboardData>('/customer/dashboard');
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.message || 'Unable to load dashboard data.');
      }
    } catch {
      setError('Unable to load dashboard data right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const recentRequests = useMemo(() => data?.recentRequests ?? [], [data]);
  const recentQuotes = useMemo(() => data?.pendingQuotes ?? [], [data]);

  // Quotes the customer still has to accept or decline.
  const quotesAwaitingDecision = useMemo(
    () => recentQuotes.filter((q) => statusKey(q.status) === 'SENT'),
    [recentQuotes]
  );

  const activeRequests = useMemo(
    () => recentRequests.filter((r) => !isRequestFinished(r.status)),
    [recentRequests]
  );

  const activity = useMemo<ActivityRow[]>(() => {
    const rows: ActivityRow[] = [
      ...recentRequests.map((r) => ({ kind: 'request' as const, id: r.id, at: r.createdAtUtc, item: r })),
      ...recentQuotes.map((q) => ({ kind: 'quote' as const, id: q.id, at: q.createdAtUtc, item: q })),
    ];
    return rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 6);
  }, [recentRequests, recentQuotes]);

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  if (error && !data) {
    return <ErrorState title="Could not load your dashboard" error={error} onRetry={loadDashboard} />;
  }

  const name = user?.fullName || data?.customerName || '';
  const firstName = name.split(' ')[0];
  const vehiclesCount = data?.registeredVehiclesCount ?? 0;
  const hasNothingYet = recentRequests.length === 0 && recentQuotes.length === 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title={firstName ? `Hi, ${firstName}` : 'Welcome'}
        description="Here is what is happening with your car."
      />

      {/* Picked a car and service on the public site but did not finish booking */}
      {intent && (
        <div className="relative rounded-2xl border border-electric-200 bg-electric-50 shadow-card">
          <Link
            href={intentHref(intent)}
            className="flex items-center gap-3 rounded-2xl p-4 pr-12 transition active:scale-[0.99] sm:p-5 sm:pr-14"
          >
            <IconTile icon={Wrench} tone="blue" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-electric-800">Continue booking</div>
              <div className="mt-0.5 text-base font-semibold leading-snug text-navy-900">{intentTitle(intent)}</div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-electric-700" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => {
              clearBookingIntent();
              setIntent(null);
            }}
            className="absolute right-1.5 top-1.5 flex h-10 w-10 items-center justify-center rounded-full text-navy-400 hover:bg-white/70 hover:text-navy-700"
            aria-label="Dismiss unfinished booking"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Next thing the customer must do: decide on a quote */}
      {quotesAwaitingDecision.length > 0 && (
        <section aria-labelledby="todo-heading" className="space-y-3">
          <h2 id="todo-heading" className="sr-only">
            Needs your decision
          </h2>
          {quotesAwaitingDecision.map((q) => (
            <Link
              key={q.id}
              href={`/customer/quotes/${q.id}`}
              className="block rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5 shadow-card transition hover:border-amber-300 active:scale-[0.99]"
            >
              <div className="flex items-start gap-3">
                <IconTile icon={FileCheck2} tone="amber" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-amber-800">Your quote is ready</div>
                  <div className="mt-0.5 truncate text-base font-semibold text-navy-900">
                    {q.vehicleSummary || 'Your vehicle'}
                  </div>
                  {q.scopeSummary && (
                    <p className="mt-1 line-clamp-2 text-sm text-navy-600">{q.scopeSummary}</p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-amber-200/80 pt-3">
                <div>
                  <div className="text-xs text-navy-500">Total</div>
                  <div className="text-xl font-bold tabular-nums text-navy-900">
                    {formatINR(q.customerFacingPrice)}
                  </div>
                </div>
                <span className="inline-flex min-h-[44px] items-center gap-1 rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white">
                  Review quote
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </section>
      )}

      {/* Active requests with their real status */}
      {activeRequests.length > 0 && (
        <section aria-labelledby="active-heading">
          <SectionTitle
            action={
              <Link href="/customer/requests" className="text-sm font-medium text-electric-600 hover:text-electric-700">
                All requests
              </Link>
            }
          >
            <span id="active-heading">{activeRequests.length === 1 ? 'Your active request' : 'Your active requests'}</span>
          </SectionTitle>
          <div className="space-y-3">
            {activeRequests.slice(0, 3).map((r) => {
              const next = requestNextStep(r.status);
              const extra = extras[r.id];
              const isPackage = !!extra?.servicePackageName;
              return (
                <Link
                  key={r.id}
                  href={`/customer/requests/${r.id}`}
                  className="block rounded-2xl border border-surface-200 bg-white p-4 sm:p-5 shadow-card transition hover:border-surface-300 active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-navy-900">{vehicleName(r)}</div>
                      {r.description && (
                        <p className="mt-0.5 line-clamp-1 text-sm text-navy-500">{r.description}</p>
                      )}
                    </div>
                    <StatusBadge status={r.status} className="shrink-0" />
                  </div>
                  {isPackage && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-50 px-3 py-2 text-sm">
                      <span className="font-medium text-navy-800">
                        {extra.servicePackageName}
                        {extra.packagePrice ? ` · ${formatINRWhole(extra.packagePrice)}` : ''}
                      </span>
                      {extra.isAdvancePaid ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Advance paid
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-amber-700">Advance due · tap to pay</span>
                      )}
                    </div>
                  )}
                  <RequestProgress status={r.status} className="mt-4" />
                  {next && <p className="mt-3 text-sm text-navy-700">{next}</p>}
                  <div className="mt-2 flex items-center justify-between text-xs text-navy-400">
                    <span>
                      Requested {formatRelative(r.createdAtUtc)}
                      {r.quotesReceivedCount > 0 &&
                        ` · ${r.quotesReceivedCount} garage quote${r.quotesReceivedCount === 1 ? '' : 's'}`}
                    </span>
                    <ChevronRight className="h-4 w-4 text-surface-400" aria-hidden="true" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* First-run / nothing active */}
      {activeRequests.length === 0 && quotesAwaitingDecision.length === 0 && !intent && (
        <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-card">
          <div className="flex items-start gap-3">
            <IconTile icon={Wrench} tone="blue" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-navy-900">
                {hasNothingYet ? 'Book your first service' : 'Nothing in progress'}
              </h2>
              <p className="mt-0.5 text-sm text-navy-500">
                {vehiclesCount === 0
                  ? 'Add your car, then tell us what it needs. Nearby garages will quote and your advisor will send you one clear price.'
                  : 'Tell us what your car needs. Nearby garages will quote and your advisor will send you one clear price.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <section aria-label="Quick actions" className="grid grid-cols-2 gap-3">
        <Link
          href="/customer/requests/new"
          className="flex min-h-[88px] flex-col justify-between rounded-2xl bg-electric-600 p-4 text-white shadow-card transition hover:bg-electric-700 active:scale-[0.99]"
        >
          <Plus className="h-5 w-5" />
          <span className="text-sm font-semibold">Book a service</span>
        </Link>
        <Link
          href="/customer/vehicles"
          className="flex min-h-[88px] flex-col justify-between rounded-2xl border border-surface-200 bg-white p-4 text-navy-900 shadow-card transition hover:border-surface-300 active:scale-[0.99]"
        >
          <Car className="h-5 w-5 text-electric-600" />
          <span className="text-sm font-semibold">{vehiclesCount === 0 ? 'Add your vehicle' : 'My vehicles'}</span>
        </Link>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Vehicles"
          value={vehiclesCount}
          icon={Car}
          tone="blue"
          href="/customer/vehicles"
        />
        <StatCard
          label="Service requests"
          value={data?.activeRequestsCount ?? 0}
          icon={ClipboardList}
          tone="neutral"
          href="/customer/requests"
        />
      </div>

      {/* Recent activity */}
      {activity.length > 0 && (
        <ListGroup title="Recent activity">
          {activity.map((row) =>
            row.kind === 'request' ? (
              <ListItem
                key={`r-${row.id}`}
                href={`/customer/requests/${row.id}`}
                leading={<IconTile icon={ClipboardList} tone="neutral" />}
                title={vehicleName(row.item)}
                subtitle={row.item.description || 'Service request'}
                meta={`Request · ${formatRelative(row.at)}`}
                trailing={<StatusBadge status={row.item.status} />}
              />
            ) : (
              <ListItem
                key={`q-${row.id}`}
                href={`/customer/quotes/${row.id}`}
                leading={<IconTile icon={FileCheck2} tone="neutral" />}
                title={row.item.vehicleSummary || 'Quote'}
                subtitle={row.item.scopeSummary || 'Service quote'}
                meta={`Quote · ${formatRelative(row.at)}`}
                trailing={
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums text-navy-900">
                      {formatINRWhole(row.item.customerFacingPrice)}
                    </span>
                    <StatusBadge status={row.item.status} />
                  </div>
                }
              />
            )
          )}
        </ListGroup>
      )}
    </div>
  );
}
