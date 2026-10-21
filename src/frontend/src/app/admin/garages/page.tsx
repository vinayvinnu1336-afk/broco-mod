'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { AdminGarageList, PagedResult } from '@/types/adminOperations';
import { Building2, Plus, RefreshCw } from 'lucide-react';
import { AddGarageSheet } from '@/components/admin/GarageSheets';
import { Button } from '@/components/ui/Button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterBar } from '@/components/ui/FilterBar';
import { IconTile, ListGroup, ListItem } from '@/components/ui/ListItem';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/format';
import { toQueryString, useUrlFilters } from '@/lib/useUrlFilters';
import { useCityOptions } from '@/lib/filterOptions';

// The API serialises the garage status enum as a number (1-4); names are also accepted.
const GARAGE_STATUS_NAMES: Record<string, string> = {
  '1': 'PendingVerification',
  '2': 'Verified',
  '3': 'Suspended',
  '4': 'Inactive',
};
const garageStatus = (status: unknown): string => {
  const key = String(status ?? '');
  return GARAGE_STATUS_NAMES[key] ?? key;
};

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'PendingVerification', label: 'Pending verification' },
  { value: 'Verified', label: 'Verified' },
  { value: 'Suspended', label: 'Suspended' },
  { value: 'Inactive', label: 'Inactive' },
];

// Commission dues filter values the API accepts.
const DUES_OPTIONS = [
  { value: 'any', label: 'Unpaid commission' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'blocked', label: 'Blocked for dues' },
  { value: 'none', label: 'No dues' },
];

const FILTER_DEFAULTS = { q: '', status: '', city: '', dues: '', size: '25' };

type GarageAction = 'verify' | 'activate' | 'suspend' | 'deactivate';

const ACTION_COPY: Record<GarageAction, { title: string; message: string; confirm: string; done: string }> = {
  verify: {
    title: 'Verify garage?',
    message: 'Verified garages can receive service requests and send quotes.',
    confirm: 'Verify garage',
    done: 'Garage verified',
  },
  activate: {
    title: 'Reactivate garage?',
    message: 'The garage will be able to receive service requests again.',
    confirm: 'Reactivate',
    done: 'Garage reactivated',
  },
  suspend: {
    title: 'Suspend garage?',
    message: 'The garage stops receiving new service requests and quote invitations until you reactivate it.',
    confirm: 'Suspend garage',
    done: 'Garage suspended',
  },
  deactivate: {
    title: 'Deactivate garage?',
    message: 'The garage is marked inactive and removed from matching. Use this when a garage leaves the network.',
    confirm: 'Deactivate garage',
    done: 'Garage deactivated',
  },
};

export default function AdminGaragesPage() {
  return (
    <Suspense fallback={<GaragesSkeleton />}>
      <AdminGarages />
    </Suspense>
  );
}

function GaragesSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-16 rounded-2xl" />
      ))}
    </div>
  );
}

