'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { PaymentDto } from '@/types/finance';
import { CreditCard, Receipt, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FilterChips } from '@/components/ui/FilterChips';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDateTime, formatINRWhole } from '@/lib/format';
import { paymentMethodLabel, paymentPurposeLabel } from '@/app/customer/_lib/customer-ui';
import { advancePurposeLabel } from '@/components/booking/advancePayment';

export default function CustomerPaymentsPage() {
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<PaymentDto[]>('/customer/payments');
      if (res.success && res.data) {
        setPayments(res.data);
      } else {
        setError(res.message || 'Unable to load your payments.');
      }
    } catch (err) {
      console.error('Error loading payments:', err);
      setError('Unable to load your payments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const filteredPayments = payments.filter((p) => {
    const matchesStatus = filterStatus === 'ALL' || p.status.toUpperCase() === filterStatus.toUpperCase();
    const matchesSearch =
      p.paymentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.gatewayPaymentId && p.gatewayPaymentId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      p.amount.toString().includes(searchTerm);
    return matchesStatus && matchesSearch;
  });

  const filterOptions = [
    { value: 'ALL', label: 'All', count: payments.length },
    { value: 'PAID', label: 'Paid', count: payments.filter((p) => p.status.toUpperCase() === 'PAID').length },
    { value: 'PENDING', label: 'Pending', count: payments.filter((p) => p.status.toUpperCase() === 'PENDING').length },
  ];

  const filtering = Boolean(searchTerm) || filterStatus !== 'ALL';

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <PageHeader
        title="Payments"
        description="Everything you have paid for services and extra work."
        actions={
          <Link href="/customer/invoices">
            <Button variant="outline" leftIcon={<Receipt className="h-4 w-4" />} className="w-full">
              Invoices
            </Button>
          </Link>
        }
      />

      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading payments">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[72px]" />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Could not load your payments" error={error} onRetry={loadPayments} />
      ) : payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payments yet"
          description="When you accept a quote and pay for it, the payment shows up here."
          action={
            <Link href="/customer/quotes">
              <Button variant="outline">See my quotes</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            <FilterChips
              ariaLabel="Filter payments by status"
              options={filterOptions}
              value={filterStatus}
              onChange={setFilterStatus}
            />
            <Input
              aria-label="Search payments"
              type="search"
              placeholder="Search by reference or amount"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>

          {filteredPayments.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matching payments"
              description={filtering ? 'Try a different filter or search.' : undefined}
            />
          ) : (
            <ListGroup>
              {filteredPayments.map((p) => (
                <ListItem
                  key={p.id}
                  href={`/customer/payments/${p.id}`}
                  leading={<IconTile icon={CreditCard} tone={p.status === 'Paid' ? 'green' : 'neutral'} />}
                  title={advancePurposeLabel(p.purpose) ?? paymentPurposeLabel(p.purpose)}
                  subtitle={[p.paymentNumber, paymentMethodLabel(p.paymentMethod)]
                    .filter(Boolean)
                    .join(' · ')}
                  meta={formatDateTime(p.paidAtUtc || p.createdAtUtc)}
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums text-navy-900">{formatINRWhole(p.amount)}</span>
                      <StatusBadge status={p.status} />
                    </div>
                  }
                />
              ))}
            </ListGroup>
          )}
        </>
      )}
    </div>
  );
}
