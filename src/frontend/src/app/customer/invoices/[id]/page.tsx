'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { InvoiceDto } from '@/types/finance';
import { Printer } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate, formatINR, humanize } from '@/lib/format';
import { DetailRow } from '@/app/customer/_lib/customer-ui';

export default function CustomerInvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    async function loadInvoice() {
      setLoading(true);
      setErrorMsg(null);
      const res = await apiFetch<InvoiceDto>(`/customer/invoices/${invoiceId}`);
      if (res.success && res.data) {
        setInvoice(res.data);
      } else {
        setErrorMsg(res.message || 'Invoice not found or unauthorized.');
      }
      setLoading(false);
    }
    if (invoiceId) {
      loadInvoice();
    }
  }, [invoiceId, reloadKey]);

  const handlePrint = () => {
    window.print();
  };

  if (loading && !invoice) {
    return (
      <div className="mx-auto max-w-2xl space-y-5" aria-busy="true" aria-label="Loading invoice">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (errorMsg || !invoice) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Invoice" backHref="/customer/invoices" backLabel="Invoices" />
        <ErrorState
          title="Could not load this invoice"
          error={errorMsg}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </div>
    );
  }

  const money = (amount: number | null | undefined) => formatINR(amount, invoice.currency || 'INR');

  return (
    <div className="mx-auto max-w-2xl space-y-5 sm:space-y-6">
      <PageHeader
        className="print:hidden"
        title="Tax invoice"
        backHref="/customer/invoices"
        backLabel="Invoices"
        eyebrow={<span className="font-mono text-xs text-navy-500">{invoice.invoiceNumber}</span>}
        actions={
          <Button onClick={handlePrint} variant="outline" leftIcon={<Printer className="h-4 w-4" />}>
            Print or save PDF
          </Button>
        }
      />

      <article className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-card print:rounded-none print:border-0 print:shadow-none">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 border-b border-surface-200 p-4 sm:p-5">
          <div className="min-w-0">
            <div className="text-xs font-medium text-navy-400">BroCo · Tax invoice</div>
            <div className="mt-0.5 break-all font-mono text-base font-semibold text-navy-900">{invoice.invoiceNumber}</div>
            <div className="mt-0.5 text-sm text-navy-500">Issued {formatDate(invoice.issuedAtUtc)}</div>
          </div>
          <StatusBadge status={invoice.status} className="shrink-0" />
        </header>

        {/* Parties */}
        <div className="grid grid-cols-1 gap-4 border-b border-surface-200 p-4 sm:grid-cols-2 sm:p-5">
          <div className="min-w-0">
            <div className="text-xs font-medium text-navy-400">From</div>
            <div className="mt-0.5 text-sm font-semibold text-navy-900">{invoice.garageName}</div>
            {invoice.garageAddress && (
              <p className="mt-0.5 whitespace-pre-line text-sm text-navy-600">{invoice.garageAddress}</p>
            )}
            {invoice.garageGstNumber && (
              <p className="mt-1 font-mono text-xs text-navy-600">GSTIN {invoice.garageGstNumber}</p>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-navy-400">Billed to</div>
            <div className="mt-0.5 text-sm font-semibold text-navy-900">{invoice.customerName}</div>
            {invoice.customerEmail && <p className="break-all text-sm text-navy-600">{invoice.customerEmail}</p>}
            {invoice.customerPhone && <p className="text-sm text-navy-600">{invoice.customerPhone}</p>}
            {invoice.customerBillingAddress && (
              <p className="mt-0.5 whitespace-pre-line text-sm text-navy-600">{invoice.customerBillingAddress}</p>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="border-b border-surface-200">
          <div className="px-4 pt-4 text-xs font-medium text-navy-400 sm:px-5">Items</div>
          {invoice.lineItems.length > 0 ? (
            <ul className="divide-y divide-surface-200/80">
              {invoice.lineItems.map((item, idx) => (
                <li key={idx} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <div className="break-words text-sm font-medium text-navy-900">{item.description}</div>
                    <div className="mt-0.5 text-xs text-navy-500">
                      {item.itemType ? `${humanize(item.itemType)} · ` : ''}
                      {item.quantity} × {money(item.unitPrice)}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold tabular-nums text-navy-900">{money(item.lineTotal)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-navy-500 sm:px-5">No line items on this invoice.</p>
          )}
        </div>

        {/* Totals */}
        <dl className="divide-y divide-surface-200/80 bg-surface-50 px-4 sm:px-5">
          <DetailRow label="Subtotal">{money(invoice.subTotal)}</DetailRow>
          <DetailRow label={`GST (${invoice.taxRatePercent}%)`}>{money(invoice.taxAmount)}</DetailRow>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-base font-semibold text-navy-900">Total</dt>
            <dd className="text-lg font-bold tabular-nums text-navy-900">{money(invoice.totalAmount)}</dd>
          </div>
        </dl>

        {/* Footer */}
        <footer className="space-y-1 p-4 text-sm text-navy-600 sm:p-5">
          {invoice.paidAtUtc && <p>Paid in full on {formatDate(invoice.paidAtUtc)}.</p>}
          {invoice.notes && <p className="whitespace-pre-wrap">{invoice.notes}</p>}
          <p className="text-xs text-navy-400">
            Payment{' '}
            <Link
              href={`/customer/payments/${invoice.paymentId}`}
              className="break-all font-mono text-electric-600 hover:underline print:text-navy-600 print:no-underline"
            >
              {invoice.paymentId}
            </Link>
          </p>
        </footer>
      </article>
    </div>
  );
}
