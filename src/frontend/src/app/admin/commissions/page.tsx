'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Building2, CheckCircle2, Clock, Percent, Wallet } from 'lucide-react';
import { formatDate, formatDateTime, formatINR, formatINRShort, formatINRWhole, formatRelative } from '@/lib/format';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterChips } from '@/components/ui/FilterChips';
import { Input } from '@/components/ui/Input';
import { ListGroup, ListItem } from '@/components/ui/ListItem';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { DetailRow, FormError } from '@/components/admin/FormControls';
import { adminCatalogueApi, apiError, type Commission, type CommissionOverview } from '@/components/admin/catalogueAdminApi';

type Filter = 'Due' | 'Overdue' | 'Paid' | 'Waived' | 'All';
type Mode = 'view' | 'receive' | 'waive';

const PAGE_SIZE = 20;
const METHODS = ['UPI', 'Bank transfer', 'Cash', 'Cheque'];

function commissionStatus(c: Commission): { label: string; variant: BadgeVariant } {
  const s = c.status.toLowerCase();
  if (s === 'paid') return { label: 'Paid', variant: 'green' };
  if (s === 'waived') return { label: 'Waived', variant: 'neutral' };
  if (c.isOverdue) return { label: 'Overdue', variant: 'red' };
  return { label: 'Due', variant: 'amber' };
}

const isOpen = (c: Commission) => c.status.toLowerCase() === 'due';

function dueText(c: Commission): string {
  if (c.status.toLowerCase() === 'paid') return c.paidAtUtc ? `Paid ${formatDate(c.paidAtUtc)}` : 'Paid';
  if (c.status.toLowerCase() === 'waived') return 'Waived';
  return c.isOverdue ? `Overdue since ${formatDate(c.dueAtUtc)}` : `Due ${formatDate(c.dueAtUtc)}`;
}

