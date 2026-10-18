'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { PaymentDto, InvoiceDto } from '@/types/finance';
import { ChevronRight, Receipt } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Alert } from '@/components/ui/Alert';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { IconTile } from '@/components/ui/ListItem';
import { formatDateTime, formatINR } from '@/lib/format';
import { DetailRow, paymentMethodLabel, paymentPurposeLabel } from '@/app/customer/_lib/customer-ui';
import { advancePurposeLabel } from '@/components/booking/advancePayment';

export default function CustomerPaymentDetailPage() {
  const params = useParams();
  const paymentId = params.id as string;

  const [payment, setPayment] = useState<PaymentDto | null>(null);
  const [invoice, setInvoice] = useState<InvoiceDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await apiFetch<PaymentDto>(`/customer/payments/${paymentId}`);
        if (res.success && res.data) {
          setPayment(res.data);
          if (res.data.status === 'Paid') {
            const invRes = await apiFetch<InvoiceDto>(`/customer/invoices/by-payment/${paymentId}`);
            if (invRes.success && invRes.data) {
              setInvoice(invRes.data);
            }
          }
        } else {
          setErrorMsg(res.message || 'Payment not found or unauthorized.');
        }
      } catch (err) {
        console.error('Error fetching payment:', err);
        setErrorMsg('Unable to retrieve payment record.');
      } finally {
        setLoading(false);
      }
    }
    if (paymentId) {
      loadData();
    }
  }, [paymentId, reloadKey]);

  if (loading && !payment) {
    return (
      <div className="mx-auto max-w-xl space-y-5" aria-busy="true" aria-label="Loading payment">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (errorMsg || !payment) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title="Payment" backHref="/customer/payments" backLabel="Payments" />
        <ErrorState
          title="Could not load this payment"
          error={errorMsg}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </div>
    );
  }

  const money = (amount: number | null | undefined) => formatINR(amount, payment.currency || 'INR');
  const isPaid = payment.status === 'Paid';
  const method = paymentMethodLabel(payment.paymentMethod);

  return (
    <div className="mx-auto max-w-xl space-y-5 sm:space-y-6">
      <PageHeader
        title="Payment receipt"
        backHref="/customer/payments"
        backLabel="Payments"
        eyebrow={<span className="font-mono text-xs text-navy-500">{payment.paymentNumber}</span>}
      />

      {/* Receipt */}
      <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-card">
        <div className="border-b border-dashed border-surface-300 px-4 py-6 text-center sm:px-5">
          <div className="text-sm text-navy-500">{advancePurposeLabel(payment.purpose) ?? paymentPurposeLabel(payment.purpose)}</div>
          <div className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-navy-900">{money(payment.amount)}</div>
          <div className="mt-2 flex justify-center">
            <StatusBadge status={payment.status} />
          </div>
        </div>

        <dl className="divide-y divide-surface-200/80 px-4 sm:px-5">
          <DetailRow label="Reference" mono>
            {payment.paymentNumber}
          </DetailRow>
          {payment.paidAtUtc && <DetailRow label="Paid on">{formatDateTime(payment.paidAtUtc)}</DetailRow>}
          <DetailRow label="Created">{formatDateTime(payment.createdAtUtc)}</DetailRow>
          {method && <DetailRow label="Method">{method}</DetailRow>}
          {payment.gatewayProvider && <DetailRow label="Processed by">{payment.gatewayProvider}</DetailRow>}
          {payment.gatewayPaymentId && (
            <DetailRow label="Transaction ID" mono>
              <span className="break-all">{payment.gatewayPaymentId}</span>
            </DetailRow>
          )}
          {payment.gatewayOrderId && (
            <DetailRow label="Order ID" mono>
              <span className="break-all">{payment.gatewayOrderId}</span>
            </DetailRow>
          )}
          {payment.refundedAmount > 0 && (
            <DetailRow label="Refunded" strong>
              {money(payment.refundedAmount)}
            </DetailRow>
          )}
        </dl>
      </div>

      {payment.refundReason && payment.refundedAmount > 0 && (
        <Alert type="info" title="Refund">
          {payment.refundReason}
        </Alert>
      )}

      {payment.failureReason && (
        <Alert type="error" title="Payment failed">
          {payment.failureReason}
        </Alert>
      )}

      {/* Linked invoice */}
      {invoice ? (
        <Link
          href={`/customer/invoices/${invoice.id}`}
          className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-surface-200 bg-white px-4 py-3 shadow-card transition hover:bg-surface-50 active:bg-surface-100"
        >
          <IconTile icon={Receipt} tone="green" />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-navy-900">{advancePurposeLabel(payment.purpose) ? 'View receipt' : 'View invoice'}</div>
            <div className="truncate font-mono text-xs text-navy-500">{invoice.invoiceNumber}</div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-surface-400" aria-hidden="true" />
        </Link>
      ) : isPaid ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-surface-300 bg-white px-4 py-3">
          <IconTile icon={Receipt} tone="neutral" />
          <div className="min-w-0 flex-1 text-sm text-navy-600">
            Your receipt is not ready yet.{' '}
            <Link href="/customer/invoices" className="font-medium text-electric-600 hover:underline">
              See all invoices
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
