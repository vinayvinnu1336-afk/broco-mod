'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PagedResult } from '@/types/adminOperations';
import { History, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterBar } from '@/components/ui/FilterBar';
import { ListGroup, ListItem } from '@/components/ui/ListItem';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { formatDateTime, humanize } from '@/lib/format';
import { dateRangeQuery, toQueryString, useUrlFilters } from '@/lib/useUrlFilters';

// The API matches `action` as "contains", so each option is the prefix shared by a family of action codes.
const ACTION_OPTIONS = [
  { value: 'SERVICE_REQUEST', label: 'Service requests' },
  { value: 'GARAGE_REQUEST', label: 'Requests sent to garages' },
  { value: 'GARAGE_QUOTE', label: 'Garage quotes' },
  { value: 'CUSTOMER_QUOTATION', label: 'Customer quotations' },
  { value: 'GARAGE_ASSIGNMENT', label: 'Garage assignments' },
  { value: 'BOOKING', label: 'Bookings' },
  { value: 'SERVICE_JOB', label: 'Jobs (created, scheduled, closed)' },
  { value: 'SERVICE_VEHICLE', label: 'Car received, ready, handed over' },
  { value: 'SERVICE_WORK', label: 'Work started or completed' },
  { value: 'ADDITIONAL_WORK', label: 'Extra work' },
  { value: 'PAYMENT', label: 'Payments' },
  { value: 'INVOICE', label: 'Invoices' },
  { value: 'COMMISSION', label: 'Commission' },
  { value: 'SETTLEMENT', label: 'Settlements' },
  { value: 'ADVISOR_NOTE', label: 'Advisor notes' },
  { value: 'ADMIN_GARAGE', label: 'Garage changes by admin' },
  { value: 'ADMIN_ADVISOR', label: 'Advisor changes by admin' },
  { value: 'ADMIN_NOTIFICATION', label: 'Notification retries' },
];

// Record types the platform writes to the audit trail (the API matches `entityName` exactly).
const ENTITY_OPTIONS = [
  'ServiceRequest',
  'GarageRequest',
  'GarageQuote',
  'CustomerQuotation',
  'GarageAssignment',
  'ServiceJob',
  'AdditionalWorkRequest',
  'ServiceMedia',
  'Payment',
  'Invoice',
  'GarageCommission',
  'GarageSettlement',
  'PlatformFeeConfiguration',
  'Garage',
  'AdvisorProfile',
  'AdvisorRequestNote',
  'CustomerProfile',
  'User',
  'Notification',
].map((name) => ({ value: name, label: humanize(name) }));

const FILTER_DEFAULTS = { q: '', action: '', entity: '', range: '', from: '', to: '', size: '25' };

interface AuditLogItem {
  id: string;
  action: string;
  userEmail?: string;
  entityName?: string;
  entityId?: string;
  details?: string;
  ipAddress?: string;
  timestampUtc: string;
}

export default function AdminAuditPage() {
  return (
    <Suspense fallback={<Skeleton className="h-16 rounded-2xl" />}>
      <AdminAudit />
    </Suspense>
  );
}

