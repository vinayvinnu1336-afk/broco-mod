'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PaymentDto } from '@/types/finance';
import { ChevronLeft, ChevronRight, CreditCard, IndianRupee, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterBar } from '@/components/ui/FilterBar';
import { Input } from '@/components/ui/Input';
import { IconTile, ListGroup, ListItem } from '@/components/ui/ListItem';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { formatDate, formatDateTime, formatINR, formatINRWhole, humanize } from '@/lib/format';
import { dateRangeQuery, toQueryString, useUrlFilters } from '@/lib/useUrlFilters';

// The API returns a paged object ({ items, page, totalCount, totalPages }); a plain array is also accepted.
function toPage(data: unknown): { items: PaymentDto[]; total: number; page: number; totalPages: number } {
  if (Array.isArray(data)) return { items: data as PaymentDto[], total: data.length, page: 1, totalPages: 1 };
  if (data && typeof data === 'object') {
    const obj = data as { items?: unknown; totalCount?: unknown; page?: unknown; totalPages?: unknown };
    if (Array.isArray(obj.items)) {
      const total = typeof obj.totalCount === 'number' ? obj.totalCount : obj.items.length;
      return {
        items: obj.items as PaymentDto[],
        total,
        page: typeof obj.page === 'number' ? obj.page : 1,
        totalPages: typeof obj.totalPages === 'number' ? obj.totalPages : 1,
      };
    }
  }
  return { items: [], total: 0, page: 1, totalPages: 1 };
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
// Garage commission payments are settled or waived from Commissions, never refunded here.
const canRefund = (p: PaymentDto) =>
  (p.status === 'Paid' || p.status === 'PartiallyRefunded') && p.purpose !== 'GarageCommission' && refundableAmount(p) > 0;

// Values are PaymentStatus names (sent to the API as they are).
const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Pending', label: 'Pending' },
  { value: 'PartiallyRefunded', label: 'Part refunded' },
  { value: 'Refunded', label: 'Refunded' },
  { value: 'Failed', label: 'Failed' },
];

// PaymentPurpose / PaymentMethod names.
const PURPOSE_OPTIONS = [
  { value: 'BookingAdvance', label: 'Booking advance' },
  { value: 'GarageCommission', label: 'Garage commission' },
  { value: 'ServiceQuotation', label: 'Quoted service' },
  { value: 'AdditionalWork', label: 'Extra work' },
  { value: 'Other', label: 'Other' },
];

const METHOD_OPTIONS = [
  { value: 'Upi', label: 'UPI' },
  { value: 'Card', label: 'Card' },
  { value: 'NetBanking', label: 'Net banking' },
  { value: 'Wallet', label: 'Wallet' },
  { value: 'BankTransfer', label: 'Bank transfer' },
  { value: 'TestProvider', label: 'Test payment' },
];

const FILTER_DEFAULTS = { q: '', status: '', purpose: '', method: '', range: '', from: '', to: '', size: '25' };

export default function AdminPaymentsPage() {
  return (
    <Suspense fallback={<PaymentsSkeleton />}>
      <AdminPayments />
    </Suspense>
  );
}

function PaymentsSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-16 rounded-2xl" />
      ))}
    </div>
  );
}

