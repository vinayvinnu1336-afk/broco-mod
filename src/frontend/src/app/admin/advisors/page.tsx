'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminAdvisorList, PagedResult } from '@/types/adminOperations';
import { Pencil, RefreshCw, UserCheck, UserPlus } from 'lucide-react';
import { AddAdvisorSheet, EditAdvisorSheet } from '@/components/admin/AdvisorSheets';
import { formatIndianMobile } from '@/lib/phone';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterBar } from '@/components/ui/FilterBar';
import { ListGroup, ListItem } from '@/components/ui/ListItem';
import { Modal } from '@/components/ui/Modal';
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

const ACTIVE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

const FILTER_DEFAULTS = { q: '', active: '', size: '25' };

export default function AdminAdvisorsPage() {
  return (
    <Suspense fallback={<AdvisorsSkeleton />}>
      <AdminAdvisors />
    </Suspense>
  );
}

function AdvisorsSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-16 rounded-2xl" />
      ))}
    </div>
  );
}

function AdminAdvisors() {
  const toast = useToast();
  const filters = useUrlFilters(FILTER_DEFAULTS);
  const { values: f, page: urlPage } = filters;
  const [advisors, setAdvisors] = useState<AdminAdvisorList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = [25, 50, 100].includes(Number(f.size)) ? Number(f.size) : 25;

  // Advisor sheet (phones) and confirmations
  const [selectedAdvisor, setSelectedAdvisor] = useState<AdminAdvisorList | null>(null);
  const [confirm, setConfirm] = useState<{ type: 'activate' | 'deactivate'; id: string; name: string } | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AdminAdvisorList | null>(null);

  const requestId = useRef(0);

  const query = useMemo(
    () => toQueryString({ page: urlPage, pageSize, search: f.q, isActive: f.active === 'true' || f.active === 'false' ? f.active : '' }),
    [urlPage, pageSize, f]
  );

  const loadAdvisors = useCallback(async (qs: string) => {
    const id = ++requestId.current;
    setLoading(true);
    const res = await apiFetch<PagedResult<AdminAdvisorList>>(`/admin/advisors${qs}`);
    if (id !== requestId.current) return;
    if (res.success && res.data) {
      const data = res.data as PagedResult<AdminAdvisorList> & { page?: number };
      setAdvisors(data.items ?? []);
      setPage(data.page ?? data.pageNumber ?? 1);
      setTotalPages(data.totalPages ?? 1);
      setTotalCount(data.totalCount ?? 0);
      setLoadError(null);
    } else {
      setLoadError(res.message || 'Could not load advisors.');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadAdvisors(query);
  }, [query, loadAdvisors]);

  const reload = () => loadAdvisors(query);

  const goToPage = (p: number) => {
    filters.setPage(p);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const anyFilter = filters.isActive('q') || filters.isActive('active');

  const openConfirm = (type: 'activate' | 'deactivate', adv: AdminAdvisorList) => {
    setSelectedAdvisor(null);
    setConfirm({ type, id: adv.id, name: adv.fullName });
    setDeactivateReason('');
    setActionError(null);
  };

  const closeConfirm = () => {
    if (!actionLoading) setConfirm(null);
  };

  const closeSheet = useCallback(() => setSelectedAdvisor(null), []);

  const submitConfirm = async () => {
    if (!confirm) return;

    if (confirm.type === 'deactivate' && !deactivateReason.trim()) {
      setActionError('Add a reason for deactivating this advisor.');
      return;
    }

    setActionLoading(true);
    setActionError(null);

    const res =
      confirm.type === 'activate'
        ? await apiFetch(`/admin/advisors/${confirm.id}/activate`, {
            method: 'POST',
          })
        : await apiFetch(`/admin/advisors/${confirm.id}/deactivate`, {
            method: 'POST',
            body: JSON.stringify({ reason: deactivateReason.trim() }),
          });

    setActionLoading(false);

    if (res.success) {
      toast.success(confirm.type === 'activate' ? 'Advisor activated' : 'Advisor deactivated', confirm.name);
      setConfirm(null);
      setDeactivateReason('');
      reload();
    } else {
      setActionError(
        res.message || (confirm.type === 'activate' ? 'Failed to activate advisor.' : 'Failed to deactivate advisor.')
      );
    }
  };

  const statusOf = (adv: AdminAdvisorList) => (adv.isActive ? 'Active' : 'Inactive');

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Advisors"
        description="Platform advisors, their current workload and account status."
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
            <Button onClick={() => setAddOpen(true)} leftIcon={<UserPlus className="h-4 w-4" />}>
              Add advisor
            </Button>
          </>
        }
      />

      <FilterBar
        filters={filters}
        searchKey="q"
        searchPlaceholder="Name, email, phone or employee code"
        searchLabel="Search advisors"
        status={{ key: 'active', options: ACTIVE_FILTERS, ariaLabel: 'Advisor status' }}
        summary={loading ? 'Loading…' : `${totalCount} ${totalCount === 1 ? 'advisor' : 'advisors'}`}
      />

      {loading && advisors.length === 0 ? (
        <AdvisorsSkeleton />
      ) : loadError && advisors.length === 0 ? (
        <ErrorState title="Advisors unavailable" error={loadError} onRetry={reload} />
      ) : advisors.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="No advisors found"
          description={anyFilter ? 'No advisors match these filters.' : 'No advisor accounts yet.'}
          action={
            !anyFilter && (
              <Button onClick={() => setAddOpen(true)} leftIcon={<UserPlus className="h-4 w-4" />}>
                Add advisor
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
                  <TableHead>Advisor</TableHead>
                  <TableHead>Code · joined</TableHead>
                  <TableHead>Speciality</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Workload</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {advisors.map((adv) => (
                  <TableRow key={adv.id}>
                    <TableCell className="max-w-[16rem]">
                      <div className="font-semibold text-navy-900">{adv.fullName}</div>
                      <div className="truncate text-xs text-navy-500">{adv.email}</div>
                      {adv.phoneNumber && (
                        <div className="text-xs tabular-nums text-navy-500">{formatIndianMobile(adv.phoneNumber)}</div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-navy-700">{adv.employeeCode || '—'}</div>
                      <div className="text-xs text-navy-500">{formatDate(adv.createdAtUtc)}</div>
                    </TableCell>
                    <TableCell className="text-navy-700">{adv.specialization || 'General'}</TableCell>
                    <TableCell>
                      <StatusBadge status={statusOf(adv)} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      <div className="text-navy-800">
                        {adv.activeAssignedRequestsCount}
                        {adv.maxAssignedRequests ? `/${adv.maxAssignedRequests}` : ''} open · {adv.activeJobsOverseeingCount}{' '}
                        {adv.activeJobsOverseeingCount === 1 ? 'job' : 'jobs'}
                      </div>
                      <div className="text-xs text-navy-500">{adv.totalQuotesReviewedCount} quotes reviewed</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(adv)}
                        aria-label={`Edit ${adv.fullName}`}
                        title="Edit"
                        className="px-2"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      {adv.isActive ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => openConfirm('deactivate', adv)}
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => openConfirm('activate', adv)}>
                          Activate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Phone list */}
          <div className="md:hidden">
            <ListGroup>
              {advisors.map((adv) => (
                <ListItem
                  key={adv.id}
                  onClick={() => setSelectedAdvisor(adv)}
                  leading={<Avatar name={adv.fullName} size="lg" />}
                  title={adv.fullName}
                  subtitle={adv.specialization || adv.email}
                  meta={`${adv.activeAssignedRequestsCount} open requests · ${adv.activeJobsOverseeingCount} active jobs`}
                  trailing={<StatusBadge status={statusOf(adv)} />}
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

      {/* Advisor details sheet (phones) */}
      <Modal
        isOpen={!!selectedAdvisor}
        onClose={closeSheet}
        size="sm"
        title={selectedAdvisor?.fullName}
        description={selectedAdvisor?.email}
        footer={
          selectedAdvisor && (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <Button variant="outline" onClick={closeSheet} className="w-full sm:w-auto">
                Close
              </Button>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                leftIcon={<Pencil className="h-4 w-4" />}
                onClick={() => {
                  setEditing(selectedAdvisor);
                  setSelectedAdvisor(null);
                }}
              >
                Edit
              </Button>
              {selectedAdvisor.isActive ? (
                <Button
                  variant="outline"
                  className="w-full text-red-600 hover:text-red-700 sm:w-auto"
                  onClick={() => openConfirm('deactivate', selectedAdvisor)}
                >
                  Deactivate
                </Button>
              ) : (
                <Button className="w-full sm:w-auto" onClick={() => openConfirm('activate', selectedAdvisor)}>
                  Activate
                </Button>
              )}
            </div>
          )
        }
      >
        {selectedAdvisor && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Open requests" value={selectedAdvisor.activeAssignedRequestsCount} />
              <MiniStat label="Quotes reviewed" value={selectedAdvisor.totalQuotesReviewedCount} />
              <MiniStat label="Active jobs" value={selectedAdvisor.activeJobsOverseeingCount} />
            </div>
            <dl className="space-y-2 text-sm">
              <Row label="Status" value={<StatusBadge status={statusOf(selectedAdvisor)} />} />
              <Row label="Employee code" value={selectedAdvisor.employeeCode || '—'} />
              {selectedAdvisor.phoneNumber && (
                <Row label="Mobile" value={formatIndianMobile(selectedAdvisor.phoneNumber)} />
              )}
              <Row label="Speciality" value={selectedAdvisor.specialization || 'General'} />
              {selectedAdvisor.maxAssignedRequests != null && (
                <Row label="Max open requests" value={selectedAdvisor.maxAssignedRequests} />
              )}
              <Row label="Joined" value={formatDate(selectedAdvisor.createdAtUtc)} />
            </dl>
          </div>
        )}
      </Modal>

      <AddAdvisorSheet isOpen={addOpen} onClose={() => setAddOpen(false)} onCreated={() => reload()} />

      <EditAdvisorSheet
        advisor={editing}
        onClose={() => setEditing(null)}
        onSaved={(adv) => {
          setEditing(null);
          toast.success('Advisor updated', adv.fullName);
          reload();
        }}
      />

      <ConfirmationDialog
        isOpen={!!confirm}
        onClose={closeConfirm}
        onConfirm={submitConfirm}
        isLoading={actionLoading}
        variant={confirm?.type === 'deactivate' ? 'danger' : 'primary'}
        title={confirm ? `${confirm.type === 'activate' ? 'Activate' : 'Deactivate'} ${confirm.name}?` : ''}
        confirmText={confirm?.type === 'activate' ? 'Activate advisor' : 'Deactivate advisor'}
        message={
          confirm && (
            <div className="space-y-3">
              <p>
                {confirm.type === 'activate'
                  ? 'The advisor can review quotes and manage service requests again.'
                  : 'The advisor can no longer review quotes or manage requests.'}
              </p>
              {confirm.type === 'deactivate' && (
                <Textarea
                  id="advisor-deactivate-reason"
                  label="Reason"
                  rows={3}
                  value={deactivateReason}
                  onChange={(e) => setDeactivateReason(e.target.value)}
                  placeholder="Why are you deactivating this advisor?"
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

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="p-3 text-center shadow-none">
      <div className="text-xl font-bold tabular-nums text-navy-900">{value}</div>
      <div className="mt-0.5 text-xs leading-tight text-navy-500">{label}</div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-navy-500">{label}</dt>
      <dd className="text-right font-medium text-navy-800">{value}</dd>
    </div>
  );
}
