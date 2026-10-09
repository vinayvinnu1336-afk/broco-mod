'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PaymentDto } from '@/types/finance';
import { CreditCard, IndianRupee, RotateCcw, Search } from 'lucide-react';
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
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { formatDate, formatDateTime, formatINR, formatINRWhole, humanize } from '@/lib/format';

// The API returns a paged object ({ items, totalCount }); a plain array is also accepted.
function toList(data: unknown): { items: PaymentDto[]; total: number } {
  if (Array.isArray(data)) return { items: data as PaymentDto[], total: data.length };
  if (data && typeof data === 'object') {
    const obj = data as { items?: unknown; totalCount?: unknown };
    if (Array.isArray(obj.items)) {
      const total = typeof obj.totalCount === 'number' ? obj.totalCount : obj.items.length;
      return { items: obj.items as PaymentDto[], total };
    }
  }
  return { items: [], total: 0 };
}

const METHOD_LABELS: Record<string, string> = {
  UPI: 'UPI',
  CARD: 'Card',
  NETBANKING: 'Net banking',
  WALLET: 'Wallet',
  BANKTRANSFER: 'Bank transfer',
  TESTPROVIDER: 'Test payment',
};

function methodLabel(method?: string | null): string {
  if (!method) return '';
  return METHOD_LABELS[method.replace(/[\s_]/g, '').toUpperCase()] ?? humanize(method);
}

const refundableAmount = (p: PaymentDto) => Number(p.amount ?? 0) - Number(p.refundedAmount ?? 0);
const canRefund = (p: PaymentDto) =>
  (p.status === 'Paid' || p.status === 'PartiallyRefunded') && refundableAmount(p) > 0;

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PARTIALLYREFUNDED', label: 'Part refunded' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'FAILED', label: 'Failed' },
];

const statusKey = (status: string) => String(status ?? '').replace(/[\s_]/g, '').toUpperCase();