function AdminPayments() {
  const toast = useToast();
  const filters = useUrlFilters(FILTER_DEFAULTS);
  const { values: f, page: urlPage } = filters;

  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const pageSize = [25, 50, 100].includes(Number(f.size)) ? Number(f.size) : 25;
  const latest = useRef(0);

  // Payment sheet (details / refund)
  const [selectedPayment, setSelectedPayment] = useState<PaymentDto | null>(null);
  const [sheetMode, setSheetMode] = useState<'details' | 'refund'>('details');
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundReason, setRefundReason] = useState<string>('');
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  const query = useMemo(
    () =>
      toQueryString({
        page: urlPage,
        pageSize,
        search: f.q,
        status: f.status,
        purpose: f.purpose,
        method: f.method,
        ...dateRangeQuery(f, ['fromDate', 'toDate']),
      }),
    [urlPage, pageSize, f]
  );

  const loadPayments = useCallback(async (qs: string) => {
    const id = ++latest.current;
    setLoading(true);
    const res = await apiFetch<unknown>(`/admin/finance/payments${qs}`);
    if (id !== latest.current) return; // a newer filter change is already loading
    if (res.success && res.data) {
      const data = toPage(res.data);
      setPayments(data.items);
      setTotalCount(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setLoadError(null);
    } else {
      setLoadError(res.message || 'Could not load payments.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPayments(query);
  }, [loadPayments, query]);

  const goToPage = (p: number) => {
    filters.setPage(p);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
      loadPayments(query);
    } else {
      setRefundError(res.message || 'The refund could not be processed. Please try again.');
    }
  };

  const safeTotalPages = Math.max(1, totalPages);
  const anyFilter = Object.keys(FILTER_DEFAULTS).some((k) => k !== 'size' && filters.isActive(k as keyof typeof FILTER_DEFAULTS));

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Payments"
        description="Payments received through the payment gateway: customer booking advances and garage commission. Refund a customer payment from here."
        backHref="/admin/finance"
        backLabel="Finance"
      />

      <FilterBar
        filters={filters}
        searchKey="q"
        searchPlaceholder="Payment no., garage or request"
        searchLabel="Search payments"
        status={{ key: 'status', options: STATUS_FILTERS, ariaLabel: 'Payment status' }}
        fields={[
          { type: 'select', key: 'purpose', label: 'For', allLabel: 'All purposes', options: PURPOSE_OPTIONS },
          { type: 'select', key: 'method', label: 'Method', allLabel: 'All methods', options: METHOD_OPTIONS },
          { type: 'dateRange', label: 'Created' },
        ]}
        summary={loading ? 'Loading…' : `${totalCount} ${totalCount === 1 ? 'payment' : 'payments'}`}
        trailing={
          <label className="flex items-center gap-2">
            Per page
            <select
              value={pageSize}
              onChange={(e) => filters.set({ size: e.target.value })}
              className="min-h-[36px] rounded-lg border border-surface-200 bg-white px-2 text-sm text-navy-900 focus:border-electric-600 focus:outline-none focus:ring-2 focus:ring-electric-600/20"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        }
      />

      {loading && payments.length === 0 ? (
        <PaymentsSkeleton />
      ) : loadError && payments.length === 0 ? (
        <ErrorState title="Payments unavailable" error={loadError} onRetry={() => loadPayments(query)} />
      ) : payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={anyFilter ? 'No matching payments' : 'No payments yet'}
          description={
            anyFilter
              ? 'No payments match these filters.'
              : 'Payments appear here once customers pay for an accepted quote.'
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
                {payments.map((p) => (
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
              {payments.map((p) => (
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

          {safeTotalPages > 1 && (
            <div className="flex items-center gap-3 md:hidden">
              <Button
                variant="outline"
                className="flex-1"
                disabled={page <= 1 || loading}
                onClick={() => goToPage(page - 1)}
                leftIcon={<ChevronLeft className="h-4 w-4" />}
              >
                Previous
              </Button>
              <span className="shrink-0 text-sm tabular-nums text-navy-500">
                {page} / {safeTotalPages}
              </span>
              <Button
                variant="outline"
                className="flex-1"
                disabled={page >= safeTotalPages || loading}
                onClick={() => goToPage(page + 1)}
                rightIcon={<ChevronRight className="h-4 w-4" />}
              >
                Next
              </Button>
            </div>
          )}
          <div className="hidden md:block">
            <Pagination
              currentPage={page}
              totalPages={safeTotalPages}
              totalItems={totalCount}
              pageSize={pageSize}
              onPageChange={goToPage}
            />
          </div>
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
                  // Own key: otherwise React reuses this button as the refund form's submit button mid-click,
                  // which submits the empty form straight away.
                  key="start-refund"
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
