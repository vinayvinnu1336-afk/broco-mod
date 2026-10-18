'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BellRing, Building2, CheckCircle2, Phone, Search, SlidersHorizontal, Wallet, X } from 'lucide-react';
import { formatDate, formatDateTime, formatINR, formatINRShort, formatRelative } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterChips } from '@/components/ui/FilterChips';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { CommissionDetails, dueStatus, dueText, remindersText } from './CommissionDetails';
import {
  announceGarageDuesChanged,
  dayEndIso,
  dayStartIso,
  garageDuesApi,
  isOpenDue,
  type DuesPortal,
  type DuesSort,
  type DuesStatus,
  type GarageDue,
  type GarageDuesOverview,
  type GarageDuesSummary,
} from './garageDuesApi';

const PAGE_SIZE = 20;
const STATUSES: DuesStatus[] = ['Due', 'Overdue', 'Paid', 'Waived', 'All'];
const SORT_OPTIONS: { value: DuesSort; label: string }[] = [
  { value: 'due', label: 'Oldest due first' },
  { value: 'garage', label: 'Garage (A–Z)' },
  { value: 'amount', label: 'Largest amount' },
  { value: 'reminded', label: 'Least recently reminded' },
];

export interface GarageDuesBoardProps {
  portal: DuesPortal;
  /** Open a due in the parent's own sheet (admin: record payment / waive). Without it the board shows a read-only sheet. */
  onSelect?: (due: GarageDue) => void;
  /** Bump to reload the list and totals after the parent changed a due. */
  reloadToken?: number;
}

function telHref(phone?: string | null) {
  return phone ? `tel:${phone.replace(/\s+/g, '')}` : undefined;
}