export default function AdminPaymentsPage() {
  const toast = useToast();

  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Payment sheet (details / refund)
  const [selectedPayment, setSelectedPayment] = useState<PaymentDto | null>(null);
  const [sheetMode, setSheetMode] = useState<'details' | 'refund'>('details');
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundReason, setRefundReason] = useState<string>('');
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<PaymentDto[]>('/admin/finance/payments');
    if (res.success && res.data) {
      const { items, total } = toList(res.data);
      setPayments(items);
      setTotalCount(total);
      setLoadError(null);
    } else {
      setLoadError(res.message || 'Could not load payments.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const openPayment = (p: PaymentDto, mode: 'details' | 'refund') => {
    setSelectedPayment(p);
    setSheetMode(mode);
    setRefundAmount(refundableAmount(p).toString());
    setRefundReason('');
    setRefundError(null);
  };

  const closeSheet = useCallback(() => {
    if (refunding) return;
    setSelectedPayment(null);
  }, [refunding]);

  const handleRefundSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedPayment) return;

    const amt = parseFloat(refundAmount);
    if (isNaN(amt) || amt <= 0) {
      setRefundError('Enter a refund amount greater than ₹0.');
      return;
    }

    const maxRefundable = refundableAmount(selectedPayment);
    if (amt > maxRefundable) {
      setRefundError(`You can refund at most ${formatINR(maxRefundable)} on this payment.`);
      return;
    }

    if (!refundReason.trim()) {
      setRefundError('Add a reason for the refund. It is kept with the payment record.');
      return;
    }

    setRefunding(true);
    setRefundError(null);

    const res = await apiFetch<PaymentDto>(`/admin/finance/payments/${selectedPayment.id}/refund`, {
      method: 'POST',
      body: JSON.stringify({
        amount: amt,
        reason: refundReason.trim(),
      }),
    });

    setRefunding(false);

    if (res.success && res.data) {
      toast.success('Refund processed', `${formatINR(amt)} on ${selectedPayment.paymentNumber}`);
      setSelectedPayment(null);
      setRefundAmount('');
      setRefundReason('');
      loadPayments();
    } else {
      setRefundError(res.message || 'The refund could not be processed. Please try again.');
    }
  };

  const counts = useMemo(() => {
    const map: Record<string, number> = { ALL: payments.length };
    payments.forEach((p) => {
      const key = statusKey(p.status);
      map[key] = (map[key] ?? 0) + 1;
    });
    return map;
  }, [payments]);

  const filteredPayments = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return payments.filter((p) => {
      const matchesStatus = filterStatus === 'ALL' || statusKey(p.status) === filterStatus;
      const matchesSearch =
        !q ||
        (p.paymentNumber ?? '').toLowerCase().includes(q) ||
        (p.gatewayPaymentId ?? '').toLowerCase().includes(q) ||
        (p.gatewayOrderId ?? '').toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [payments, filterStatus, searchTerm]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Payments"
        description="Customer payments received through the payment gateway. Refund a payment from here."
        backHref="/admin/finance"
        backLabel="Finance"
      />

      <div className="space-y-3">
        <Input
          type="search"
          aria-label="Search payments"
          placeholder="Search by payment number or gateway reference"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
        />
        <FilterChips
          ariaLabel="Payment status"
          value={filterStatus}
          onChange={setFilterStatus}
          options={STATUS_FILTERS.map((f) => ({ ...f, count: loading ? undefined : counts[f.value] ?? 0 }))}
        />
      </div>

      {loading && payments.length === 0 ? (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : loadError && payments.length === 0 ? (
        <ErrorState title="Payments unavailable" error={loadError} onRetry={loadPayments} />
      ) : filteredPayments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={payments.length === 0 ? 'No payments yet' : 'No matching payments'}
          description={
            payments.length === 0
              ? 'Payments appear here once customers pay for an accepted quote.'
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
                  <TableHead>Payment</TableHead>
                  <TableHead>For</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => openPayment(p, 'details')}
                        className="text-left font-semibold text-navy-900 hover:text-electric-600"
                      >
                        {p.paymentNumber}
                      </button>
                      <div className="max-w-[14rem] truncate text-xs text-navy-500">
                        {p.gatewayPaymentId || p.gatewayOrderId || 'No gateway reference'}
                      </div>
                    </TableCell>
                    <TableCell className="text-navy-700">{humanize(p.purpose)}</TableCell>
                    <TableCell className="text-navy-700">
                      {methodLabel(p.paymentMethod) || '—'}
                      {p.gatewayProvider && <div className="text-xs text-navy-500">{p.gatewayProvider}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <div className="font-semibold text-navy-900">{formatINR(p.amount, p.currency)}</div>
                      {Number(p.refundedAmount) > 0 && (
                        <div className="text-xs text-navy-500">Refunded {formatINR(p.refundedAmount, p.currency)}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-navy-500">{formatDate(p.createdAtUtc)}</TableCell>
                    <TableCell className="text-right">
                      {canRefund(p) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openPayment(p, 'refund')}
                          leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                        >
                          Refund
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Phone list */}
          <div className="md:hidden">
            <ListGroup>
              {filteredPayments.map((p) => (
                <ListItem
                  key={p.id}
                  onClick={() => openPayment(p, 'details')}
                  leading={<IconTile icon={IndianRupee} tone="neutral" />}
                  title={p.paymentNumber}
                  subtitle={[humanize(p.purpose), methodLabel(p.paymentMethod)].filter(Boolean).join(' · ')}
                  meta={
                    Number(p.refundedAmount) > 0
                      ? `${formatDate(p.createdAtUtc)} · Refunded ${formatINRWhole(p.refundedAmount)}`
                      : formatDate(p.createdAtUtc)
                  }
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums text-navy-900">{formatINRWhole(p.amount)}</span>
                      <StatusBadge status={p.status} />
                    </div>
                  }
                />
              ))}
            </ListGroup>
          </div>

          {totalCount > payments.length && (
            <p className="px-1 text-xs text-navy-500">
              Showing the latest {payments.length} of {totalCount} payments.
            </p>
          )}
        </>
      )}

      {/* Payment sheet */}
      <Modal
        isOpen={!!selectedPayment}
        onClose={closeSheet}
        size="sm"
        title={sheetMode === 'refund' ? 'Refund payment' : 'Payment details'}
        description={selectedPayment ? selectedPayment.paymentNumber : undefined}
        footer={
          selectedPayment &&
          (sheetMode === 'refund' ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <Button variant="outline" onClick={closeSheet} disabled={refunding} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" form="refund-form" variant="danger" isLoading={refunding} className="w-full sm:w-auto">
                Refund {(() => {
                  const amt = parseFloat(refundAmount);
                  return !isNaN(amt) && amt > 0 ? formatINR(amt) : '';
                })()}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <Button variant="outline" onClick={closeSheet} className="w-full sm:w-auto">
                Close
              </Button>
              {canRefund(selectedPayment) && (
                <Button
                  variant="outline"
                  onClick={() => setSheetMode('refund')}
                  leftIcon={<RotateCcw className="h-4 w-4" />}
                  className="w-full sm:w-auto"
                >
                  Refund
                </Button>
              )}
            </div>
          ))
        }
      >
        {selectedPayment && (
          <div className="space-y-5">
            <Card className="p-4 shadow-none">
              <dl className="space-y-2.5 text-sm">
                <DetailRow label="Amount paid" value={formatINR(selectedPayment.amount, selectedPayment.currency)} strong />
                {Number(selectedPayment.refundedAmount) > 0 && (
                  <DetailRow label="Already refunded" value={formatINR(selectedPayment.refundedAmount, selectedPayment.currency)} />
                )}
                <DetailRow
                  label="Can still be refunded"
                  value={formatINR(Math.max(0, refundableAmount(selectedPayment)), selectedPayment.currency)}
                />
              </dl>
            </Card>

            {sheetMode === 'details' ? (
              <dl className="space-y-2 text-sm">
                <DetailRow label="Status" value={<StatusBadge status={selectedPayment.status} />} />
                <DetailRow label="For" value={humanize(selectedPayment.purpose)} />
                {selectedPayment.paymentMethod && <DetailRow label="Method" value={methodLabel(selectedPayment.paymentMethod)} />}
                {selectedPayment.gatewayProvider && <DetailRow label="Gateway" value={selectedPayment.gatewayProvider} />}
                {selectedPayment.gatewayPaymentId && <DetailRow label="Gateway payment ID" value={selectedPayment.gatewayPaymentId} />}
                {selectedPayment.gatewayOrderId && <DetailRow label="Gateway order ID" value={selectedPayment.gatewayOrderId} />}
                <DetailRow label="Created" value={formatDateTime(selectedPayment.createdAtUtc)} />
                {selectedPayment.paidAtUtc && <DetailRow label="Paid" value={formatDateTime(selectedPayment.paidAtUtc)} />}
                {selectedPayment.refundReason && <DetailRow label="Refund reason" value={selectedPayment.refundReason} />}
                {selectedPayment.failureReason && <DetailRow label="Failure reason" value={selectedPayment.failureReason} />}
              </dl>
            ) : (
              <form id="refund-form" onSubmit={handleRefundSubmit} className="space-y-4">
                <Input
                  id="refund-amount"
                  label="Refund amount (₹)"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  helperText={`Up to ${formatINR(refundableAmount(selectedPayment))}`}
                  required
                />
                <Textarea
                  id="refund-reason"
                  label="Reason"
                  rows={3}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Job cancelled before work started"
                  required
                />
                {refundError && (
                  <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {refundError}
                  </p>
                )}
              </form>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function DetailRow({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className={`shrink-0 ${strong ? 'font-semibold text-navy-900' : 'text-navy-500'}`}>{label}</dt>
      <dd
        className={`min-w-0 break-words text-right tabular-nums ${
          strong ? 'text-base font-bold text-navy-900' : 'font-medium text-navy-800'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
