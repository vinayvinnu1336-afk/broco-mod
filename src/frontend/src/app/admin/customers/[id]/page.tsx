'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminCustomerDetail } from '@/types/adminOperations';
import { CarFront, FileText, Mail, MapPin, MessageSquare, Phone } from 'lucide-react';
import { ErrorState } from '@/components/ui/ErrorState';
import { IconTile, ListGroup, ListItem } from '@/components/ui/ListItem';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDate, humanize } from '@/lib/format';

export default function AdminCustomerDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [customer, setCustomer] = useState<AdminCustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCustomerDetail = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<AdminCustomerDetail>(`/admin/customers/${id}`);
    if (res.success && res.data) {
      setCustomer(res.data);
      setError(null);
    } else {
      setError(res.message || 'Customer profile not found.');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadCustomerDetail();
  }, [loadCustomerDetail]);

  if (loading && !customer) {
    return (
      <div className="space-y-5" aria-busy="true">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-5">
        <PageHeader title="Customer" backHref="/admin/customers" backLabel="Customers" />
        <ErrorState title="Could not load this customer" error={error || 'Customer not found.'} onRetry={loadCustomerDetail} />
      </div>
    );
  }

  const vehicles = customer.vehicles ?? [];
  const requests = customer.serviceRequests ?? [];

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        backHref="/admin/customers"
        backLabel="Customers"
        title={customer.fullName}
        description={`Customer since ${formatDate(customer.createdAtUtc)}`}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        <ListGroup title="Contact">
          <ListItem
            href={customer.email ? `mailto:${customer.email}` : undefined}
            hideChevron
            leading={<IconTile icon={Mail} tone="neutral" />}
            title={customer.email || 'Not provided'}
            subtitle="Email"
          />
          <ListItem
            href={customer.phoneNumber ? `tel:${customer.phoneNumber}` : undefined}
            hideChevron
            leading={<IconTile icon={Phone} tone="neutral" />}
            title={customer.phoneNumber || 'Not provided'}
            subtitle="Phone"
          />
          <ListItem
            leading={<IconTile icon={MapPin} tone="neutral" />}
            title={<span className="whitespace-normal">{customer.address || 'Not provided'}</span>}
            subtitle="Address"
          />
          {customer.preferredContactMethod && (
            <ListItem
              leading={<IconTile icon={MessageSquare} tone="neutral" />}
              title={humanize(customer.preferredContactMethod)}
              subtitle="Preferred contact"
            />
          )}
        </ListGroup>

        <ListGroup title={`Cars (${vehicles.length})`}>
          {vehicles.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-navy-500">No cars added yet.</p>
          ) : (
            vehicles.map((v) => (
              <ListItem
                key={v.id}
                leading={<IconTile icon={CarFront} tone="blue" />}
                title={`${v.make} ${v.model}${v.year ? ` (${v.year})` : ''}`}
                subtitle={v.licensePlate}
                meta={v.vin ? `VIN ${v.vin}` : undefined}
              />
            ))
          )}
        </ListGroup>
      </div>

      <ListGroup title={`Service requests (${requests.length})`}>
        {requests.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-navy-500">This customer has not made any service requests.</p>
        ) : (
          requests.map((req) => (
            <ListItem
              key={req.id}
              href={`/admin/requests/${req.id}`}
              leading={<IconTile icon={FileText} tone="neutral" />}
              title={req.requestNumber}
              subtitle={`${req.vehicleMake} ${req.vehicleModel}`.trim() || req.vehicleSummary}
              meta={`${req.quotesReceivedCount} ${req.quotesReceivedCount === 1 ? 'quote' : 'quotes'} · ${formatDate(req.createdAtUtc)}`}
              trailing={<StatusBadge status={req.status} />}
            />
          ))
        )}
      </ListGroup>

      <p className="break-all px-1 text-xs text-navy-400">Customer ID {customer.id}</p>
    </div>
  );
}
