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
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-500 border-t-transparent" />
          <p className="text-sm text-neutral-400">Loading customer profile...</p>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-rose-400 mb-2" />
        <h2 className="text-base font-semibold text-rose-200">Unable to load customer</h2>
        <p className="mt-1 text-sm text-rose-300/80">{error || 'Customer not found.'}</p>
        <Link
          href="/admin/customers"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-neutral-800 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Customers
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/customers"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-white transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Customer Directory
        </Link>
        <span className="rounded-full border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs font-mono font-medium text-neutral-300">
          ID: {customer.id}
        </span>
      </div>

      {/* Profile Header */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-neutral-800 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-white">{customer.fullName}</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" /> Verified Customer
              </span>
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              Registered on {new Date(customer.createdAtUtc).toLocaleDateString()} &bull; Preferred contact:{' '}
              <span className="font-semibold text-neutral-200">{customer.preferredContactMethod || 'Email'}</span>
            </p>
          </div>
        </div>

        {/* Contact and Address */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Email Address:</span>
            <p className="text-xs text-neutral-200 flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-neutral-500" /> {customer.email}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Phone Number:</span>
            <p className="text-xs text-neutral-200 flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-neutral-500" /> {customer.phoneNumber || 'Not provided'}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Registered Address:</span>
            <p className="text-xs text-neutral-200 flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" /> {customer.address || 'Address on record'}
            </p>
          </div>
        </div>
      </div>

      {/* Registered Vehicles Fleet */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
        <h2 className="text-base font-semibold text-white flex items-center gap-2 border-b border-neutral-800 pb-3">
          <CarFront className="h-4 w-4 text-emerald-400" /> Registered Vehicle Fleet ({customer.vehicles.length})
        </h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {customer.vehicles.length === 0 ? (
            <p className="py-6 text-center text-xs text-neutral-500 col-span-3">No vehicles registered.</p>
          ) : (
            customer.vehicles.map((v) => (
              <div key={v.id} className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-4 space-y-1">
                <span className="text-sm font-bold text-white">{v.make} {v.model} ({v.year})</span>
                <p className="text-xs font-mono font-medium text-emerald-400">{v.licensePlate}</p>
                {v.vin && <p className="text-[10px] font-mono text-neutral-500">VIN: {v.vin}</p>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Service History */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
        <h2 className="text-base font-semibold text-white flex items-center gap-2 border-b border-neutral-800 pb-3">
          <FileText className="h-4 w-4 text-blue-400" /> Service Requests & Job History ({customer.serviceRequests.length})
        </h2>
        <div className="mt-4 divide-y divide-neutral-800">
          {customer.serviceRequests.length === 0 ? (
            <p className="py-6 text-center text-xs text-neutral-500">No service requests recorded for this customer.</p>
          ) : (
            customer.serviceRequests.map((req) => (
              <div key={req.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <Link href={`/admin/requests/${req.id}`} className="font-mono font-semibold text-white hover:text-red-400">
                    {req.requestNumber}
                  </Link>
                  <p className="text-[11px] text-neutral-400">
                    {req.vehicleMake} {req.vehicleModel} &bull; {req.quotesReceivedCount} quote(s) received
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="rounded bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-300">
                    {req.status}
                  </span>
                  <Link
                    href={`/admin/requests/${req.id}`}
                    className="rounded bg-neutral-800 p-1.5 text-neutral-300 hover:bg-neutral-700 hover:text-white"
                    title="View Timeline"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