function AdminAudit() {
  const filters = useUrlFilters(FILTER_DEFAULTS);
  const { values: f, page: urlPage } = filters;
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = [25, 50, 100].includes(Number(f.size)) ? Number(f.size) : 25;

  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const requestId = useRef(0);

  const query = useMemo(
    () =>
      toQueryString({
        page: urlPage,
        pageSize,
        search: f.q,
        action: f.action,
        entityName: f.entity,
        ...dateRangeQuery(f),
      }),
    [urlPage, pageSize, f]
  );

  const loadLogs = useCallback(async (qs: string) => {
    const id = ++requestId.current;
    setLoading(true);
    const res = await apiFetch<PagedResult<AuditLogItem>>(`/admin/audit${qs}`);
    if (id !== requestId.current) return; // a newer filter change is already loading
    if (res.success && res.data) {
      const data = res.data as PagedResult<AuditLogItem> & { page?: number };
      setLogs(data.items ?? []);
      setPage(data.pageNumber ?? data.page ?? 1);
      setTotalPages(data.totalPages ?? 1);
      setTotalCount(data.totalCount ?? 0);
      setLoadError(null);
    } else {
      setLoadError(res.message || 'Could not load the audit trail.');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadLogs(query);
  }, [query, loadLogs]);

  const reload = () => loadLogs(query);
  const closeLog = useCallback(() => setSelectedLog(null), []);
  const hasFilters = Object.keys(FILTER_DEFAULTS).some((k) => k !== 'size' && filters.isActive(k as keyof typeof FILTER_DEFAULTS));

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Audit trail"
        description="A record of who changed what, and when, across the platform."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              setRefreshing(true);
              reload();
            }}
            isLoading={refreshing}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
        }
      />

      <FilterBar
        filters={filters}
        searchKey="q"
        searchPlaceholder="Email, record ID or details"
        searchLabel="Search the audit trail"
        fields={[
          { type: 'select', key: 'action', label: 'Action', allLabel: 'All actions', options: ACTION_OPTIONS },
          { type: 'select', key: 'entity', label: 'Record type', allLabel: 'All record types', options: ENTITY_OPTIONS },
          { type: 'dateRange', label: 'When' },
        ]}
        summary={loading ? 'Loading…' : `${totalCount} ${totalCount === 1 ? 'entry' : 'entries'}`}
      />

      {loading && logs.length === 0 ? (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : loadError && logs.length === 0 ? (
        <ErrorState title="Audit trail unavailable" error={loadError} onRetry={reload} />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={History}
          title="No entries found"
          description={hasFilters ? 'No entries match these filters.' : 'Nothing has been recorded yet.'}
        />
      ) : (
        <div className={`space-y-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Action</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>When</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-semibold text-navy-900">
                      <button type="button" className="text-left hover:text-electric-600" onClick={() => setSelectedLog(l)}>
                        {humanize(l.action)}
                      </button>
                    </TableCell>
                    <TableCell className="max-w-[14rem] truncate text-navy-700">{l.userEmail || 'System'}</TableCell>
                    <TableCell className="text-navy-700">{l.entityName ? humanize(l.entityName) : '—'}</TableCell>
                    <TableCell className="max-w-sm text-navy-600">
                      <span className="line-clamp-2">{l.details || '—'}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-navy-500">{formatDateTime(l.timestampUtc)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Phone list */}
          <div className="md:hidden">
            <ListGroup>
              {logs.map((l) => (
                <ListItem
                  key={l.id}
                  onClick={() => setSelectedLog(l)}
                  title={humanize(l.action)}
                  subtitle={l.details || (l.entityName ? humanize(l.entityName) : undefined)}
                  meta={`${l.userEmail || 'System'} · ${formatDateTime(l.timestampUtc)}`}
                />
              ))}
            </ListGroup>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {totalCount > 0 && (
              <Pagination
                className="flex-1"
                currentPage={page}
                totalPages={Math.max(1, totalPages)}
                totalItems={totalCount}
                pageSize={pageSize}
                onPageChange={filters.setPage}
              />
            )}
            <div className="hidden w-40 sm:block">
              <Select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(e) => filters.set({ size: e.target.value })}
                options={[
                  { value: 25, label: '25 per page' },
                  { value: 50, label: '50 per page' },
                  { value: 100, label: '100 per page' },
                ]}
              />
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={!!selectedLog}
        onClose={closeLog}
        size="md"
        title={selectedLog ? humanize(selectedLog.action) : ''}
        description={selectedLog ? formatDateTime(selectedLog.timestampUtc) : undefined}
        footer={
          <div className="flex sm:justify-end">
            <Button variant="outline" onClick={closeLog} className="w-full sm:w-auto">
              Close
            </Button>
          </div>
        }
      >
        {selectedLog && (
          <div className="space-y-5">
            <dl className="space-y-3 text-sm">
              <DetailRow label="Done by" value={selectedLog.userEmail || 'System'} />
              <DetailRow label="Record type" value={selectedLog.entityName ? humanize(selectedLog.entityName) : '—'} />
              <DetailRow label="Record ID" value={selectedLog.entityId || '—'} mono />
              <DetailRow label="Details" value={selectedLog.details || '—'} />
              <DetailRow label="IP address" value={selectedLog.ipAddress || '—'} mono />
              <DetailRow label="Action code" value={selectedLog.action} mono />
            </dl>
            <details className="group rounded-xl border border-surface-200 bg-surface-50">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-navy-700">Raw data</summary>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all border-t border-surface-200 p-4 text-xs text-navy-800">
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </Modal>
    </div>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3">
      <dt className="text-navy-500">{label}</dt>
      <dd className={`min-w-0 break-words text-navy-900 ${mono ? 'font-mono text-xs leading-5' : ''}`}>{value}</dd>
    </div>
  );
}
