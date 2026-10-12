'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { AdminCustomerList, PagedResult } from '@/types/adminOperations';
import { RefreshCw, Search, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { ListGroup, ListItem } from '@/components/ui/ListItem';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { formatDate } from '@/lib/format';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomerList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  const requestId = useRef(0);
  const searchRef = useRef(searchTerm);
  searchRef.current = searchTerm;

  const loadCustomers = useCallback(async (p: number, size: number, search: string) => {
    const id = ++requestId.current;
    setLoading(true);
    let url = `/admin/customers?page=${p}&pageSize=${size}`;
    if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

    const res = await apiFetch<PagedResult<AdminCustomerList>>(url);
    if (id !== requestId.current) return;
    if (res.success && res.data) {
      const data = res.data as PagedResult<AdminCustomerList> & { page?: number };
      setCustomers(data.items ?? []);
      setPage(data.pageNumber ?? data.page ?? p);
      setTotalPages(data.totalPages ?? 1);
      setTotalCount(data.totalCount ?? 0);
      setLoadError(null);
    } else {
      setLoadError(res.message || 'Could not load customers.');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadCustomers(1, pageSize, searchRef.current);
  }, [pageSize, loadCustomers]);

  const reload = () => loadCustomers(page, pageSize, searchTerm);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadCustomers(1, pageSize, searchTerm);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Customers"
        description="Customer accounts with their cars and service requests."
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

      <form onSubmit={handleSearchSubmit} role="search" className="flex gap-2">
        <div className="flex-1">
          <Input
            type="search"
            enterKeyHint="search"
            aria-label="Search customers"
            placeholder="Search by name, email or phone"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <Button type="submit" variant="outline" className="shrink-0">
          Search
        </Button>
      </form>

      {loading && customers.length === 0 ? (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : loadError && customers.length === 0 ? (
        <ErrorState title="Customers unavailable" error={loadError} onRetry={reload} />
      ) : customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers found"
          description={searchTerm ? 'Try a different name, email or phone number.' : 'Customers appear here when they sign up.'}
        />
      ) : (
        <div className={`space-y-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Cars</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead>Joined</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="max-w-[18rem]">
                      <Link href={`/admin/customers/${c.id}`} className="font-semibold text-navy-900 hover:text-electric-600">
                        {c.fullName}
                      </Link>
                      <div className="truncate text-xs text-navy-500">{c.email}</div>
                    </TableCell>
                    <TableCell className="text-navy-700">{c.phoneNumber || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.vehiclesCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.requestsCount}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-navy-500">{formatDate(c.createdAtUtc)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Phone list */}
          <div className="md:hidden">
            <ListGroup>
              {customers.map((c) => (
                <ListItem
                  key={c.id}
                  href={`/admin/customers/${c.id}`}
                  leading={<Avatar name={c.fullName} size="lg" />}
                  title={c.fullName}
                  subtitle={c.phoneNumber || c.email}
                  meta={`${plural(c.vehiclesCount, 'car', 'cars')} · ${plural(c.requestsCount, 'request', 'requests')} · Joined ${formatDate(c.createdAtUtc)}`}
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
                onPageChange={(p) => loadCustomers(p, pageSize, searchTerm)}
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
    </div>
  );
}
