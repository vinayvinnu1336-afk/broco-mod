'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { 
  Car, 
  FileText, 
  BadgeDollarSign, 
  PlusCircle, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  Calendar,
  CreditCard,
  Receipt,
  Wrench,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Timeline, TimelineItem } from '@/components/ui/Timeline';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';

interface CustomerDashboardData {
  customerId: string;
  customerName: string;
  activeRequestsCount: number;
  availableQuotesCount: number;
  registeredVehiclesCount: number;
  recentRequests: Array<{
    id: string;
    vehicleMake: string;
    vehicleModel: string;
    vehicleYear: number;
    description: string;
    status: string;
    createdAtUtc: string;
    quotesReceivedCount: number;
  }>;
  pendingQuotes: Array<{
    id: string;
    serviceRequestId: string;
    vehicleSummary: string;
    customerFacingPrice: number;
    scopeSummary: string;
    status: string;
    createdAtUtc: string;
  }>;
}

export default function CustomerDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<CustomerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<CustomerDashboardData>('/customer/dashboard');
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.message || 'Unable to load dashboard data.');
      }
    } catch (err: unknown) {
      setError('Unable to load dashboard data right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // Determine active service from recent requests
  const activeService = data?.recentRequests?.find(
    (r) =>
      r.status !== 'COMPLETED' &&
      r.status !== 'CANCELLED' &&
      r.status !== 'CLOSED' &&
      r.status !== 'HANDED_OVER'
  ) || data?.recentRequests?.[0];

  // Visual Service Progress Tracking Milestones
  const serviceStages = [
    { key: 'CONFIRMED', title: 'Booking Confirmed' },
    { key: 'SCHEDULED', title: 'Vehicle Scheduled' },
    { key: 'VEHICLE_RECEIVED', title: 'Vehicle Received' },
    { key: 'INSPECTION', title: 'Inspection' },
    { key: 'WORK_STARTED', title: 'Work Started' },
    { key: 'WORK_IN_PROGRESS', title: 'Work In Progress' },
    { key: 'VEHICLE_READY', title: 'Vehicle Ready' },
    { key: 'HANDED_OVER', title: 'Handed Over' },
  ];

  const getTimelineItems = (currentStatus?: string): TimelineItem[] => {
    const norm = (currentStatus || 'CONFIRMED').toUpperCase();
    let currentIdx = 0;

    if (norm === 'HANDED_OVER' || norm === 'CLOSED' || norm === 'COMPLETED') currentIdx = 7;
    else if (norm === 'VEHICLE_READY' || norm === 'READY') currentIdx = 6;
    else if (norm === 'WORK_IN_PROGRESS' || norm === 'IN_PROGRESS') currentIdx = 5;
    else if (norm === 'WORK_STARTED') currentIdx = 4;
    else if (norm === 'INSPECTION') currentIdx = 3;
    else if (norm === 'VEHICLE_RECEIVED') currentIdx = 2;
    else if (norm === 'SCHEDULED' || norm === 'ASSIGNED') currentIdx = 1;
    else currentIdx = 0;

    return serviceStages.map((st, i) => {
      let status: 'completed' | 'current' | 'upcoming' = 'upcoming';
      if (i < currentIdx) status = 'completed';
      else if (i === currentIdx) status = 'current';

      return {
        id: st.key,
        title: st.title,
        status,
      };
    });
  };

  if (loading) {
    return <LoadingState message="Loading your customer dashboard..." />;
  }

  if (error && !data) {
    return <ErrorState title="Dashboard Error" error={error} onRetry={loadDashboard} />;
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Quick Actions */}
      <div className="bg-white rounded-2xl p-6 border border-surface-200 shadow-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-electric-50 text-electric-700 text-xs font-bold border border-electric-200 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verified Customer Account</span>
          </div>
          <h1 className="text-2xl font-black text-navy-900 tracking-tight">
            Welcome, {user?.fullName || data?.customerName || 'Valued Client'}
          </h1>
          <p className="text-xs text-navy-500 mt-1">
            Track your vehicle maintenance milestones, compare curated quotations, and manage invoices.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link href="/customer/vehicles">
            <Button variant="outline" size="sm" leftIcon={<Car className="w-4 h-4" />}>
              My Vehicles
            </Button>
          </Link>
          <Link href="/customer/requests/new">
            <Button variant="primary" size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
              Book Service
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Active Service Visual Tracking Section */}
      {activeService ? (
        <Card className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-surface-200 pb-4 mb-6 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-electric-600">
                  Active Service Tracking
                </span>
                <StatusBadge status={activeService.status} />
              </div>
              <h2 className="text-xl font-black text-navy-900 mt-1">
                {activeService.vehicleYear} {activeService.vehicleMake} {activeService.vehicleModel}
              </h2>
              <p className="text-xs text-navy-500 mt-0.5 line-clamp-1">
                {activeService.description}
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs bg-surface-50 px-4 py-2.5 rounded-xl border border-surface-200">
              <div>
                <span className="text-navy-400 block font-semibold">Estimated Ready:</span>
                <span className="font-bold text-navy-900 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-electric-600" />
                  <span>Today, 5:30 PM</span>
                </span>
              </div>
              <div className="pl-4 border-l border-surface-200">
                <span className="text-navy-400 block font-semibold">Payment Status:</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Escrow Active</span>
                </span>
              </div>
              <Link href={`/customer/requests/${activeService.id}`}>
                <Button size="sm" variant="outline">
                  Details
                </Button>
              </Link>
            </div>
          </div>

          {/* Visual Progress Stepper/Timeline */}
          <div className="pt-2">
            <div className="text-xs font-bold text-navy-700 uppercase tracking-wider mb-2">
              Service Execution Lifecycle
            </div>
            <Timeline items={getTimelineItems(activeService.status)} orientation="horizontal" />
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center bg-gradient-to-r from-electric-50/50 to-white">
          <div className="w-12 h-12 rounded-2xl bg-electric-100 text-electric-600 flex items-center justify-center mx-auto mb-3">
            <Car className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-navy-900">No Active Service Running</h3>
          <p className="text-xs text-navy-500 max-w-sm mx-auto mt-1 mb-4">
            Book a service for your vehicle to receive competitive quotes from verified workshops within 10 KM.
          </p>
          <Link href="/customer/requests/new">
            <Button size="sm" variant="primary" leftIcon={<PlusCircle className="w-4 h-4" />}>
              Book a Service
            </Button>
          </Link>
        </Card>
      )}

      {/* 3. KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="p-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-navy-500 uppercase tracking-wider">
              Registered Vehicles
            </div>
            <div className="text-3xl font-black text-navy-900 mt-1">
              {data?.registeredVehiclesCount ?? 0}
            </div>
            <Link
              href="/customer/vehicles"
              className="text-xs text-electric-600 font-semibold hover:underline flex items-center gap-1 mt-1"
            >
              <span>Manage fleet</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-electric-50 text-electric-600 flex items-center justify-center">
            <Car className="w-6 h-6" />
          </div>
        </Card>

        <Card className="p-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-navy-500 uppercase tracking-wider">
              Service Requests
            </div>
            <div className="text-3xl font-black text-navy-900 mt-1">
              {data?.activeRequestsCount ?? 0}
            </div>
            <div className="text-xs text-navy-500 mt-1">10 KM Proximity Matched</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
        </Card>

        <Card className="p-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-navy-500 uppercase tracking-wider">
              Approved Quotations
            </div>
            <div className="text-3xl font-black text-navy-900 mt-1">
              {data?.availableQuotesCount ?? 0}
            </div>
            <Link
              href="/customer/quotes"
              className="text-xs text-electric-600 font-semibold hover:underline flex items-center gap-1 mt-1"
            >
              <span>Review decisions</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <BadgeDollarSign className="w-6 h-6" />
          </div>
        </Card>
      </div>

      {/* 4. Split Section: Recent Service History & Pending Quotations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Requests / History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-electric-600" />
              <span>Service Request History</span>
            </CardTitle>
            <Link
              href="/customer/requests"
              className="text-xs font-bold text-electric-600 hover:text-electric-700 flex items-center gap-1"
            >
              <span>View all</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {data?.recentRequests && data.recentRequests.length > 0 ? (
              <div className="divide-y divide-surface-200">
                {data.recentRequests.map((req) => (
                  <Link
                    key={req.id}
                    href={`/customer/requests/${req.id}`}
                    className="p-4 flex items-center justify-between hover:bg-surface-50 transition-colors group block"
                  >
                    <div>
                      <div className="text-sm font-bold text-navy-900 group-hover:text-electric-600 transition-colors">
                        {req.vehicleYear} {req.vehicleMake} {req.vehicleModel}
                      </div>
                      <div className="text-xs text-navy-500 line-clamp-1 mt-0.5">
                        {req.description}
                      </div>
                      <div className="text-[11px] text-navy-400 mt-1 flex items-center gap-2">
                        <span>{new Date(req.createdAtUtc).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{req.quotesReceivedCount} garage quotes submitted</span>
                      </div>
                    </div>
                    <StatusBadge status={req.status} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-6">
                <EmptyState
                  title="No Service Requests Yet"
                  description="Submit your first service request to connect with accredited workshops."
                  action={
                    <Link href="/customer/requests/new">
                      <Button size="sm" variant="primary">
                        Book a Service
                      </Button>
                    </Link>
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Quotations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BadgeDollarSign className="w-4 h-4 text-amber-600" />
              <span>Pending Customer Quotations</span>
            </CardTitle>
            <Link
              href="/customer/quotes"
              className="text-xs font-bold text-electric-600 hover:text-electric-700 flex items-center gap-1"
            >
              <span>View all</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-3.5 bg-electric-50/60 border-b border-surface-200 text-xs text-navy-700 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-electric-600 shrink-0 mt-0.5" />
              <span>
                <strong>Guaranteed Pricing:</strong> Quotations below are vetted by your Advisor with transparent parts and labor. Internal workshop costs remain isolated.
              </span>
            </div>

            {data?.pendingQuotes && data.pendingQuotes.length > 0 ? (
              <div className="divide-y divide-surface-200">
                {data.pendingQuotes.map((q) => (
                  <Link
                    key={q.id}
                    href={`/customer/quotes/${q.id}`}
                    className="p-4 flex items-center justify-between hover:bg-surface-50 transition-colors group block"
                  >
                    <div>
                      <div className="text-sm font-bold text-navy-900 group-hover:text-electric-600 transition-colors">
                        {q.vehicleSummary}
                      </div>
                      <div className="text-xs text-navy-500 line-clamp-1 mt-0.5">
                        {q.scopeSummary}
                      </div>
                      <div className="text-[11px] text-navy-400 mt-1">
                        Issued: {new Date(q.createdAtUtc).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black text-navy-900">
                        ${q.customerFacingPrice.toFixed(2)}
                      </div>
                      <StatusBadge status={q.status} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-6">
                <EmptyState
                  title="No Quotations Awaiting Review"
                  description="Once workshops submit bids and our service advisor finalizes your quote, it will appear here."
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
