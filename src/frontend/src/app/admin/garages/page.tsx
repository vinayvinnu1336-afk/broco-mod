'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { AdminGarageList, PagedResult } from '@/types/adminOperations';
import { Building2, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterChips } from '@/components/ui/FilterChips';
import { Input } from '@/components/ui/Input';
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
  const toast = useToast();
  const [garages, setGarages] = useState<AdminGarageList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Confirmation for verify / reactivate / suspend / deactivate
  const [action, setAction] = useState<{ type: GarageAction; garageId: string; garageName: string } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const requestId = useRef(0);
  const searchRef = useRef(searchTerm);
  searchRef.current = searchTerm;

  const loadGarages = useCallback(async (p: number, size: number, search: string, status: string) => {
    const id = ++requestId.current;
    setLoading(true);
    let url = `/admin/garages?page=${p}&pageSize=${size}`;
    if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;

    const res = await apiFetch<PagedResult<AdminGarageList>>(url);
    if (id !== requestId.current) return; // a newer request is in flight
    if (res.success && res.data) {
      const data = res.data as PagedResult<AdminGarageList> & { page?: number };
      setGarages(data.items ?? []);
      setPage(data.pageNumber ?? data.page ?? p);
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
    loadGarages(1, pageSize, searchRef.current, statusFilter);
  }, [pageSize, statusFilter, loadGarages]);

  const reload = () => loadGarages(page, pageSize, searchTerm, statusFilter);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadGarages(1, pageSize, searchTerm, statusFilter);
  };

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
        description="Verify new garages, check their activity and suspend or deactivate them when needed."
        actions={
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
        }
      />

      <div className="space-y-3">
        <form onSubmit={handleSearchSubmit} role="search" className="flex gap-2">
          <div className="flex-1">
            <Input
              type="search"
              enterKeyHint="search"
              aria-label="Search garages"
              placeholder="Search by name, email or address"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <Button type="submit" variant="outline" className="shrink-0">
            Search
          </Button>
        </form>
        <FilterChips ariaLabel="Garage status" value={statusFilter} onChange={setStatusFilter} options={STATUS_FILTERS} />
      </div>

      {loading && garages.length === 0 ? (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : loadError && garages.length === 0 ? (
        <ErrorState title="Garages unavailable" error={loadError} onRetry={reload} />
      ) : garages.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No garages found"
          description={searchTerm || statusFilter ? 'Try a different search or status.' : 'Garages appear here when they sign up.'}
        />
      ) : (
        <div className={`space-y-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Garage</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Radius</TableHead>
                  <TableHead className="text-right">Active jobs</TableHead>
                  <TableHead className="text-right">Quotes</TableHead>
                  <TableHead>Joined</TableHead>
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
                    </TableCell>
                    <TableCell className="max-w-[14rem]">
                      <div className="truncate text-navy-800">{g.email}</div>
                      <div className="text-xs text-navy-500">{g.phoneNumber}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={garageStatus(g.status)} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{Number(g.serviceRadiusKm).toFixed(1)} km</TableCell>
                    <TableCell className="text-right tabular-nums">{g.activeJobsCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{g.totalQuotesCount}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-navy-500">{formatDate(g.createdAtUtc)}</TableCell>
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
                  meta={`${Number(g.serviceRadiusKm).toFixed(0)} km radius · ${g.activeJobsCount} active jobs · ${g.totalQuotesCount} quotes`}
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
                onPageChange={(p) => loadGarages(p, pageSize, searchTerm, statusFilter)}
              />
            )}
            <div className="hidden w-40 sm:block">
              <Select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
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