/** Totals, filters and the list of commission dues, with "Send reminder" on each open due and "Remind all overdue". */
export function GarageDuesBoard({ portal, onSelect, reloadToken = 0 }: GarageDuesBoardProps) {
  const toast = useToast();

  const [overview, setOverview] = useState<GarageDuesOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [garages, setGarages] = useState<GarageDuesSummary[]>([]);

  const [status, setStatus] = useState<DuesStatus>('Due');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [garageId, setGarageId] = useState('');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [sort, setSort] = useState<DuesSort>('due');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<GarageDue[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const listRequest = useRef(0);

  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [viewing, setViewing] = useState<GarageDue | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Dashboard links can open a status directly, e.g. ?status=Overdue.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('status');
    const match = STATUSES.find((s) => s.toLowerCase() === wanted?.toLowerCase());
    if (match) setStatus(match);
  }, []);

  // Re-enable "Send reminder" buttons once their hour is up.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadSummary = useCallback(async () => {
    const [ov, gs] = await Promise.all([garageDuesApi.overview(portal), garageDuesApi.garages(portal)]);
    if (ov.success && ov.data) {
      setOverview(ov.data);
      setOverviewError(null);
    } else {
      setOverviewError(ov.message || 'Could not load the totals.');
    }
    if (gs.success && gs.data) setGarages(gs.data);
  }, [portal]);

  const loadList = useCallback(async () => {
    const requestId = ++listRequest.current;
    setLoading(true);
    const res = await garageDuesApi.list(portal, {
      status,
      search,
      garageId: garageId || undefined,
      dueFrom: dueFrom ? dayStartIso(dueFrom) : undefined,
      dueTo: dueTo ? dayEndIso(dueTo) : undefined,
      sort,
      page,
      pageSize: PAGE_SIZE,
    });
    if (requestId !== listRequest.current) return;
    if (res.success && res.data) {
      setItems(res.data.items ?? []);
      setTotalCount(res.data.totalCount ?? 0);
      setListError(null);
    } else {
      setListError(res.message || 'Could not load garage dues.');
    }
    setLoading(false);
  }, [portal, status, search, garageId, dueFrom, dueTo, sort, page]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary, reloadToken]);

  useEffect(() => {
    loadList();
  }, [loadList, reloadToken]);

  const refreshAll = () => {
    loadSummary();
    loadList();
    announceGarageDuesChanged();
  };

  const cooldownUntil = (c: GarageDue) => {
    const at = c.nextManualReminderAtUtc ? new Date(c.nextManualReminderAtUtc).getTime() : 0;
    return at > now ? at : null;
  };

  const remind = async (c: GarageDue) => {
    setRemindingId(c.id);
    const res = await garageDuesApi.remind(portal, c.id);
    setRemindingId(null);
    if (res.success && res.data) {
      const updated = res.data.commission;
      toast.success('Reminder sent', `${c.garageName} · ${formatINR(c.totalDue)}`);
      setItems((list) => list.map((i) => (i.id === updated.id ? updated : i)));
      setViewing((v) => (v && v.id === updated.id ? updated : v));
      loadSummary();
      announceGarageDuesChanged();
    } else {
      toast.warning('Reminder not sent', res.message || 'Please try again.');
      loadList();
    }
  };

  const garageFilter = garages.find((g) => g.garageId === garageId);
  const bulkScope = garageFilter
    ? { garages: garageFilter.overdueCount > 0 ? 1 : 0, dues: garageFilter.overdueCount, amount: garageFilter.overdueAmount }
    : { garages: overview?.garagesWithOverdue ?? 0, dues: overview?.overdueCount ?? 0, amount: overview?.overdueAmount ?? 0 };

  const remindAll = async () => {
    setBulkWorking(true);
    const res = await garageDuesApi.remindOverdue(portal, garageId || undefined);
    setBulkWorking(false);
    setConfirmBulk(false);
    if (res.success && res.data) {
      if (res.data.duesReminded > 0) toast.success('Reminders sent', res.message);
      else toast.info('Nothing sent', res.message);
      refreshAll();
    } else {
      toast.error('Could not send reminders', res.message || 'Please try again.');
    }
  };

  const open = (c: GarageDue) => (onSelect ? onSelect(c) : setViewing(c));

  const activeFilters = [garageId, dueFrom, dueTo].filter(Boolean).length + (sort !== 'due' ? 1 : 0);
  const clearFilters = () => {
    setGarageId('');
    setDueFrom('');
    setDueTo('');
    setSort('due');
    setSearchInput('');
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const grouped = sort === 'garage';

  // Rows grouped under their garage when sorted by garage (the API keeps one garage's dues together).
  const groups = useMemo(() => {
    const result: { garageId: string; garageName: string; garagePhone?: string | null; blocked: boolean; items: GarageDue[] }[] = [];
    for (const c of items) {
      const last = result[result.length - 1];
      if (grouped && last && last.garageId === c.garageId) last.items.push(c);
      else
        result.push({ garageId: c.garageId, garageName: c.garageName, garagePhone: c.garagePhone, blocked: Boolean(c.garageBlocked), items: [c] });
    }
    return result;
  }, [items, grouped]);

  const groupTotal = (g: { garageId: string; items: GarageDue[] }) => {
    const summary = garages.find((s) => s.garageId === g.garageId);
    return summary ? `${summary.outstandingCount} unpaid · ${formatINR(summary.outstandingAmount)}` : null;
  };

  const reminderButton = (c: GarageDue, size: 'sm' | 'md' = 'sm', className = '') => {
    if (!isOpenDue(c)) return null;
    const until = cooldownUntil(c);
    return (
      <Button
        size={size}
        variant="outline"
        className={`whitespace-nowrap ${className}`}
        onClick={(e) => {
          e.stopPropagation();
          remind(c);
        }}
        isLoading={remindingId === c.id}
        disabled={Boolean(until) || (remindingId !== null && remindingId !== c.id)}
        title={until ? `Reminded recently. You can remind again at ${formatDateTime(until)}.` : undefined}
        leftIcon={<BellRing className="h-4 w-4" aria-hidden="true" />}
        aria-label={until ? `Reminded recently, available after ${formatDateTime(until)}` : `Send reminder to ${c.garageName} for ${c.commissionNumber}`}
      >
        {until ? 'Reminded' : 'Send reminder'}
      </Button>
    );
  };

  const statusBadges = (c: GarageDue) => {
    const st = dueStatus(c);
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={st.variant}>{st.label}</Badge>
        {c.garageBlocked && isOpenDue(c) && <Badge variant="red">Jobs paused</Badge>}
      </div>
    );
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Totals */}
      {!overview && !overviewError ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[104px] rounded-2xl" />
          ))}
        </div>
      ) : overviewError && !overview ? (
        <ErrorState title="Totals unavailable" error={overviewError} onRetry={loadSummary} />
      ) : overview ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Outstanding"
            value={formatINRShort(overview.outstandingAmount)}
            icon={Wallet}
            tone="amber"
            hint={`${overview.outstandingCount} ${overview.outstandingCount === 1 ? 'due' : 'dues'} · ${overview.garagesWithDues} garage${overview.garagesWithDues === 1 ? '' : 's'}`}
          />
          <StatCard
            label="Overdue"
            value={formatINRShort(overview.overdueAmount)}
            icon={AlertTriangle}
            tone={overview.overdueCount > 0 ? 'red' : 'neutral'}
            hint={`${overview.overdueCount} past the due date`}
          />
          <StatCard
            label="Garages overdue"
            value={overview.garagesWithOverdue}
            icon={Building2}
            tone={overview.garagesWithOverdue > 0 ? 'red' : 'neutral'}
            hint={portal === 'admin' ? (overview.garagesBlocked > 0 ? `${overview.garagesBlocked} paused for new jobs` : 'None paused for new jobs') : `of ${overview.garagesWithDues} owing`}
          />
          {portal === 'admin' && overview.collectedAmount !== undefined ? (
            <StatCard label="Collected" value={formatINRShort(overview.collectedAmount)} icon={CheckCircle2} tone="green" hint="Commission received" />
          ) : (
            <StatCard
              label="Paused garages"
              value={overview.garagesBlocked}
              icon={AlertTriangle}
              tone={overview.garagesBlocked > 0 ? 'red' : 'neutral'}
              hint="No new jobs till they pay"
            />
          )}
        </div>
      ) : null}

      {/* Search + bulk reminder */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <Input
            type="search"
            aria-label="Search garage dues"
            placeholder="Search garage, phone or job no."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="shrink-0 sm:hidden"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-controls="dues-filters"
            leftIcon={<SlidersHorizontal className="h-4 w-4" aria-hidden="true" />}
          >
            Filters{activeFilters > 0 ? ` (${activeFilters})` : ''}
          </Button>
          <Button
            className="flex-1 whitespace-nowrap sm:flex-none"
            onClick={() => setConfirmBulk(true)}
            disabled={bulkScope.dues === 0}
            leftIcon={<BellRing className="h-4 w-4" aria-hidden="true" />}
          >
            Remind all overdue
          </Button>
        </div>
      </div>

      <FilterChips
        ariaLabel="Due status"
        value={status}
        onChange={(v) => {
          setStatus(v as DuesStatus);
          setPage(1);
        }}
        options={[
          { value: 'Due', label: 'Due', count: overview?.outstandingCount },
          { value: 'Overdue', label: 'Overdue', count: overview?.overdueCount },
          { value: 'Paid', label: 'Paid' },
          { value: 'Waived', label: 'Waived' },
          { value: 'All', label: 'All' },
        ]}
      />

      <div id="dues-filters" className={`${showFilters ? 'grid' : 'hidden'} grid-cols-2 gap-3 sm:grid lg:grid-cols-4`}>
        <div className="col-span-2 sm:col-span-1">
          <Select
            label="Garage"
            value={garageId}
            onChange={(e) => {
              setGarageId(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All garages' },
              ...garages.map((g) => ({
                value: g.garageId,
                label: `${g.garageName} · ${formatINRShort(g.outstandingAmount)}${g.overdueCount > 0 ? ' overdue' : ''}`,
              })),
            ]}
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <Select
            label="Sort"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as DuesSort);
              setPage(1);
            }}
            options={SORT_OPTIONS}
          />
        </div>
        <Input
          type="date"
          label="Due from"
          value={dueFrom}
          max={dueTo || undefined}
          onChange={(e) => {
            setDueFrom(e.target.value);
            setPage(1);
          }}
        />
        <Input
          type="date"
          label="Due to"
          value={dueTo}
          min={dueFrom || undefined}
          onChange={(e) => {
            setDueTo(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {(activeFilters > 0 || search) && (
        <div className="-mt-2 flex items-center justify-between gap-2 text-sm text-navy-500">
          <span>
            {totalCount} {totalCount === 1 ? 'result' : 'results'}
          </span>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2 font-medium text-electric-600 hover:text-electric-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Clear filters
          </button>
        </div>
      )}

      {/* List */}
      {loading && items.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : listError && items.length === 0 ? (
        <ErrorState title="Garage dues unavailable" error={listError} onRetry={loadList} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={
            search || activeFilters > 0
              ? 'No dues match these filters'
              : status === 'Due'
                ? 'No unpaid commission'
                : status === 'All'
                  ? 'No commissions yet'
                  : `No ${status.toLowerCase()} commissions`
          }
          description={
            search || activeFilters > 0
              ? 'Try a different search or clear the filters.'
              : 'A commission is raised for each job once the garage hands the car back to the customer.'
          }
        />
      ) : (
        <div className={`space-y-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {/* Desktop */}
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Garage</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead className="text-right">
                    Amount
                  </TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Reminders</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <React.Fragment key={`${g.garageId}-${g.items[0].id}`}>
                    {grouped && (
                      <TableRow className="bg-surface-50/70">
                        <TableCell colSpan={6} className="py-2">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                            <span className="font-semibold text-navy-900">{g.garageName}</span>
                            {g.garagePhone && (
                              <a href={telHref(g.garagePhone)} className="text-electric-600 hover:text-electric-700">
                                {g.garagePhone}
                              </a>
                            )}
                            {groupTotal(g) && <span className="text-navy-500">{groupTotal(g)}</span>}
                            {g.blocked && <Badge variant="red">Jobs paused</Badge>}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    {g.items.map((c) => (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => open(c)}>
                        <TableCell>
                          <button
                            type="button"
                            className="text-left font-semibold text-navy-900 hover:text-electric-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              open(c);
                            }}
                          >
                            {c.garageName}
                          </button>
                          {c.garagePhone && (
                            <div>
                              <a
                                href={telHref(c.garagePhone)}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-navy-500 hover:text-electric-700"
                              >
                                {c.garagePhone}
                              </a>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="whitespace-nowrap text-navy-800">{c.jobNumber || c.requestNumber}</div>
                          <div className="whitespace-nowrap text-xs text-navy-400">{c.commissionNumber}</div>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatINR(c.totalDue)}</TableCell>
                        <TableCell className="text-xs">
                          <div className="whitespace-nowrap text-navy-700">{formatDate(c.dueAtUtc)}</div>
                          <div className={`whitespace-nowrap ${c.isOverdue && isOpenDue(c) ? 'font-semibold text-red-600' : 'text-navy-400'}`}>{dueText(c)}</div>
                          <div className="mt-1.5">{statusBadges(c)}</div>
                        </TableCell>
                        <TableCell className="text-xs text-navy-600">
                          <div className="whitespace-nowrap tabular-nums">{c.remindersSent} sent</div>
                          {c.lastReminderAtUtc && <div className="whitespace-nowrap text-navy-400">Last {formatRelative(c.lastReminderAtUtc)}</div>}
                        </TableCell>
                        <TableCell className="text-right">{reminderButton(c)}</TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Phones and tablets */}
          <div className="space-y-4 lg:hidden">
            {groups.map((g) => (
              <section key={`${g.garageId}-${g.items[0].id}`} aria-label={grouped ? g.garageName : undefined} className="space-y-2">
                {grouped && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-sm">
                    <h3 className="font-semibold text-navy-900">{g.garageName}</h3>
                    {groupTotal(g) && <span className="text-xs text-navy-500">{groupTotal(g)}</span>}
                    {g.blocked && <Badge variant="red">Jobs paused</Badge>}
                  </div>
                )}
                {g.items.map((c) => (
                  <article key={c.id} className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-card">
                    <button
                      type="button"
                      onClick={() => open(c)}
                      className="block w-full px-4 pb-3 pt-3.5 text-left transition-colors hover:bg-surface-50 active:bg-surface-100"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-semibold text-navy-900">{grouped ? c.jobNumber || c.requestNumber : c.garageName}</div>
                          <div className="mt-0.5 truncate text-sm text-navy-500">
                            {(grouped ? [c.commissionNumber, c.vehicleSummary] : [c.jobNumber || c.requestNumber, c.commissionNumber]).filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-base font-bold tabular-nums text-navy-900">{formatINR(c.totalDue)}</div>
                          <div className="text-[11px] text-navy-400">Commission</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        {statusBadges(c)}
                        <span className={`text-xs ${c.isOverdue && isOpenDue(c) ? 'font-semibold text-red-600' : 'text-navy-500'}`}>
                          {dueText(c)}
                          {isOpenDue(c) ? ` · due ${formatDate(c.dueAtUtc)}` : ''}
                        </span>
                      </div>
                      <div className="mt-1.5 text-xs text-navy-400">{remindersText(c)}</div>
                    </button>
                    {isOpenDue(c) && (
                      <div className="flex gap-2 border-t border-surface-200/80 px-3 py-2.5">
                        {c.garagePhone && (
                          <a
                            href={telHref(c.garagePhone)}
                            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-surface-300 px-3 text-sm font-semibold text-navy-800 transition hover:bg-surface-50"
                            aria-label={`Call ${c.garageName} on ${c.garagePhone}`}
                          >
                            <Phone className="h-4 w-4" aria-hidden="true" />
                            Call
                          </a>
                        )}
                        {reminderButton(c, 'md', 'flex-1')}
                      </div>
                    )}
                  </article>
                ))}
              </section>
            ))}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalCount} pageSize={PAGE_SIZE} />
        </div>
      )}

      {/* Read-only sheet (advisor) */}
      {!onSelect && (
        <Modal
          isOpen={Boolean(viewing)}
          onClose={() => setViewing(null)}
          title={viewing?.garageName ?? ''}
          description={viewing ? `${viewing.commissionNumber} · Job ${viewing.jobNumber}` : undefined}
          footer={
            viewing && isOpenDue(viewing) ? (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {viewing.garagePhone && (
                  <a
                    href={telHref(viewing.garagePhone)}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-surface-300 px-4 text-sm font-semibold text-navy-800 transition hover:bg-surface-50"
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    Call garage
                  </a>
                )}
                {reminderButton(viewing, 'md', 'w-full sm:w-auto')}
              </div>
            ) : (
              <Button variant="outline" onClick={() => setViewing(null)} className="w-full sm:ml-auto sm:flex sm:w-auto">
                Close
              </Button>
            )
          }
        >
          {viewing && <CommissionDetails commission={viewing} />}
        </Modal>
      )}

      <ConfirmationDialog
        isOpen={confirmBulk}
        onClose={() => !bulkWorking && setConfirmBulk(false)}
        onConfirm={remindAll}
        isLoading={bulkWorking}
        variant="primary"
        title={garageFilter ? `Remind ${garageFilter.garageName}?` : 'Remind all overdue garages?'}
        message={
          `${bulkScope.garages} garage${bulkScope.garages === 1 ? '' : 's'} owe ${formatINR(bulkScope.amount)} across ${bulkScope.dues} overdue ` +
          `${bulkScope.dues === 1 ? 'due' : 'dues'}. Each garage gets one message in the app and by SMS, email or WhatsApp. ` +
          'Dues reminded in the last hour are skipped.'
        }
        confirmText="Send reminders"
      />
    </div>
  );
}
