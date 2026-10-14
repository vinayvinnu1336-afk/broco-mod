'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { CustomerFacingQuotationDto } from '@/types/customerQuotation';
import { FileCheck2, Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate, formatINRWhole } from '@/lib/format';
import { statusKey } from '@/app/customer/_lib/customer-ui';

/** The API also returns these vehicle fields on each quote. */
type QuoteRow = CustomerFacingQuotationDto & {
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehicleLicensePlate?: string;
};

function quoteVehicle(q: QuoteRow) {
  return [q.vehicleYear, q.vehicleMake, q.vehicleModel].filter(Boolean).join(' ');
}

function QuoteListItem({ q }: { q: QuoteRow }) {
  const awaiting = statusKey(q.status) === 'SENT';
  const meta = [q.quotationNumber, q.validUntilUtc ? `Valid until ${formatDate(q.validUntilUtc)}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <ListItem
      href={`/customer/quotes/${q.id}`}
      leading={<IconTile icon={FileCheck2} tone={awaiting ? 'amber' : 'neutral'} />}
      title={quoteVehicle(q) || `Quote ${q.quotationNumber}`}
      subtitle={q.scopeSummary || `Request ${q.requestNumber}`}
      meta={meta}
      trailing={
        <div className="flex flex-col items-end gap-1">
          <span className="text-sm font-semibold tabular-nums text-navy-900">{formatINRWhole(q.customerTotal)}</span>
          <StatusBadge status={q.status} />
        </div>
      }
    />
  );
}

export default function CustomerQuotesPage() {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<QuoteRow[]>('/customer/quotes');
      if (res.success && res.data) {
        setQuotes(res.data);
      } else {
        setError(res.message || 'Unable to load your quotes.');
      }
    } catch (err) {
      console.error('Error loading quotations:', err);
      setError('Unable to load your quotes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  const awaiting = useMemo(() => quotes.filter((q) => statusKey(q.status) === 'SENT'), [quotes]);
  const others = useMemo(() => quotes.filter((q) => statusKey(q.status) !== 'SENT'), [quotes]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <PageHeader
        title="Quotes"
        description="Prices from your advisor. Open a quote to see what is included and accept or decline it."
      />

      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading quotes">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[76px]" />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Could not load your quotes" error={error} onRetry={loadQuotes} />
      ) : quotes.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title="No quotes yet"
          description="When you book a repair, garages quote and your advisor sends you one price here. Fixed-price service packages don't need a quote."
          action={
            <Link href="/customer/requests/new">
              <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
                Book a service
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          {awaiting.length > 0 && (
            <ListGroup title={`Waiting for your decision (${awaiting.length})`}>
              {awaiting.map((q) => (
                <QuoteListItem key={q.id} q={q} />
              ))}
            </ListGroup>
          )}
          {others.length > 0 && (
            <ListGroup title={awaiting.length > 0 ? 'Earlier quotes' : undefined}>
              {others.map((q) => (
                <QuoteListItem key={q.id} q={q} />
              ))}
            </ListGroup>
          )}
        </>
      )}
    </div>
  );
}
