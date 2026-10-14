'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { GarageQuoteSummaryDto } from '@/types/garageQuote';
import { FileSpreadsheet, Inbox } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { StatusBadge, statusLabel } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { LoadingState } from '@/components/ui/LoadingState';
import { inDateRange, matchesSearch, useUrlFilters } from '@/lib/useUrlFilters';
import { LinkButton } from '../_components/LinkButton';
import { formatDate, formatINRWhole } from '@/lib/format';

// Always shown; other statuses (chosen, won, rejected ...) get a chip when a quote has them.
const FILTERS = [
  { value: 'Draft', label: 'Drafts' },
  { value: 'Submitted', label: 'Submitted' },
  { value: 'UnderReview', label: 'Under review' },
  { value: 'Withdrawn', label: 'Withdrawn' },
  { value: 'Expired', label: 'Expired' },
];

const FILTER_DEFAULTS = { q: '', status: '', range: '', from: '', to: '' };

/** When the quote was sent, or created for drafts. */
function quoteDate(q: GarageQuoteSummaryDto) {
  return q.submittedAtUtc || q.createdAtUtc;
}

export default function GarageQuotesPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading quotes..." />}>
      <GarageQuotes />
    </Suspense>
  );
}

function GarageQuotes() {
  const filters = useUrlFilters(FILTER_DEFAULTS);
  const { values: f } = filters;
  const [quotes, setQuotes] = useState<GarageQuoteSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadQuotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadQuotes() {
    setLoading(true);
    setError(null);
    const res = await apiFetch<GarageQuoteSummaryDto[]>('/garage/quotes');
    if (res.success && res.data) {
      setQuotes(res.data);
    } else {
      setError(res.message || 'Could not load your quotes.');
    }
    setLoading(false);
  }

  // The whole list is loaded, so filtering happens here; chip counts follow the search and date.
  const matching = useMemo(
    () =>
      quotes.filter(
        (q) => inDateRange(quoteDate(q), f) && matchesSearch(f.q, q.quoteNumber, q.requestNumber, q.vehicleSummary)
      ),
    [quotes, f]
  );

  const chipOptions = useMemo(() => {
    const count = (status: string) => matching.filter((q) => q.status === status).length;
    const known = new Set(FILTERS.map((o) => o.value));
    const extra = Array.from(new Set([...quotes.map((q) => q.status), f.status].filter((s) => s && !known.has(s))));
    return [
      { value: '', label: 'All', count: matching.length },
      ...FILTERS.map((o) => ({ ...o, count: count(o.value) })),
      ...extra.map((s) => ({ value: s, label: statusLabel(s), count: count(s) })),
    ];
  }, [quotes, matching, f.status]);

  const visible = f.status ? matching.filter((q) => q.status === f.status) : matching;
  const anyFilter = (Object.keys(FILTER_DEFAULTS) as (keyof typeof FILTER_DEFAULTS)[]).some((k) => filters.isActive(k));

  return (
    <div>
      <PageHeader
        title="Our quotes"
        description="Quotes you have drafted or sent to BroCo advisors."
        actions={
          <LinkButton href="/garage/requests" variant="outline" leftIcon={<Inbox className="h-4 w-4" />}>
            Quote a request
          </LinkButton>
        }
      />

      <div className="space-y-4">
        <FilterBar
          filters={filters}
          searchKey="q"
          searchPlaceholder="Quote no. or car"
          searchLabel="Search quotes"
          status={{ key: 'status', options: chipOptions, ariaLabel: 'Filter quotes by status' }}
          fields={[{ type: 'dateRange', label: 'Sent' }]}
          summary={loading || error ? null : `${visible.length} ${visible.length === 1 ? 'quote' : 'quotes'}`}
        />

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[72px] w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState title="Couldn’t load quotes" error={error} onRetry={loadQuotes} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            title={anyFilter ? 'No quotes found' : 'No quotes yet'}
            description={anyFilter ? 'No quotes match these filters.' : 'Open a customer request near you and create a quote.'}
            action={
              !anyFilter ? (
                <LinkButton href="/garage/requests" leftIcon={<Inbox className="h-4 w-4" />}>
                  See requests
                </LinkButton>
              ) : undefined
            }
          />
        ) : (
          <ListGroup>
            {visible.map((q) => (
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