export default function AdminCommissionsPage() {
  const toast = useToast();
  const [overview, setOverview] = useState<CommissionOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>('Due');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Commission[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const listRequest = useRef(0);

  const [selected, setSelected] = useState<Commission | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  const [reference, setReference] = useState('');
  const [method, setMethod] = useState(METHODS[0]);
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmWaive, setConfirmWaive] = useState(false);
  const [working, setWorking] = useState(false);

  const loadOverview = useCallback(async () => {
    const res = await adminCatalogueApi.commissionOverview();
    if (res.success && res.data) {
      setOverview(res.data);
      setOverviewError(null);
    } else {
      setOverviewError(res.message || 'Could not load the commission summary.');
    }
  }, []);

  const loadList = useCallback(async (f: Filter, p: number) => {
    const requestId = ++listRequest.current;
    setLoading(true);
    const res = await adminCatalogueApi.commissions({ status: f === 'All' ? undefined : f, page: p, pageSize: PAGE_SIZE });
    if (requestId !== listRequest.current) return;
    if (res.success && res.data) {
      setItems(res.data.items ?? []);
      setTotalCount(res.data.totalCount ?? 0);
      setListError(null);
    } else {
      setListError(res.message || 'Could not load commission dues.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadList(filter, page);
  }, [filter, page, loadList]);

  const open = (c: Commission) => {
    setSelected(c);
    setMode('view');
    setReference('');
    setMethod(METHODS[0]);
    setReason('');
    setFieldError(null);
    setActionError(null);
  };

  const close = () => {
    if (working) return;
    setSelected(null);
  };

  const afterAction = (updated: Commission, title: string) => {
    toast.success(title, `${updated.garageName} · ${formatINR(updated.totalDue)}`);
    setSelected(null);
    loadOverview();
    loadList(filter, page);
  };

  const submitReceived = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selected) return;
    if (reference.trim().length < 2) {
      setFieldError('Enter the payment reference (UTR, UPI transaction ID or receipt number).');
      return;
    }
    setFieldError(null);
    setWorking(true);
    setActionError(null);
    const res = await adminCatalogueApi.markCommissionReceived(selected.id, { reference: reference.trim(), method });
    setWorking(false);
    if (res.success && res.data) afterAction(res.data, 'Marked as received');
    else setActionError(apiError(res, 'Could not mark this commission as received.'));
  };

  const requestWaive = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (reason.trim().length < 3) {
      setFieldError('Explain why this commission is being waived.');
      return;
    }
    setFieldError(null);
    setConfirmWaive(true);
  };

  const submitWaive = async () => {
    if (!selected) return;
    setWorking(true);
    setActionError(null);
    const res = await adminCatalogueApi.waiveCommission(selected.id, reason.trim());
    setWorking(false);
    setConfirmWaive(false);
    if (res.success && res.data) afterAction(res.data, 'Commission waived');
    else setActionError(apiError(res, 'Could not waive this commission.'));
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const sheetFooter = !selected ? null : mode === 'receive' ? (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="outline" onClick={() => setMode('view')} disabled={working} className="w-full sm:w-auto">
        Back
      </Button>
      <Button type="submit" form="receive-form" isLoading={working} className="w-full sm:w-auto">
        Confirm received
      </Button>
    </div>
  ) : mode === 'waive' ? (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="outline" onClick={() => setMode('view')} disabled={working} className="w-full sm:w-auto">
        Back
      </Button>
      <Button type="submit" form="waive-form" variant="danger" className="w-full sm:w-auto">
        Waive commission
      </Button>
    </div>
  ) : isOpen(selected) ? (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        variant="outline"
        onClick={() => {
          setMode('waive');
          setFieldError(null);
        }}
        className="w-full sm:w-auto"
      >
        Waive
      </Button>
      <Button
        onClick={() => {
          setMode('receive');
          setFieldError(null);
        }}
        leftIcon={<CheckCircle2 className="h-4 w-4" />}
        className="w-full sm:w-auto"
      >
        Mark received
      </Button>
    </div>
  ) : (
    <Button variant="outline" onClick={close} className="w-full sm:ml-auto sm:flex sm:w-auto">
      Close
    </Button>
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Commissions"
        description="Garages owe BroCo a commission plus GST on each job's service value after handing the car back. Track what's due and record payments."
      />

      {/* Overview */}
      {!overview && !overviewError ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[104px] rounded-2xl" />
          ))}
        </div>
      ) : overviewError && !overview ? (
        <ErrorState title="Summary unavailable" error={overviewError} onRetry={loadOverview} />
      ) : overview ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Outstanding"
            value={formatINRShort(overview.outstandingAmount)}
            icon={Wallet}
            tone="amber"
            hint={`${overview.outstandingCount} ${overview.outstandingCount === 1 ? 'due' : 'dues'}`}
          />
          <StatCard
            label="Overdue"
            value={formatINRShort(overview.overdueAmount)}
            icon={AlertTriangle}
            tone="red"
            hint={`${overview.overdueCount} past the due date`}
          />
          <StatCard label="Collected" value={formatINRShort(overview.collectedAmount)} icon={CheckCircle2} tone="green" hint="Commission received" />
          <StatCard
            label="Garages with overdue"
            value={overview.garagesWithOverdue}
            icon={Building2}
            tone={overview.garagesWithOverdue > 0 ? 'red' : 'neutral'}
            hint="May be blocked from new jobs"
          />
        </div>
      ) : null}

      <FilterChips
        ariaLabel="Commission status"
        value={filter}
        onChange={(v) => {
          setFilter(v as Filter);
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

      {loading && items.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : listError && items.length === 0 ? (
        <ErrorState title="Commissions unavailable" error={listError} onRetry={() => loadList(filter, page)} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Percent}
          title={filter === 'All' ? 'No commissions yet' : `No ${filter.toLowerCase()} commissions`}
          description="A commission is raised for each job once the garage hands the car back to the customer."
        />
      ) : (
        <div className={`space-y-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {/* Desktop */}
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Garage</TableHead>
                  <TableHead>Job · car</TableHead>
                  <TableHead className="text-right">Service value</TableHead>
                  <TableHead className="text-right">Commission + GST</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Reminders</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => {
                  const st = commissionStatus(c);
                  return (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => open(c)}>
                      <TableCell>
                        <button type="button" className="text-left font-semibold text-navy-900 hover:text-electric-700" onClick={() => open(c)}>
                          {c.garageName}
                        </button>
                        <div className="text-xs text-navy-400">{c.commissionNumber}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-navy-800">{c.jobNumber}</div>
                        <div className="max-w-[220px] truncate text-xs text-navy-400">{c.vehicleSummary}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatINRWhole(c.serviceValue)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatINR(c.totalDue)}</TableCell>
                      <TableCell className={`whitespace-nowrap text-xs ${c.isOverdue && isOpen(c) ? 'font-semibold text-red-600' : 'text-navy-600'}`}>
                        {dueText(c)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-navy-600">{c.remindersSent}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Phones and tablets */}
          <ListGroup className="lg:hidden">
            {items.map((c) => {
              const st = commissionStatus(c);
              return (
                <ListItem
                  key={c.id}
                  onClick={() => open(c)}
                  title={c.garageName}
                  subtitle={[c.jobNumber, c.vehicleSummary].filter(Boolean).join(' · ')}
                  meta={
                    <span className={c.isOverdue && isOpen(c) ? 'font-medium text-red-600' : ''}>
                      {dueText(c)} · Service {formatINRWhole(c.serviceValue)}
                      {c.remindersSent > 0 ? ` · ${c.remindersSent} reminder${c.remindersSent === 1 ? '' : 's'}` : ''}
                    </span>
                  }
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums text-navy-900">{formatINR(c.totalDue)}</span>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </div>
                  }
                />
              );
            })}
          </ListGroup>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalCount} pageSize={PAGE_SIZE} />
        </div>
      )}

      {/* Detail sheet */}
      <Modal
        isOpen={Boolean(selected)}
        onClose={close}
        title={selected ? selected.garageName : ''}
        description={selected ? `${selected.commissionNumber} · Job ${selected.jobNumber}` : undefined}
        footer={sheetFooter}
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={commissionStatus(selected).variant}>{commissionStatus(selected).label}</Badge>
              <span className="text-sm text-navy-500">{dueText(selected)}</span>
            </div>
            <FormError message={actionError} />

            {mode === 'view' && (
              <>
                <section>
                  <h4 className="text-sm font-semibold text-navy-900">Job</h4>
                  <div className="mt-1 divide-y divide-surface-200/80">
                    <DetailRow label="Car" value={selected.vehicleSummary || '—'} />
                    <DetailRow label="Request" value={selected.requestNumber || '—'} />
                    <DetailRow label="Raised" value={formatDateTime(selected.createdAtUtc)} />
                  </div>
                </section>

                <section>
                  <h4 className="text-sm font-semibold text-navy-900">Breakdown</h4>
                  <div className="mt-1 divide-y divide-surface-200/80">
                    <DetailRow label="Service value" value={formatINR(selected.serviceValue)} />
                    <DetailRow label="Advance collected by BroCo" value={formatINR(selected.advanceCollectedByPlatform)} />
                    <DetailRow label="Balance collected by garage" value={formatINR(selected.balanceCollectedByGarage)} />
                    <DetailRow label={`Commission (${Number(selected.commissionPercentage)}%)`} value={formatINR(selected.commissionAmount)} />
                    <DetailRow
                      label={`GST on commission${selected.taxPercentage != null ? ` (${Number(selected.taxPercentage)}%)` : ''}`}
                      value={formatINR(selected.taxAmount)}
                    />
                    <DetailRow label="Total due from garage" value={formatINR(selected.totalDue)} strong />
                  </div>
                </section>

                <section>
                  <h4 className="text-sm font-semibold text-navy-900">Collection</h4>
                  <div className="mt-1 divide-y divide-surface-200/80">
                    <DetailRow label="Due date" value={formatDate(selected.dueAtUtc)} />
                    <DetailRow
                      label="Reminders sent"
                      value={
                        selected.remindersSent > 0
                          ? `${selected.remindersSent}${selected.lastReminderAtUtc ? ` · last ${formatRelative(selected.lastReminderAtUtc)}` : ''}`
                          : 'None'
                      }
                    />
                    {selected.paidAtUtc && <DetailRow label="Paid on" value={formatDateTime(selected.paidAtUtc)} />}
                    {selected.settledVia && <DetailRow label="Settled via" value={selected.settledVia} />}
                    {selected.paymentReference && <DetailRow label="Reference" value={selected.paymentReference} />}
                    {selected.waiverReason && <DetailRow label="Waiver reason" value={selected.waiverReason} />}
                  </div>
                </section>
              </>
            )}

            {mode === 'receive' && (
              <form id="receive-form" onSubmit={submitReceived} className="space-y-4" noValidate>
                <div className="rounded-xl bg-surface-50 px-3.5 py-3 text-sm text-navy-700">
                  Record that {selected.garageName} paid <span className="font-semibold text-navy-900">{formatINR(selected.totalDue)}</span> outside
                  the app.
                </div>
                <Select label="Payment method" value={method} onChange={(e) => setMethod(e.target.value)} options={METHODS.map((m) => ({ value: m, label: m }))} />
                <Input
                  label="Payment reference"
                  required
                  autoFocus
                  placeholder="UTR, UPI transaction ID or receipt no."
                  value={reference}
                  maxLength={200}
                  onChange={(e) => setReference(e.target.value)}
                  error={fieldError ?? undefined}
                />
              </form>
            )}

            {mode === 'waive' && (
              <form id="waive-form" onSubmit={requestWaive} className="space-y-4" noValidate>
                <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Waiving cancels the {formatINR(selected.totalDue)} due. The garage will not be asked to pay it.</span>
                </div>
                <Textarea
                  label="Reason"
                  required
                  rows={3}
                  maxLength={1000}
                  placeholder="e.g. Job cancelled after inspection, goodwill for a new partner garage"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  error={fieldError ?? undefined}
                />
              </form>
            )}
          </div>
        )}
      </Modal>

      <ConfirmationDialog
        isOpen={confirmWaive}
        onClose={() => !working && setConfirmWaive(false)}
        onConfirm={submitWaive}
        isLoading={working}
        variant="danger"
        title="Waive this commission?"
        message={selected ? `${selected.garageName} will no longer owe ${formatINR(selected.totalDue)} for job ${selected.jobNumber}. This can't be undone.` : ''}
        confirmText="Waive commission"
      />
    </div>
  );
}