function AdminGarages() {
  const toast = useToast();
  const filters = useUrlFilters(FILTER_DEFAULTS);
  const { values: f, page: urlPage } = filters;
  const cityOptions = useCityOptions(true);
  const [addOpen, setAddOpen] = useState(false);
  const [garages, setGarages] = useState<AdminGarageList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = [25, 50, 100].includes(Number(f.size)) ? Number(f.size) : 25;

  // Confirmation for verify / reactivate / suspend / deactivate
  const [action, setAction] = useState<{ type: GarageAction; garageId: string; garageName: string } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const requestId = useRef(0);

  const query = useMemo(
    () => toQueryString({ page: urlPage, pageSize, search: f.q, status: f.status, city: f.city, dues: f.dues }),
    [urlPage, pageSize, f]
  );

  const loadGarages = useCallback(async (qs: string) => {
    const id = ++requestId.current;
    setLoading(true);
    const res = await apiFetch<PagedResult<AdminGarageList>>(`/admin/garages${qs}`);
    if (id !== requestId.current) return; // a newer request is in flight
    if (res.success && res.data) {
      const data = res.data as PagedResult<AdminGarageList> & { page?: number };
      setGarages(data.items ?? []);
      setPage(data.page ?? data.pageNumber ?? 1);
      setTotalPages(data.totalPages ?? 1);
      setTotalCount(data.totalCount ?? 0);
      setLoadError(null);
    } else {
      setLoadError(res.message || 'Could not load garages.');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadGarages(query);
  }, [query, loadGarages]);

  const reload = () => loadGarages(query);

  const goToPage = (p: number) => {
    filters.setPage(p);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const anyFilter = Object.keys(FILTER_DEFAULTS).some((k) => k !== 'size' && filters.isActive(k as keyof typeof FILTER_DEFAULTS));

  const openAction = (type: GarageAction, g: AdminGarageList) => {
    setAction({ type, garageId: g.id, garageName: g.name });
    setActionReason('');
    setActionError(null);
  };

  const closeAction = () => {
    if (!actionLoading) setAction(null);
  };

  const submitAction = async () => {
    if (!action) return;
    const needsReason = action.type === 'suspend' || action.type === 'deactivate';
    if (needsReason && !actionReason.trim()) {
      setActionError('Add a reason for this change.');
      return;
    }

    setActionLoading(true);
    setActionError(null);

    const res = await apiFetch(`/admin/garages/${action.garageId}/${action.type}`, {
      method: 'POST',
      body: JSON.stringify(needsReason ? { reason: actionReason.trim() } : {}),
    });

    setActionLoading(false);

    if (res.success) {
      toast.success(ACTION_COPY[action.type].done, action.garageName);
      setAction(null);
      setActionReason('');
      reload();
    } else {
      setActionError(res.message || 'That did not work. Please try again.');
    }
  };

  const renderRowActions = (g: AdminGarageList) => {
    const status = garageStatus(g.status);
    return (
      <div className="flex items-center justify-end gap-1.5">
        {status === 'PendingVerification' && (
          <Button size="sm" onClick={() => openAction('verify', g)}>
            Verify
          </Button>
        )}
        {status === 'Verified' && (
          <Button size="sm" variant="outline" onClick={() => openAction('suspend', g)}>
            Suspend
          </Button>
        )}
        {status === 'Suspended' && (
          <Button size="sm" variant="outline" onClick={() => openAction('activate', g)}>
            Reactivate
          </Button>
        )}
        {status !== 'Inactive' && (
          <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => openAction('deactivate', g)}>
            Deactivate
          </Button>
        )}
      </div>
    );
  };

  const needsReason = action?.type === 'suspend' || action?.type === 'deactivate';

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Garages"
        description="Add and verify garages, check their activity and suspend or deactivate them when needed."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setRefreshing(true);
                reload();
              }}
              isLoading={refreshing}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </Button>
            <Button onClick={() => setAddOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
              Add garage
            </Button>
          </>
        }
      />

      <FilterBar
        filters={filters}
        searchKey="q"
        searchPlaceholder="Name, phone, email or area"
        searchLabel="Search garages"
        status={{ key: 'status', options: STATUS_FILTERS, ariaLabel: 'Garage status' }}
        fields={[
          { type: 'select', key: 'city', label: 'City', allLabel: 'All cities', options: cityOptions },
          { type: 'select', key: 'dues', label: 'Commission dues', allLabel: 'Dues: all', options: DUES_OPTIONS },
        ]}
        summary={loading ? 'Loading…' : `${totalCount} ${totalCount === 1 ? 'garage' : 'garages'}`}
      />

      {loading && garages.length === 0 ? (
        <GaragesSkeleton />
      ) : loadError && garages.length === 0 ? (
        <ErrorState title="Garages unavailable" error={loadError} onRetry={reload} />
      ) : garages.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No garages found"
          description={anyFilter ? 'No garages match these filters.' : 'Garages appear here when they sign up or you add one.'}
          action={
            !anyFilter && (
              <Button onClick={() => setAddOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
                Add garage
              </Button>
            )
          }
        />
      ) : (
        <div className={`space-y-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Garage</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden text-right 2xl:table-cell">Radius</TableHead>
                  <TableHead className="text-right">Active jobs</TableHead>
                  <TableHead className="text-right">Quotes</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Joined</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {garages.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="max-w-[16rem]">
                      <Link href={`/admin/garages/${g.id}`} className="font-semibold text-navy-900 hover:text-electric-600">
                        {g.name}
                      </Link>
                      <div className="truncate text-xs text-navy-500">{g.address}</div>
                      <div className="text-xs tabular-nums text-navy-500 2xl:hidden">{g.phoneNumber}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-navy-700">{g.city || '—'}</TableCell>
                    <TableCell className="hidden max-w-[14rem] 2xl:table-cell">
                      <div className="truncate text-navy-800">{g.email}</div>
                      <div className="text-xs text-navy-500">{g.phoneNumber}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={garageStatus(g.status)} />
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-right tabular-nums 2xl:table-cell">{Number(g.serviceRadiusKm).toFixed(1)} km</TableCell>
                    <TableCell className="text-right tabular-nums">{g.activeJobsCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{g.totalQuotesCount}</TableCell>
                    <TableCell className="hidden whitespace-nowrap text-xs text-navy-500 2xl:table-cell">{formatDate(g.createdAtUtc)}</TableCell>
                    <TableCell>{renderRowActions(g)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Phone list */}
          <div className="md:hidden">
            <ListGroup>
              {garages.map((g) => (
                <ListItem
                  key={g.id}
                  href={`/admin/garages/${g.id}`}
                  leading={<IconTile icon={Building2} tone="blue" />}
                  title={g.name}
                  subtitle={g.address || g.phoneNumber}
                  meta={`${g.city ? `${g.city} · ` : ''}${Number(g.serviceRadiusKm).toFixed(0)} km radius · ${g.activeJobsCount} active jobs · ${g.totalQuotesCount} quotes`}
                  trailing={<StatusBadge status={garageStatus(g.status)} />}
                />
              ))}
            </ListGroup>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {totalCount > 0 && (
              <Pagination
                className="flex-1"
                currentPage={page}
                totalPages={Math.max(1, totalPages)}
                totalItems={totalCount}
                pageSize={pageSize}
                onPageChange={goToPage}
              />
            )}
            <div className="hidden w-40 sm:block">
              <Select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(e) => filters.set({ size: e.target.value })}
                options={[
                  { value: 25, label: '25 per page' },
                  { value: 50, label: '50 per page' },
                  { value: 100, label: '100 per page' },
                ]}
              />
            </div>
          </div>
        </div>
      )}

      <AddGarageSheet isOpen={addOpen} onClose={() => setAddOpen(false)} onCreated={() => reload()} />

      <ConfirmationDialog
        isOpen={!!action}
        onClose={closeAction}
        onConfirm={submitAction}
        isLoading={actionLoading}
        variant={action?.type === 'deactivate' ? 'danger' : action?.type === 'suspend' ? 'warning' : 'primary'}
        title={action ? ACTION_COPY[action.type].title.replace('garage', action.garageName) : ''}
        confirmText={action ? ACTION_COPY[action.type].confirm : 'Confirm'}
        message={
          action && (
            <div className="space-y-3">
              <p>{ACTION_COPY[action.type].message}</p>
              {needsReason && (
                <Textarea
                  id="garage-action-reason"
                  label="Reason"
                  rows={3}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Why are you doing this?"
                  required
                />
              )}
              {actionError && (
                <p role="alert" className="text-sm font-medium text-red-600">
                  {actionError}
                </p>
              )}
            </div>
          )
        }
      />
    </div>
  );
}
