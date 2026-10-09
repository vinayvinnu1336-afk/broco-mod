'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  RotateCcw,
  Search,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterChips } from '@/components/ui/FilterChips';
import { Input } from '@/components/ui/Input';
import { IconTile, ListGroup, ListItem } from '@/components/ui/ListItem';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { formatDate, formatDateTime, formatINR, formatINRShort, formatINRWhole } from '@/lib/format';

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

function toList(data: unknown): { items: Raw[]; total: number } {
  if (Array.isArray(data)) return { items: data as Raw[], total: data.length };
  if (data && typeof data === 'object') {
    const items = (data as Raw).items;
    if (Array.isArray(items)) {
      return { items: items as Raw[], total: pickNumber(data as Raw, 'totalCount') ?? items.length };
    }
  }
  return { items: [], total: 0 };
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
  gst: number;
  gstRate?: number;
  totalFee: number;
  net: number;
  status: string;
  payoutRef?: string;
  paidAt?: string;
  createdAt?: string;
}

function toSettlementRow(r: Raw): SettlementRow {
  const fee = pickNumber(r, 'platformFeeAmount') ?? 0;
  const gst = pickNumber(r, 'taxOnPlatformFee', 'platformFeeGstAmount') ?? 0;
  return {
    id: pickString(r, 'id') ?? '',
    number: pickString(r, 'settlementNumber') ?? '—',
    garageName: pickString(r, 'garageName') ?? 'Unnamed garage',
    jobNumber: pickString(r, 'jobNumber'),
    gross: pickNumber(r, 'grossAmount') ?? 0,
    fee,
    feeRate: pickNumber(r, 'platformFeePercentage', 'platformFeeRatePercent'),
    feeFixed: pickNumber(r, 'platformFeeFixed'),
    gst,
    gstRate: pickNumber(r, 'platformFeeGstRatePercent'),
    totalFee: pickNumber(r, 'totalPlatformFee') ?? fee + gst,
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
  ESCROW: 'Held in escrow',
  CUSTOMER: 'Customer',
  GARAGE_PAYABLE: 'Payable to garage',
  PLATFORM_REVENUE: 'Platform fee',
  PLATFORM_TAX_LIABILITY: 'GST on platform fee',
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
type SettlementFilter = 'all' | 'to-pay' | 'paid';

export default function AdminFinancePage() {
  const router = useRouter();
  const toast = useToast();

  const [overview, setOverview] = useState<Raw | null>(null);
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [settlementsTotal, setSettlementsTotal] = useState(0);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<{ overview?: string; settlements?: string; ledger?: string }>({});

  const [activeTab, setActiveTab] = useState<Tab>('settlements');
  const [settlementSearch, setSettlementSearch] = useState('');
  const [settlementFilter, setSettlementFilter] = useState<SettlementFilter>('all');
  const [accountFilter, setAccountFilter] = useState('all');

  // Settlement sheet (details + mark paid)
  const [selectedSettlement, setSelectedSettlement] = useState<SettlementRow | null>(null);
  const [payoutRef, setPayoutRef] = useState('');
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [ovRes, setRes, ledRes] = await Promise.all([
      apiFetch<FinanceOverviewDto>('/admin/finance/overview'),
      apiFetch<GarageSettlementDto[]>('/admin/finance/settlements'),
      apiFetch<FinancialLedgerEntryDto[]>('/admin/finance/ledger?limit=100'),
    ]);

    const nextErrors: { overview?: string; settlements?: string; ledger?: string } = {};

    if (ovRes.success && ovRes.data) setOverview(ovRes.data as unknown as Raw);
    else nextErrors.overview = ovRes.message || 'Could not load the finance summary.';

    if (setRes.success && setRes.data) {
      const { items, total } = toList(setRes.data);
      setSettlements(items.map(toSettlementRow));
      setSettlementsTotal(total);
    } else {
      nextErrors.settlements = setRes.message || 'Could not load settlements.';
    }

    if (ledRes.success && ledRes.data) setLedger(toList(ledRes.data).items.map(toLedgerRow));
    else nextErrors.ledger = ledRes.message || 'Could not load ledger entries.';

    setErrors(nextErrors);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      loadData();
    } else {
      setCompleteError(res.message || 'Could not mark this settlement as paid. Please try again.');
    }
  };

  // ---- Derived lists ----
  const settlementCounts = useMemo(
    () => ({
      all: settlements.length,
      toPay: settlements.filter(isPayable).length,
      paid: settlements.filter((s) => s.status.toUpperCase() === 'COMPLETED').length,
    }),
    [settlements]
  );

  const filteredSettlements = useMemo(() => {
    const q = settlementSearch.trim().toLowerCase();
    return settlements.filter((s) => {
      if (settlementFilter === 'to-pay' && !isPayable(s)) return false;
      if (settlementFilter === 'paid' && s.status.toUpperCase() !== 'COMPLETED') return false;
      if (!q) return true;
      return (
        s.number.toLowerCase().includes(q) ||
        s.garageName.toLowerCase().includes(q) ||
        (s.payoutRef ?? '').toLowerCase().includes(q) ||
        (s.jobNumber ?? '').toLowerCase().includes(q)
      );
    });
  }, [settlements, settlementSearch, settlementFilter]);

  const accountOptions = useMemo(() => {
    const counts = new Map<string, number>();
    ledger.forEach((l) => counts.set(l.account, (counts.get(l.account) ?? 0) + 1));
    return [
      { value: 'all', label: 'All', count: ledger.length },
      ...Array.from(counts.entries()).map(([account, count]) => ({ value: account, label: accountLabel(account), count })),
    ];
  }, [ledger]);

  const filteredLedger = useMemo(
    () => (accountFilter === 'all' ? ledger : ledger.filter((l) => l.account === accountFilter)),
    [ledger, accountFilter]
  );

  // ---- KPI values (only what the API returns) ----
  const kpi = {
    collected: pickNumber(overview, 'totalGrossRevenue'),
    paymentsCount: pickNumber(overview, 'totalPaymentsCount'),
    platformFee: pickNumber(overview, 'totalPlatformRevenue'),
    platformFeeGst: pickNumber(overview, 'totalPlatformFeeGst', 'totalTaxOnPlatformFee'),
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
        description="Money collected from customers, what the platform keeps, and what is owed to garages."
        actions={
          <Button
            variant="outline"
            onClick={() => router.push('/admin/payments')}
            leftIcon={<CreditCard className="h-4 w-4" />}
          >
            Payments & refunds
          </Button>
        }
      />

      {/* KPIs */}
      {loading && !overview ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[104px] rounded-2xl" />
          ))}
        </div>
      ) : errors.overview && !overview ? (
        <ErrorState title="Finance summary unavailable" error={errors.overview} onRetry={loadData} />
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
          {kpi.platformFee !== undefined && (
            <StatCard
              label={kpi.platformFeeGst !== undefined ? 'Platform fee' : 'Platform fee incl. GST'}
              value={formatINRShort(
                kpi.platformFeeGst !== undefined ? kpi.platformFee - kpi.platformFeeGst : kpi.platformFee
              )}
              icon={Percent}
              tone="green"
              hint="From settlements"
            />
          )}
          {kpi.platformFeeGst !== undefined && (
            <StatCard label="GST on fee" value={formatINRShort(kpi.platformFeeGst)} icon={FileText} tone="neutral" />
          )}
          {kpi.advisorMargin !== undefined && (
            <StatCard label="Advisor margin" value={formatINRShort(kpi.advisorMargin)} icon={Banknote} tone="green" />
          )}
          {kpi.payable !== undefined && (
            <StatCard
              label="Payable to garages"
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

      {/* Section switch */}
      <FilterChips
        ariaLabel="Finance section"
        value={activeTab}
        onChange={(v) => setActiveTab(v as Tab)}
        options={[
          { value: 'settlements', label: 'Garage settlements', count: loading ? undefined : settlements.length },
          { value: 'ledger', label: 'Ledger', count: loading ? undefined : ledger.length },
        ]}
      />

      {/* ---------------- Settlements ---------------- */}
      {activeTab === 'settlements' && (
        <section className="space-y-3" aria-label="Garage settlements">
          <Input
            type="search"
            aria-label="Search settlements"
            placeholder="Search by garage, settlement or payout reference"
            value={settlementSearch}
            onChange={(e) => setSettlementSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
          <FilterChips
            ariaLabel="Settlement status"
            value={settlementFilter}
            onChange={(v) => setSettlementFilter(v as SettlementFilter)}
            options={[
              { value: 'all', label: 'All', count: settlementCounts.all },
              { value: 'to-pay', label: 'To pay', count: settlementCounts.toPay },
              { value: 'paid', label: 'Paid', count: settlementCounts.paid },
            ]}
          />

          {loading && settlements.length === 0 ? (
            <ListSkeleton />
          ) : errors.settlements && settlements.length === 0 ? (
            <ErrorState title="Settlements unavailable" error={errors.settlements} onRetry={loadData} />
          ) : filteredSettlements.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={settlements.length === 0 ? 'No settlements yet' : 'No matching settlements'}
              description={
                settlements.length === 0
                  ? 'A settlement is created for the garage when a customer payment is received.'
                  : 'Try a different search or status filter.'
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
                      <TableHead className="text-right">GST on fee</TableHead>
                      <TableHead className="text-right">Net payout</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {filteredSettlements.map((s) => (
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
                        <TableCell className="text-right tabular-nums">{formatINR(s.gst)}</TableCell>
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
                  {filteredSettlements.map((s) => (
                    <ListItem
                      key={s.id}
                      onClick={() => openSettlement(s)}
                      leading={<IconTile icon={Building2} tone={isPayable(s) ? 'amber' : 'green'} />}
                      title={s.garageName}
                      subtitle={s.number}
                      meta={`Quote ${formatINRWhole(s.gross)} · Fee ${formatINRWhole(s.fee)} · GST ${formatINRWhole(s.gst)}`}
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

              {settlementsTotal > settlements.length && (
                <p className="px-1 text-xs text-navy-500">
                  Showing the latest {settlements.length} of {settlementsTotal} settlements.
                </p>
              )}
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
          {ledger.length > 0 && (
            <FilterChips ariaLabel="Ledger account" value={accountFilter} onChange={setAccountFilter} options={accountOptions} />
          )}

          {loading && ledger.length === 0 ? (
            <ListSkeleton />
          ) : errors.ledger && ledger.length === 0 ? (
            <ErrorState title="Ledger unavailable" error={errors.ledger} onRetry={loadData} />
          ) : filteredLedger.length === 0 ? (
            <EmptyState icon={FileText} title="No ledger entries yet" description="Entries appear once payments and settlements are recorded." />
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
                    {filteredLedger.map((l) => (
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
                  {filteredLedger.map((l) => {
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
                <BreakdownRow
                  label={`GST on fee${selectedSettlement.gstRate !== undefined ? ` (${selectedSettlement.gstRate}%)` : ''}`}
                  value={`− ${formatINR(selectedSettlement.gst)}`}
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
