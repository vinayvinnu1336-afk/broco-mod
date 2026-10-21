'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { FinanceOverviewDto, GarageSettlementDto, FinancialLedgerEntryDto } from '@/types/finance';
import {
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  Percent,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterBar } from '@/components/ui/FilterBar';
import { FilterChips } from '@/components/ui/FilterChips';
import { Input } from '@/components/ui/Input';
import { IconTile, ListGroup, ListItem } from '@/components/ui/ListItem';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { CommissionSummaryCard } from '@/components/admin/CommissionSummaryCard';
import { formatDate, formatDateTime, formatINR, formatINRShort, formatINRWhole } from '@/lib/format';
import { dateRangeQuery, toQueryString, useUrlFilters } from '@/lib/useUrlFilters';
import { useCityOptions } from '@/lib/filterOptions';
import { Select } from '@/components/ui/Select';

// ---------------------------------------------------------------------------------------------
// Response normalisation. The API returns settlements as a paged object and ledger rows with
// debit/credit columns; older field names from `@/types/finance` are still accepted.
// ---------------------------------------------------------------------------------------------

type Raw = Record<string, unknown>;

function pickNumber(obj: Raw | null | undefined, ...keys: string[]): number | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
  }
  return undefined;
}

function pickString(obj: Raw | null | undefined, ...keys: string[]): string | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
    if (typeof value === 'number') return String(value);
  }
  return undefined;
}

function toList(data: unknown): { items: Raw[]; total: number; page: number; totalPages: number } {
  if (Array.isArray(data)) return { items: data as Raw[], total: data.length, page: 1, totalPages: 1 };
  if (data && typeof data === 'object') {
    const items = (data as Raw).items;
    if (Array.isArray(items)) {
      return {
        items: items as Raw[],
        total: pickNumber(data as Raw, 'totalCount') ?? items.length,
        page: pickNumber(data as Raw, 'page') ?? 1,
        totalPages: pickNumber(data as Raw, 'totalPages') ?? 1,
      };
    }
  }
  return { items: [], total: 0, page: 1, totalPages: 1 };
}

interface SettlementRow {
  id: string;
  number: string;
  garageName: string;
  jobNumber?: string;
  gross: number;
  fee: number;
  feeRate?: number;
  feeFixed?: number;
  totalFee: number;
  net: number;
  status: string;
  payoutRef?: string;
  paidAt?: string;
  createdAt?: string;
}

function toSettlementRow(r: Raw): SettlementRow {
  const fee = pickNumber(r, 'platformFeeAmount') ?? 0;
  return {
    id: pickString(r, 'id') ?? '',
    number: pickString(r, 'settlementNumber') ?? '—',
    garageName: pickString(r, 'garageName') ?? 'Unnamed garage',
    jobNumber: pickString(r, 'jobNumber'),
    gross: pickNumber(r, 'grossAmount') ?? 0,
    fee,
    feeRate: pickNumber(r, 'platformFeePercentage', 'platformFeeRatePercent'),
    feeFixed: pickNumber(r, 'platformFeeFixed'),
    totalFee: pickNumber(r, 'totalPlatformFee') ?? fee,
    net: pickNumber(r, 'netPayableToGarage') ?? 0,
    status: pickString(r, 'status') ?? 'Pending',
    payoutRef: pickString(r, 'payoutTransactionRef', 'payoutReference'),
    paidAt: pickString(r, 'settledAtUtc', 'payoutProcessedAtUtc'),
    createdAt: pickString(r, 'createdAtUtc'),
  };
}

const CLOSED_SETTLEMENT = ['COMPLETED', 'CANCELLED'];
const isPayable = (s: SettlementRow) => !CLOSED_SETTLEMENT.includes(s.status.toUpperCase());

interface LedgerRow {
  id: string;
  reference: string;
  account: string;
  entryType: string;
  description: string;
  debit: number;
  credit: number;
  createdAt?: string;
}

