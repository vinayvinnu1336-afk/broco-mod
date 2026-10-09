'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PagedResult } from '@/types/adminOperations';
import { History, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { ListGroup, ListItem } from '@/components/ui/ListItem';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { formatDateTime, humanize } from '@/lib/format';

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
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const requestId = useRef(0);

  const loadLogs = useCallback(async (p: number, size: number, action: string, entity: string) => {
    const id = ++requestId.current;
    setLoading(true);
    let url = `/admin/audit?page=${p}&pageSize=${size}`;
    if (action.trim()) url += `&action=${encodeURIComponent(action.trim())}`;
    if (entity.trim()) url += `&entityName=${encodeURIComponent(entity.trim())}`;

    const res = await apiFetch<PagedResult<AuditLogItem>>(url);
    if (id !== requestId.current) return; // typing fires a request per keystroke; keep only the latest
    if (res.success && res.data) {
      const data = res.data as PagedResult<AuditLogItem> & { page?: number };
      setLogs(data.items ?? []);
      setPage(data.pageNumber ?? data.page ?? p);
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
    loadLogs(1, pageSize, actionFilter, entityFilter);
  }, [pageSize, actionFilter, entityFilter, loadLogs]);

  const reload = () => loadLogs(page, pageSize, actionFilter, entityFilter);
  const closeLog = useCallback(() => setSelectedLog(null), []);
  const hasFilters = Boolean(actionFilter.trim() || entityFilter.trim());

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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          type="search"
          aria-label="Filter by action"
          placeholder="Action contains, e.g. Garage"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
        />
        <Input
          type="search"
          aria-label="Filter by record type"
          placeholder="Exact record type, e.g. ServiceRequest"
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
        />
      </div>

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
          description={hasFilters ? 'Nothing matches these filters. The record type must match exactly, e.g. ServiceRequest or Garage.' : 'Nothing has been recorded yet.'}
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
                onPageChange={(p) => loadLogs(p, pageSize, actionFilter, entityFilter)}
              />
            )}
            <div className="hidden w-40 sm:block">
              <Select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
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
