'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { CustomerQuotationSummaryDto } from '@/types/customerQuotation';
import { FileText, Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterChips } from '@/components/ui/FilterChips';
import { ListGroup, ListItem } from '@/components/ui/ListItem';
import { StatusBadge, statusLabel } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { formatDate, formatINR, formatINRWhole } from '@/lib/format';

// Client-side filter on the quotation status.
const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'ReadyToSend', label: 'Ready to send' },
  { value: 'Sent', label: 'Sent' },
  { value: 'Accepted', label: 'Accepted' },
  { value: 'Rejected', label: 'Declined' },
  { value: 'Expired', label: 'Expired' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Cancelled', label: 'Cancelled' },
];

const rowLink =
  'inline-flex min-h-[36px] items-center rounded-xl border border-surface-300 bg-white px-3 text-xs font-semibold text-navy-800 transition hover:bg-surface-50';

export default function AdminCustomerQuotationsPage() {
  const [quotations, setQuotations] = useState<CustomerQuotationSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const loadQuotations = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<CustomerQuotationSummaryDto[]>('/admin/customer-quotations');
    if (res.success && res.data) {
      setQuotations(res.data);
      setError(null);
    } else {
      setError(res.message || 'Could not load customer quotations.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadQuotations();
  }, [loadQuotations]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    quotations.forEach((q) => {
      map[q.status] = (map[q.status] ?? 0) + 1;
    });
    return map;
  }, [quotations]);

  const filtered = quotations.filter((q) => {
    if (statusFilter !== 'ALL' && q.status !== statusFilter) return false;
    const term = search.toLowerCase();
    return (
      q.quotationNumber.toLowerCase().includes(term) ||
      q.requestNumber.toLowerCase().includes(term) ||
      (q.assignedGarageName ?? '').toLowerCase().includes(term) ||
      q.status.toLowerCase().includes(term) ||
      statusLabel(q.status).toLowerCase().includes(term)
    );
  });

  const statusOptions = STATUS_OPTIONS.map((o) => ({
    ...o,
    count: o.value === 'ALL' ? quotations.length : counts[o.value] ?? 0,
  }));

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Customer quotations"
        description="Prices sent to customers after advisors pick a garage quote. Tap one to open its request."
      />

      {/* Search and filters */}
      <div className="space-y-3">
        <div className="sm:max-w-md">
          <Input
            type="search"
            aria-label="Search customer quotations"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Quotation number, request or garage"
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        {quotations.length > 0 && (
          <FilterChips options={statusOptions} value={statusFilter} onChange={setStatusFilter} ariaLabel="Filter by status" />
        )}
      </div>

      {loading ? (
        <LoadingState message="Loading customer quotations..." />
      ) : error ? (
        <ErrorState title="Could not load customer quotations" error={error} onRetry={loadQuotations} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No customer quotations found"
          description={
            search || statusFilter !== 'ALL'
              ? 'No quotations match this search or filter.'
              : 'Quotations appear here once an advisor prepares one for a customer.'
          }
        />
      ) : (
        <>
          <p className="text-xs text-navy-500">
            {filtered.length} {filtered.length === 1 ? 'quotation' : 'quotations'}
          </p>

          {/* Phones */}
          <div className="md:hidden">
            <ListGroup>
              {filtered.map((q) => (
                <ListItem
                  key={q.id}
                  href={`/admin/requests/${q.serviceRequestId}`}
                  title={q.assignedGarageName || 'Garage not set'}
                  subtitle={
                    <>
                      <span className="font-mono">{q.quotationNumber}</span> · {q.requestNumber}
                    </>
                  }
                  meta={`Version ${q.versionNumber} · valid until ${formatDate(q.validUntilUtc)}`}
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums text-navy-900">{formatINRWhole(q.customerTotal)}</span>
                      <StatusBadge status={q.status} />
                    </div>
                  }
                />
              ))}
            </ListGroup>
          </div>

          {/* Tablets and laptops */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quotation</TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead>Garage</TableHead>
                  <TableHead className="hidden lg:table-cell">Version</TableHead>
                  <TableHead className="text-right">Customer total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valid until</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Open request</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs font-semibold text-navy-900">{q.quotationNumber}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-navy-600">{q.requestNumber}</TableCell>
                    <TableCell className="font-medium text-navy-900">{q.assignedGarageName || '—'}</TableCell>
                    <TableCell className="hidden lg:table-cell">v{q.versionNumber}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums text-navy-900">
                      {formatINR(q.customerTotal, q.currency)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={q.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-navy-500">{formatDate(q.validUntilUtc)}</TableCell>
                    <TableCell className="hidden whitespace-nowrap text-navy-500 lg:table-cell">{formatDate(q.createdAtUtc)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/requests/${q.serviceRequestId}`} className={rowLink}>
                        Open
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