function toLedgerRow(r: Raw): LedgerRow {
  let debit = pickNumber(r, 'debitAmount');
  let credit = pickNumber(r, 'creditAmount');
  if (debit === undefined && credit === undefined) {
    const amount = pickNumber(r, 'amount') ?? 0;
    const isDebit = (pickString(r, 'direction') ?? '').toLowerCase() === 'debit';
    debit = isDebit ? amount : 0;
    credit = isDebit ? 0 : amount;
  }
  return {
    id: pickString(r, 'id') ?? '',
    reference: pickString(r, 'transactionReference', 'entryNumber') ?? '—',
    account: pickString(r, 'accountType') ?? '',
    entryType: pickString(r, 'entryType') ?? '',
    description: pickString(r, 'description') ?? '',
    debit: debit ?? 0,
    credit: credit ?? 0,
    createdAt: pickString(r, 'createdAtUtc'),
  };
}

const ACCOUNT_LABELS: Record<string, string> = {
  PLATFORM_CASH: 'BroCo cash',
  PLATFORM_BOOKING_FEE: 'Booking advances',
  PLATFORM_COMMISSION: 'Garage commission',
  // Account keys only found on old ledger rows.
  GST_PAYABLE: 'Legacy adjustment',
  ESCROW: 'Held in escrow',
  CUSTOMER: 'Customer',
  GARAGE_PAYABLE: 'Payable to garage',
  PLATFORM_REVENUE: 'Platform fee',
  PLATFORM_TAX_LIABILITY: 'Legacy adjustment',
  PLATFORM_MARGIN: 'Advisor margin',
};

function accountLabel(account: string): string {
  if (!account) return 'Other';
  const key = account.toUpperCase();
  if (ACCOUNT_LABELS[key]) return ACCOUNT_LABELS[key];
  const words = key.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function entryAmount(row: LedgerRow) {
  return row.debit > 0 ? { label: 'Debit', value: row.debit } : { label: 'Credit', value: row.credit };
}

// ---------------------------------------------------------------------------------------------

type Tab = 'settlements' | 'ledger';

// SettlementStatus names (sent to the API as they are).
const SETTLEMENT_STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'Pending', label: 'To pay' },
  { value: 'Processing', label: 'Processing' },
  { value: 'OnHold', label: 'On hold' },
  { value: 'Completed', label: 'Paid' },
  { value: 'Cancelled', label: 'Cancelled' },
];

// LedgerEntryType names.
const ENTRY_TYPE_OPTIONS = [
  { value: 'BookingAdvance', label: 'Booking advance' },
  { value: 'Commission', label: 'Commission' },
  { value: 'Refund', label: 'Refund' },
  { value: 'CustomerPayment', label: 'Customer payment' },
  { value: 'PlatformFee', label: 'Platform fee' },
  { value: 'GaragePayable', label: 'Payable to garage' },
  { value: 'Adjustment', label: 'Adjustment' },
];

const ACCOUNT_OPTIONS = Object.entries(ACCOUNT_LABELS).map(([value, label]) => ({ value, label }));

/** The ledger endpoint returns at most this many (latest) matching entries. */
const LEDGER_LIMIT = 200;

// Each tab keeps its own filters in the URL (l* = ledger, s* = settlements), so switching tabs keeps them.
const FILTER_DEFAULTS = {
  tab: 'ledger',
  // City of the summary cards (bookings by their city, commission by the garage's).
  city: '',
  lq: '',
  ltype: '',
  lacct: '',
  lrange: '',
  lfrom: '',
  lto: '',
  sq: '',
  sstatus: '',
  srange: '',
  sfrom: '',
  sto: '',
  ssize: '25',
};
type FilterKey = keyof typeof FILTER_DEFAULTS;
const LEDGER_KEYS: FilterKey[] = ['lq', 'ltype', 'lacct', 'lrange', 'lfrom', 'lto'];
const SETTLEMENT_KEYS: FilterKey[] = ['sq', 'sstatus', 'srange', 'sfrom', 'sto'];

export default function AdminFinancePage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <AdminFinance />
    </Suspense>
  );
}

