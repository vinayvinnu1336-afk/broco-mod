'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { InvoiceDto, bookingAdvanceLine, parseInvoiceLineItems } from '@/types/finance';
import { CreditCard, Receipt, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate, formatINRWhole } from '@/lib/format';

export default function CustomerInvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<InvoiceDto[]>('/customer/invoices');
      if (res.success && res.data) {
        setInvoices(res.data);
      } else {
        setError(res.message || 'Unable to load your invoices.');
      }
    } catch (err) {
      console.error('Error loading invoices:', err);
      setError('Unable to load your invoices.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.totalAmount.toString().includes(searchTerm)
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <PageHeader
        title="Invoices"
        description="Receipts for the booking advances you paid BroCo online. The rest of each bill is paid at the garage."
        actions={
          <Link href="/customer/payments">
            <Button variant="outline" leftIcon={<CreditCard className="h-4 w-4" />} className="w-full">
              Payments
            </Button>
          </Link>
        }
      />

      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading invoices">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[72px]" />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Could not load your invoices" error={error} onRetry={loadInvoices} />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices yet"
          description="When you pay a booking advance, its receipt appears here."
        />
      ) : (
        <>
          {invoices.length > 3 && (
            <Input
              aria-label="Search invoices"
              type="search"
              placeholder="Search by invoice number or amount"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          )}

          {filteredInvoices.length === 0 ? (
            <EmptyState icon={Search} title="No matching invoices" description="Try a different search." />
          ) : (
            <ListGroup>
              {filteredInvoices.map((inv) => {
                const advance = bookingAdvanceLine(parseInvoiceLineItems(inv));
                const balance = advance?.balanceAtGarage;
                return (
                <ListItem
                  key={inv.id}
                  href={`/customer/invoices/${inv.id}`}
                  leading={<IconTile icon={Receipt} tone="neutral" />}
                  title={advance ? 'Booking advance' : 'Invoice'}
                  subtitle={inv.invoiceNumber}
                  meta={
                    balance && balance > 0
                      ? `${formatINRWhole(balance)} to pay at the garage · Issued ${formatDate(inv.issuedAtUtc)}`
                      : `Issued ${formatDate(inv.issuedAtUtc)}`
                  }
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums text-navy-900">
                        {formatINRWhole(inv.totalAmount)}
                      </span>
                      <StatusBadge status={inv.status} />
                    </div>
                  }
                />
                );
              })}
            </ListGroup>
          )}
        </>
      )}
    </div>
  );
}
