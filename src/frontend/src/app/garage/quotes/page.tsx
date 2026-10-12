'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { GarageQuoteSummaryDto } from '@/types/garageQuote';
import { FileSpreadsheet, Inbox } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterChips } from '@/components/ui/FilterChips';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { LinkButton } from '../_components/LinkButton';
import { formatDate, formatINRWhole } from '@/lib/format';

const FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'Draft', label: 'Drafts' },
  { value: 'Submitted', label: 'Submitted' },
  { value: 'UnderReview', label: 'Under review' },
  { value: 'Withdrawn', label: 'Withdrawn' },
  { value: 'Expired', label: 'Expired' },
];

export default function GarageQuotesPage() {
  const [quotes, setQuotes] = useState<GarageQuoteSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    loadQuotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function loadQuotes() {
    setLoading(true);
    setError(null);
    const query = statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
    const res = await apiFetch<GarageQuoteSummaryDto[]>(`/garage/quotes${query}`);
    if (res.success && res.data) {
      setQuotes(res.data);
    } else {
      setError(res.message || 'Could not load your quotes.');
    }
    setLoading(false);
  }

  const activeLabel = FILTERS.find((f) => f.value === statusFilter)?.label.toLowerCase();

  return (
    <div>
      <PageHeader
        title="Our quotes"
        description="Quotes you have drafted or sent to BroCo Mod advisors."
        actions={
          <LinkButton href="/garage/requests" variant="outline" leftIcon={<Inbox className="h-4 w-4" />}>
            Quote a request
          </LinkButton>
        }
      />

      <div className="space-y-4">
        <FilterChips options={FILTERS} value={statusFilter} onChange={setStatusFilter} ariaLabel="Filter quotes by status" />

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[72px] w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState title="Couldn’t load quotes" error={error} onRetry={loadQuotes} />
        ) : quotes.length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            title={statusFilter === 'ALL' ? 'No quotes yet' : `No ${activeLabel} quotes`}
            description={
              statusFilter === 'ALL'
                ? 'Open a customer request near you and create a quote.'
                : 'Try another filter.'
            }
            action={
              statusFilter === 'ALL' ? (
                <LinkButton href="/garage/requests" leftIcon={<Inbox className="h-4 w-4" />}>
                  See requests
                </LinkButton>
              ) : undefined
            }
          />
        ) : (
          <ListGroup>
            {quotes.map((q) => (
              <ListItem
                key={q.id}
                href={`/garage/quotes/${q.id}`}
                leading={<IconTile icon={FileSpreadsheet} tone={q.status === 'Draft' ? 'neutral' : 'blue'} />}
                title={q.vehicleSummary || q.quoteNumber}
                subtitle={`${q.quoteNumber}${q.versionNumber > 1 ? ` · v${q.versionNumber}` : ''}${
                  q.requestNumber ? ` · ${q.requestNumber}` : ''
                }`}
                meta={
                  q.submittedAtUtc
                    ? `Sent ${formatDate(q.submittedAtUtc)} · valid until ${formatDate(q.validUntil)}`
                    : `Created ${formatDate(q.createdAtUtc)} · not sent yet`
                }
                trailing={
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums text-navy-900">{formatINRWhole(q.totalAmount)}</span>
                    <StatusBadge status={q.status} />
                  </div>
                }
              />
            ))}
          </ListGroup>
        )}
      </div>
    </div>
  );
}