function AdminFinance() {
  const router = useRouter();
  const toast = useToast();
  const filters = useUrlFilters(FILTER_DEFAULTS);
  const cityOptions = useCityOptions(true);
  const { values: f, page: urlPage } = filters;
  const activeTab: Tab = f.tab === 'settlements' ? 'settlements' : 'ledger';

  const [overview, setOverview] = useState<Raw | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [settlementsTotal, setSettlementsTotal] = useState(0);
  const [settlementsPage, setSettlementsPage] = useState(1);
  const [settlementsPages, setSettlementsPages] = useState(1);
  const [settlementsLoading, setSettlementsLoading] = useState(true);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [errors, setErrors] = useState<{ overview?: string; settlements?: string; ledger?: string }>({});
  const settlementsPageSize = [25, 50, 100].includes(Number(f.ssize)) ? Number(f.ssize) : 25;
  const latestSettlements = useRef(0);
  const latestLedger = useRef(0);

  // Settlement sheet (details + mark paid)
  const [selectedSettlement, setSelectedSettlement] = useState<SettlementRow | null>(null);
  const [payoutRef, setPayoutRef] = useState('');
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const settlementsQuery = useMemo(
    () =>
      toQueryString({
        page: urlPage,
        pageSize: settlementsPageSize,
        search: f.sq,
        status: f.sstatus,
        ...dateRangeQuery({ range: f.srange, from: f.sfrom, to: f.sto }, ['fromDate', 'toDate']),
      }),
    [urlPage, settlementsPageSize, f.sq, f.sstatus, f.srange, f.sfrom, f.sto]
  );

  const ledgerQuery = useMemo(
    () =>
      toQueryString({
        search: f.lq,
        entryType: f.ltype,
        accountType: f.lacct,
        ...dateRangeQuery({ range: f.lrange, from: f.lfrom, to: f.lto }),
      }),
    [f.lq, f.ltype, f.lacct, f.lrange, f.lfrom, f.lto]
  );

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    const res = await apiFetch<FinanceOverviewDto>(`/admin/finance/overview${toQueryString({ city: f.city })}`);
    if (res.success && res.data) {
      setOverview(res.data as unknown as Raw);
      setErrors((e) => ({ ...e, overview: undefined }));
    } else {
      setErrors((e) => ({ ...e, overview: res.message || 'Could not load the finance summary.' }));
    }
    setOverviewLoading(false);
  }, [f.city]);

  const loadSettlements = useCallback(async (qs: string) => {
    const id = ++latestSettlements.current;
    setSettlementsLoading(true);
    const res = await apiFetch<GarageSettlementDto[]>(`/admin/finance/settlements${qs}`);
    if (id !== latestSettlements.current) return; // a newer filter change is already loading
    if (res.success && res.data) {
      const data = toList(res.data);
      setSettlements(data.items.map(toSettlementRow));
      setSettlementsTotal(data.total);
      setSettlementsPage(data.page);
      setSettlementsPages(data.totalPages);
      setErrors((e) => ({ ...e, settlements: undefined }));
    } else {
      setErrors((e) => ({ ...e, settlements: res.message || 'Could not load settlements.' }));
    }
    setSettlementsLoading(false);
  }, []);

  const loadLedger = useCallback(async (qs: string) => {
    const id = ++latestLedger.current;
    setLedgerLoading(true);
    const res = await apiFetch<FinancialLedgerEntryDto[]>(`/admin/finance/ledger${qs}`);
    if (id !== latestLedger.current) return;
    if (res.success && res.data) {
      setLedger(toList(res.data).items.map(toLedgerRow));
      setErrors((e) => ({ ...e, ledger: undefined }));
    } else {
      setErrors((e) => ({ ...e, ledger: res.message || 'Could not load ledger entries.' }));
    }
    setLedgerLoading(false);
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadSettlements(settlementsQuery);
  }, [loadSettlements, settlementsQuery]);

  useEffect(() => {
    loadLedger(ledgerQuery);
  }, [loadLedger, ledgerQuery]);

  const goToSettlementsPage = (p: number) => {
    filters.setPage(p);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openSettlement = (s: SettlementRow) => {
    setSelectedSettlement(s);
    setPayoutRef('');
    setCompleteError(null);
  };

  const closeSettlement = useCallback(() => {
    if (completing) return;
    setSelectedSettlement(null);
  }, [completing]);

  const handleCompletePayout = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedSettlement) return;
    if (!payoutRef.trim()) {
      setCompleteError('Enter the bank transfer reference (UTR) for this payout.');
      return;
    }

    setCompleting(true);
    setCompleteError(null);

    const res = await apiFetch<GarageSettlementDto>(
      `/admin/finance/settlements/${selectedSettlement.id}/complete`,
      {
        method: 'POST',
        body: JSON.stringify({ payoutTransactionRef: payoutRef.trim() }),
      }
    );

    setCompleting(false);

    if (res.success && res.data) {
      toast.success('Settlement marked as paid', `${selectedSettlement.garageName} · ${formatINR(selectedSettlement.net)}`);
      setSelectedSettlement(null);
      setPayoutRef('');
      loadOverview();
      loadSettlements(settlementsQuery);
    } else {
      setCompleteError(res.message || 'Could not mark this settlement as paid. Please try again.');
    }
  };

  const anyLedgerFilter = LEDGER_KEYS.some((k) => filters.isActive(k));
  const anySettlementFilter = SETTLEMENT_KEYS.some((k) => filters.isActive(k));
  const safeSettlementsPages = Math.max(1, settlementsPages);

  // ---- KPI values (only what the API returns) ----
  const kpi = {
    collected: pickNumber(overview, 'totalGrossRevenue'),
    paymentsCount: pickNumber(overview, 'totalPaymentsCount'),
    advances: pickNumber(overview, 'totalBookingAdvances'),
    commission: pickNumber(overview, 'totalCommissionCollected'),
    advisorMargin: pickNumber(overview, 'totalPlatformMargin', 'totalAdvisorMargin'),
    payable: pickNumber(overview, 'totalGarageSettlements', 'totalGaragePayouts'),
    pendingCount: pickNumber(overview, 'pendingSettlementsCount'),
    completedCount: pickNumber(overview, 'completedSettlementsCount'),
    refunds: pickNumber(overview, 'totalRefunds', 'totalRefundedAmount'),
  };

  const payableHint = [
    kpi.pendingCount !== undefined ? `${kpi.pendingCount} to pay` : null,
    kpi.completedCount !== undefined ? `${kpi.completedCount} paid` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Finance"
        description="Booking advances customers paid online, commission garages paid BroCo, and refunds."
        actions={
          <>
            <div className="w-full sm:w-44">
              <Select
                aria-label="City for the summary"
                value={f.city}
                onChange={(e) => filters.set({ city: e.target.value })}
                options={[{ value: '', label: 'All cities' }, ...cityOptions]}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => router.push('/admin/payments')}
              leftIcon={<CreditCard className="h-4 w-4" />}
            >
              Payments & refunds
            </Button>
          </>
        }
      />

      {/* KPIs */}
      {overviewLoading && !overview ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[104px] rounded-2xl" />
          ))}
        </div>
      ) : errors.overview && !overview ? (
        <ErrorState title="Finance summary unavailable" error={errors.overview} onRetry={loadOverview} />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpi.collected !== undefined && (
            <StatCard
              label="Collected"
              value={formatINRShort(kpi.collected)}
              icon={Wallet}
              tone="blue"
              hint={kpi.paymentsCount !== undefined ? `${kpi.paymentsCount} payments` : 'From customers'}
            />
          )}
          {kpi.advances !== undefined && (
            <StatCard
              label="Booking advances"
              value={formatINRShort(kpi.advances)}
              icon={Percent}
              tone="green"
              hint="10% paid online, net of refunds"
            />
          )}
          {kpi.commission !== undefined && (
            <StatCard
              label="Commission received"
              value={formatINRShort(kpi.commission)}
              icon={Banknote}
              tone="green"
              hint="From garages"
            />
          )}
          {/* Only from before the 10% model: markup and garage payouts are no longer created. */}
          {kpi.advisorMargin !== undefined && kpi.advisorMargin > 0 && (
            <StatCard label="Advisor margin (legacy)" value={formatINRShort(kpi.advisorMargin)} icon={Banknote} tone="neutral" />
          )}
          {kpi.payable !== undefined && kpi.payable > 0 && (
            <StatCard
              label="Payable to garages (legacy)"
              value={formatINRShort(kpi.payable)}
              icon={Building2}
              tone="amber"
              hint={payableHint || undefined}
            />
          )}
          {kpi.refunds !== undefined && (
            <StatCard label="Refunds" value={formatINRShort(kpi.refunds)} icon={RotateCcw} tone="red" hint="Returned to customers" />
          )}
        </div>
      )}

      {/* Garage commission dues (10% owed by garages after each job) */}
      <CommissionSummaryCard />

      {/* Section switch */}
      <FilterChips
        ariaLabel="Finance section"
        value={activeTab}
        onChange={(v) => filters.set({ tab: v })}
        options={[
          { value: 'ledger', label: 'Ledger', count: ledgerLoading ? undefined : ledger.length },
          { value: 'settlements', label: 'Legacy settlements', count: settlementsLoading ? undefined : settlementsTotal },
        ]}
      />

      {/* ---------------- Settlements ---------------- */}
      {activeTab === 'settlements' && (
        <section className="space-y-3" aria-label="Garage settlements">
          <FilterBar
            filters={filters}
            searchKey="sq"
            searchPlaceholder="Garage, settlement, job or payout reference"
            searchLabel="Search settlements"
            status={{ key: 'sstatus', options: SETTLEMENT_STATUS_OPTIONS, ariaLabel: 'Settlement status' }}
            fields={[{ type: 'dateRange', label: 'Created', keys: { range: 'srange', from: 'sfrom', to: 'sto' } }]}
            summary={
              settlementsLoading ? 'Loading…' : `${settlementsTotal} ${settlementsTotal === 1 ? 'settlement' : 'settlements'}`
            }
            trailing={
              <label className="flex items-center gap-2">
                Per page
                <select
                  value={settlementsPageSize}
                  onChange={(e) => filters.set({ ssize: e.target.value })}
                  className="min-h-[36px] rounded-lg border border-surface-200 bg-white px-2 text-sm text-navy-900 focus:border-electric-600 focus:outline-none focus:ring-2 focus:ring-electric-600/20"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
            }
          />

          {settlementsLoading && settlements.length === 0 ? (
            <ListSkeleton />
          ) : errors.settlements && settlements.length === 0 ? (
            <ErrorState
              title="Settlements unavailable"
              error={errors.settlements}
              onRetry={() => loadSettlements(settlementsQuery)}
            />
          ) : settlements.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={anySettlementFilter ? 'No matching settlements' : 'No settlements yet'}
              description={
                anySettlementFilter
                  ? 'No settlements match these filters.'
                  : 'Settlements are no longer created. BroCo now collects a 10% booking advance online, and the garage pays its commission after each job.'
              }
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <tr>
                      <TableHead>Settlement</TableHead>
                      <TableHead>Garage</TableHead>
                      <TableHead className="text-right">Garage quote</TableHead>
                      <TableHead className="text-right">Platform fee</TableHead>
                      <TableHead className="text-right">Net payout</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {settlements.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="font-semibold text-navy-900">{s.number}</div>
                          <div className="text-xs text-navy-500">
                            {s.payoutRef ? `Ref ${s.payoutRef}` : s.createdAt ? formatDate(s.createdAt) : ''}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-navy-900">{s.garageName}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatINR(s.gross)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatINR(s.fee)}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-navy-900">{formatINR(s.net)}</TableCell>
                        <TableCell>
                          <StatusBadge status={s.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {isPayable(s) ? (
                            <Button size="sm" onClick={() => openSettlement(s)}>
                              Mark paid
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => openSettlement(s)}>
                              Details
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
                  {settlements.map((s) => (
                    <ListItem
                      key={s.id}
                      onClick={() => openSettlement(s)}
                      leading={<IconTile icon={Building2} tone={isPayable(s) ? 'amber' : 'green'} />}
                      title={s.garageName}
                      subtitle={s.number}
                      meta={`Quote ${formatINRWhole(s.gross)} · Fee ${formatINRWhole(s.fee)}`}
                      trailing={
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-sm font-semibold tabular-nums text-navy-900">{formatINRWhole(s.net)}</span>
                          <StatusBadge status={s.status} />
                        </div>
                      }
                    />
                  ))}
                </ListGroup>
              </div>

              {safeSettlementsPages > 1 && (
                <div className="flex items-center gap-3 md:hidden">
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={settlementsPage <= 1 || settlementsLoading}
                    onClick={() => goToSettlementsPage(settlementsPage - 1)}
                    leftIcon={<ChevronLeft className="h-4 w-4" />}
                  >
                    Previous
                  </Button>
                  <span className="shrink-0 text-sm tabular-nums text-navy-500">
                    {settlementsPage} / {safeSettlementsPages}
                  </span>
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={settlementsPage >= safeSettlementsPages || settlementsLoading}
                    onClick={() => goToSettlementsPage(settlementsPage + 1)}
                    rightIcon={<ChevronRight className="h-4 w-4" />}
                  >
                    Next
                  </Button>
                </div>
              )}
              <div className="hidden md:block">
                <Pagination
                  currentPage={settlementsPage}
                  totalPages={safeSettlementsPages}
                  totalItems={settlementsTotal}
                  pageSize={settlementsPageSize}
                  onPageChange={goToSettlementsPage}
                />
              </div>
            </>
          )}
        </section>
      )}

      {/* ---------------- Ledger ---------------- */}
      {activeTab === 'ledger' && (
        <section className="space-y-3" aria-label="Ledger">
          <p className="px-1 text-sm text-navy-500">
            Every money movement is recorded twice: once leaving one account (debit) and once arriving in another (credit).
          </p>
          <FilterBar
            filters={filters}
            searchKey="lq"
            searchPlaceholder="Reference or description"
            searchLabel="Search ledger"
            fields={[
              { type: 'select', key: 'ltype', label: 'Entry type', allLabel: 'All entry types', options: ENTRY_TYPE_OPTIONS },
              { type: 'select', key: 'lacct', label: 'Account', allLabel: 'All accounts', options: ACCOUNT_OPTIONS },
              { type: 'dateRange', label: 'Date', keys: { range: 'lrange', from: 'lfrom', to: 'lto' } },
            ]}
            summary={
              ledgerLoading
                ? 'Loading…'
                : ledger.length >= LEDGER_LIMIT
                  ? `Latest ${LEDGER_LIMIT} entries`
                  : `${ledger.length} ${ledger.length === 1 ? 'entry' : 'entries'}`
            }
          />

          {ledgerLoading && ledger.length === 0 ? (
            <ListSkeleton />
          ) : errors.ledger && ledger.length === 0 ? (
            <ErrorState title="Ledger unavailable" error={errors.ledger} onRetry={() => loadLedger(ledgerQuery)} />
          ) : ledger.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={anyLedgerFilter ? 'No matching entries' : 'No ledger entries yet'}
              description={
                anyLedgerFilter
                  ? 'No ledger entries match these filters.'
                  : 'Entries appear once a booking advance or a commission is paid.'
              }
            />
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <tr>
                      <TableHead>Reference</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead>When</TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {ledger.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs font-medium text-navy-700">{l.reference}</TableCell>
                        <TableCell className="whitespace-nowrap font-medium text-navy-900">{accountLabel(l.account)}</TableCell>
                        <TableCell className="max-w-xs text-navy-600">
                          <span className="line-clamp-2">{l.description || '—'}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{l.debit > 0 ? formatINR(l.debit) : '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.credit > 0 ? formatINR(l.credit) : '—'}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-navy-500">{formatDateTime(l.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden">
                <ListGroup>
                  {ledger.map((l) => {
                    const amount = entryAmount(l);
                    return (
                      <ListItem
                        key={l.id}
                        title={accountLabel(l.account)}
                        subtitle={l.description || l.reference}
                        meta={`${l.reference} · ${formatDateTime(l.createdAt)}`}
                        trailing={
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-semibold tabular-nums text-navy-900">{formatINRWhole(amount.value)}</span>
                            <span className="text-xs text-navy-500">{amount.label}</span>
                          </div>
                        }
                      />
                    );
                  })}
                </ListGroup>
              </div>
            </>
          )}
        </section>
      )}

      {/* ---------------- Settlement sheet ---------------- */}
      <Modal
        isOpen={!!selectedSettlement}
        onClose={closeSettlement}
        size="sm"
        title={selectedSettlement && isPayable(selectedSettlement) ? 'Mark settlement as paid' : 'Settlement details'}
        description={selectedSettlement ? `${selectedSettlement.garageName} · ${selectedSettlement.number}` : undefined}
        footer={
          selectedSettlement && isPayable(selectedSettlement) ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <Button variant="outline" onClick={closeSettlement} disabled={completing} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button
                type="submit"
                form="mark-paid-form"
                isLoading={completing}
                leftIcon={<CheckCircle2 className="h-4 w-4" />}
                className="w-full sm:w-auto"
              >
                Mark paid
              </Button>
            </div>
          ) : (
            <div className="flex sm:justify-end">
              <Button variant="outline" onClick={closeSettlement} className="w-full sm:w-auto">
                Close
              </Button>
            </div>
          )
        }
      >
        {selectedSettlement && (
          <div className="space-y-5">
            <Card className="p-4 shadow-none">
              <dl className="space-y-2.5 text-sm">
                <BreakdownRow label="Garage quote total" value={formatINR(selectedSettlement.gross)} />
                <BreakdownRow
                  label={`Platform fee${feeRateLabel(selectedSettlement)}`}
                  value={`− ${formatINR(selectedSettlement.fee)}`}
                />
                <div className="border-t border-surface-200 pt-2.5">
                  <BreakdownRow label="Net payout to garage" value={formatINR(selectedSettlement.net)} strong />
                </div>
              </dl>
            </Card>

            <dl className="space-y-2 text-sm">
              <BreakdownRow label="Status" value={<StatusBadge status={selectedSettlement.status} />} />
              {selectedSettlement.jobNumber && <BreakdownRow label="Job" value={selectedSettlement.jobNumber} />}
              {selectedSettlement.createdAt && <BreakdownRow label="Created" value={formatDate(selectedSettlement.createdAt)} />}
              {selectedSettlement.payoutRef && <BreakdownRow label="Payout reference" value={selectedSettlement.payoutRef} />}
              {selectedSettlement.paidAt && <BreakdownRow label="Paid on" value={formatDate(selectedSettlement.paidAt)} />}
            </dl>

            {isPayable(selectedSettlement) && (
              <form id="mark-paid-form" onSubmit={handleCompletePayout} className="space-y-3">
                <Input
                  id="payout-reference"
                  label="Bank transfer reference (UTR)"
                  placeholder="e.g. UTR number from your bank"
                  value={payoutRef}
                  onChange={(e) => setPayoutRef(e.target.value)}
                  autoComplete="off"
                  required
                  error={completeError ?? undefined}
                  helperText="Send the net payout to the garage first, then record the transfer reference here."
                />
              </form>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function feeRateLabel(s: SettlementRow): string {
  const parts: string[] = [];
  if (s.feeRate !== undefined && s.feeRate > 0) parts.push(`${s.feeRate}%`);
  if (s.feeFixed !== undefined && s.feeFixed > 0) parts.push(`${formatINRWhole(s.feeFixed)} fixed`);
  return parts.length ? ` (${parts.join(' + ')})` : '';
}

function BreakdownRow({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={strong ? 'font-semibold text-navy-900' : 'text-navy-500'}>{label}</dt>
      <dd className={`text-right tabular-nums ${strong ? 'text-base font-bold text-navy-900' : 'font-medium text-navy-800'}`}>{value}</dd>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16 rounded-2xl" />
      ))}
    </div>
  );
}
