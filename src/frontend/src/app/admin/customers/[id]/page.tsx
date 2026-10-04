'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { AdminCustomerDetail } from '@/types/adminOperations';
import {
  Users,
  Mail,
  Phone,
  MapPin,
  Clock,
  ArrowLeft,
  CarFront,
  FileText,
  AlertTriangle,
  Eye,
  ShieldCheck
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';

export default function AdminCustomerDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [customer, setCustomer] = useState<AdminCustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCustomerDetail() {
      setLoading(true);
      const res = await apiFetch<AdminCustomerDetail>(`/admin/customers/${id}`);
      if (res.success && res.data) {
        setCustomer(res.data);
      } else {
        setError(res.message || 'Customer profile not found.');
      }
      setLoading(false);
    }
    loadCustomerDetail();
  }, [id]);

  if (loading) {
    return <LoadingState message="Loading customer profile..." />;
  }

  if (error || !customer) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-rose-600 mb-2" />
        <h2 className="text-base font-bold text-rose-900">Unable to load customer</h2>
        <p className="mt-1 text-sm text-rose-700">{error || 'Customer not found.'}</p>
        <Link href="/admin/customers" className="mt-4 inline-block">
          <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}>
            Back to Customers
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/customers"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-navy-600 hover:text-navy-900 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Customer Directory
        </Link>
        <span className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-1 text-xs font-mono font-bold text-navy-700">
          ID: {customer.id}
        </span>
      </div>

      {/* Profile Header */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-surface-100 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-navy-900">{customer.fullName}</h1>
              <Badge variant="green" icon={ShieldCheck}>
                Verified Customer
              </Badge>
            </div>
            <p className="mt-1 text-xs text-navy-600">
              Registered on {new Date(customer.createdAtUtc).toLocaleDateString()} &bull; Preferred contact:{' '}
              <span className="font-bold text-navy-800">{customer.preferredContactMethod || 'Email'}</span>
            </p>
          </div>
        </div>

        {/* Contact and Address */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5">
          <div className="space-y-1">
            <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Email Address:</span>
            <p className="text-xs text-navy-800 flex items-center gap-2 font-medium">
              <Mail className="h-3.5 w-3.5 text-navy-400" /> {customer.email}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Phone Number:</span>
            <p className="text-xs text-navy-800 flex items-center gap-2 font-medium">
              <Phone className="h-3.5 w-3.5 text-navy-400" /> {customer.phoneNumber || 'Not provided'}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Registered Address:</span>
            <p className="text-xs text-navy-800 flex items-start gap-2 font-medium">
              <MapPin className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" /> {customer.address || 'Address on record'}
            </p>
          </div>
        </div>
      </Card>

      {/* Registered Vehicles Fleet */}
      <Card className="p-6">
        <h2 className="text-base font-bold text-navy-900 flex items-center gap-2 border-b border-surface-100 pb-3">
          <CarFront className="h-4 w-4 text-emerald-600" /> Registered Vehicle Fleet ({customer.vehicles.length})
        </h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {customer.vehicles.length === 0 ? (
            <p className="py-6 text-center text-xs text-navy-500 col-span-3">No vehicles registered.</p>
          ) : (
            customer.vehicles.map((v) => (
              <div key={v.id} className="rounded-xl border border-surface-200 bg-surface-50 p-4 space-y-1">
                <span className="text-sm font-bold text-navy-900">{v.make} {v.model} ({v.year})</span>
                <p className="text-xs font-mono font-bold text-emerald-700">{v.licensePlate}</p>
                {v.vin && <p className="text-[10px] font-mono text-navy-500">VIN: {v.vin}</p>}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Service History */}
      <Card className="p-6">
        <h2 className="text-base font-bold text-navy-900 flex items-center gap-2 border-b border-surface-100 pb-3">
          <FileText className="h-4 w-4 text-electric-600" /> Service Requests & Job History ({customer.serviceRequests.length})
        </h2>
        <div className="mt-4 divide-y divide-surface-100">
          {customer.serviceRequests.length === 0 ? (
            <p className="py-6 text-center text-xs text-navy-500">No service requests recorded for this customer.</p>
          ) : (
            customer.serviceRequests.map((req) => (
              <div key={req.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <Link href={`/admin/requests/${req.id}`} className="font-mono font-bold text-navy-900 hover:text-electric-600">
                    {req.requestNumber}
                  </Link>
                  <p className="text-[11px] text-navy-600">
                    {req.vehicleMake} {req.vehicleModel} &bull; {req.quotesReceivedCount} quote(s) received
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge status={req.status} />
                  <Link href={`/admin/requests/${req.id}`}>
                    <Button size="sm" variant="secondary" leftIcon={<Eye className="h-3.5 w-3.5" />}>
                      Timeline
                    </Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
