'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminAttentionQueue, AttentionItem } from '@/types/adminOperations';
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterChips } from '@/components/ui/FilterChips';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { formatRelative, humanize } from '@/lib/format';

type Level = 'high' | 'medium' | 'low';

const LEVELS: Record<Level, { label: string; tone: 'red' | 'amber' | 'blue'; badge: BadgeVariant; icon: React.ElementType; rank: number }> = {
  high: { label: 'High', tone: 'red', badge: 'red', icon: AlertOctagon, rank: 0 },
  medium: { label: 'Medium', tone: 'amber', badge: 'amber', icon: AlertTriangle, rank: 1 },
  low: { label: 'Low', tone: 'blue', badge: 'blue', icon: Info, rank: 2 },
};

// The API sends "High" / "Medium" (older builds used CRITICAL / WARNING / INFO). Accept both.
function severityLevel(severity: string | null | undefined): Level {
  const value = String(severity ?? '').toUpperCase();
  if (value === 'HIGH' || value === 'CRITICAL') return 'high';
  if (value === 'MEDIUM' || value === 'WARNING') return 'medium';
  return 'low';
}

const CATEGORY_LABELS: Record<string, string> = {
  UnansweredRequest: 'No quotes yet',
  QuotesAwaitingReview: 'Quotes waiting for review',
  CustomerQuoteExpiring: 'Customer quotations expiring',
  BookingUnscheduled: 'Bookings not scheduled',
  VehicleUnreceived: 'Vehicles not received',
  AdditionalWorkPending: 'Extra work waiting for approval',
  NotificationFailed: 'Failed notifications',
  SuspendedGarageWithJobs: 'Suspended garages with open jobs',
};

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? humanize(category);
}

// There is no admin job detail screen; send job links to the jobs list instead of a 404.
function resolveActionUrl(url: string): string {
  if (/^\/admin\/jobs\/[^/?#]+$/.test(url)) return '/admin/jobs';
  return url || '/admin/attention';
}

// ListItem truncates its lines; attention items need the full sentence to be actionable.
const Wrap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="block whitespace-normal break-words">{children}</span>
);

export default function AdminAttentionQueuePage() {
  const [data, setData] = useState<AdminAttentionQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const loadAttentionQueue = useCallback(async () => {
    setRefreshing(true);
    const res = await apiFetch<AdminAttentionQueue>('/admin/attention');
    if (res.success && res.data) {
      setData(res.data);
      setError(null);
    } else {
      setError(res.message || 'Could not load the attention queue.');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadAttentionQueue();
  }, [loadAttentionQueue]);

  const items = useMemo(() => data?.items ?? [], [data]);

  const severityCounts = useMemo(() => {
    const counts: Record<Level, number> = { high: 0, medium: 0, low: 0 };
    items.forEach((i) => {
      counts[severityLevel(i.severity)] += 1;
    });
    return counts;
  }, [items]);

  const categories = useMemo(() => Array.from(new Set(items.map((i) => i.category))), [items]);

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (severityFilter !== 'ALL' && severityLevel(item.severity) !== severityFilter) return false;
        if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
        return true;
      }),
    [items, severityFilter, categoryFilter]
  );

  // Group by category; most severe groups first, most severe items first within a group.
  const groups = useMemo(() => {
    const map = new Map<string, AttentionItem[]>();
    filteredItems.forEach((item) => {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    });
    return Array.from(map.entries())
      .map(([category, list]) => {
        const sorted = [...list].sort(
          (a, b) => LEVELS[severityLevel(a.severity)].rank - LEVELS[severityLevel(b.severity)].rank
        );
        return { category, items: sorted, topRank: LEVELS[severityLevel(sorted[0].severity)].rank };
      })
      .sort((a, b) => a.topRank - b.topRank || b.items.length - a.items.length);
  }, [filteredItems]);

  const severityOptions = [
    { value: 'ALL', label: 'All', count: items.length },
    { value: 'high', label: 'High', count: severityCounts.high },
    { value: 'medium', label: 'Medium', count: severityCounts.medium },
    { value: 'low', label: 'Low', count: severityCounts.low },
  ];

  const categoryOptions = [
    { value: 'ALL', label: 'All types' },
    ...categories.map((c) => ({
      value: c,
      label: categoryLabel(c),
      count: items.filter((i) => i.category === c).length,
    })),
  ];

  const total = data?.totalAttentionItemsCount ?? items.length;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Needs attention"
        description={
          loading
            ? 'Requests, quotations, jobs and notifications that are stuck or overdue.'
            : total === 0
            ? 'Nothing is stuck or overdue right now.'
            : `${total} ${total === 1 ? 'item is' : 'items are'} stuck or overdue. Tap one to open it.`
        }
        actions={
          <Button
            variant="outline"
            onClick={loadAttentionQueue}
            isLoading={refreshing}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
        }
      />

      {items.length > 0 && (
        <div className="space-y-2">
          <FilterChips options={severityOptions} value={severityFilter} onChange={setSeverityFilter} ariaLabel="Filter by severity" />
          {categories.length > 1 && (
            <FilterChips options={categoryOptions} value={categoryFilter} onChange={setCategoryFilter} ariaLabel="Filter by type" />
          )}
        </div>
      )}

      {error && data && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not refresh: {error} Showing the last loaded queue.
        </p>
      )}

      {loading ? (
        <LoadingState message="Loading the attention queue..." />
      ) : !data ? (
        <ErrorState title="Could not load the attention queue" error={error} onRetry={loadAttentionQueue} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nothing needs attention"
          description="No requests, quotations, jobs or notifications are stuck or overdue."
        />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No items match these filters"
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSeverityFilter('ALL');
                setCategoryFilter('ALL');
              }}
            >
              Show all items
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <ListGroup
              key={group.category}
              title={
                <>
                  {categoryLabel(group.category)}{' '}
                  <span className="font-normal text-navy-400">({group.items.length})</span>
                </>
              }
            >
              {group.items.map((item, idx) => {
                const level = LEVELS[severityLevel(item.severity)];
                return (
                  <ListItem
                    key={`${item.referenceId}-${idx}`}
                    href={resolveActionUrl(item.actionUrl)}
                    leading={<IconTile icon={level.icon} tone={level.tone} />}
                    title={<Wrap>{item.title}</Wrap>}
                    subtitle={item.description ? <Wrap>{item.description}</Wrap> : undefined}
                    meta={
                      <>
                        <span className="sm:hidden">{level.label} priority · </span>
                        {item.referenceNumber} · flagged {formatRelative(item.createdAtUtc)}
                      </>
                    }
                    trailing={
                      <span className="hidden sm:block">
                        <Badge variant={level.badge} dot pill className="whitespace-nowrap">
                          {level.label}
                        </Badge>
                      </span>
                    }
                  />
                );
              })}
            </ListGroup>
          ))}
        </div>
      )}
    </div>
  );
}
