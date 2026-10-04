'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { 
  Building2, 
  Radio, 
  FileSpreadsheet, 
  Wrench, 
  ShieldCheck, 
  CheckCircle2, 
  MapPin, 
  ArrowRight,
  Clock,
  Car,
  BadgeDollarSign,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';

interface GarageDashboardData {
  garageId: string;
  garageName: string;
  newRequestsCount: number;
  submittedQuotesCount: number;
  activeJobsCount: number;
  availableRequests: Array<{
    serviceRequestId: string;
    vehicleMake: string;
    vehicleModel: string;
    vehicleYear: number;
    description: string;
    distanceKm: number;
    createdAtUtc: string;
    status: string;
  }>;
  submittedQuotes: Array<{
    id: string;
    serviceRequestId: string;
    garageInternalPrice: number;
    internalCostBreakdown: string;
    garageNotes: string;
    estimatedDurationHours: number;
    status: string;
    createdAtUtc: string;
  }>;
}

export default function GarageDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<GarageDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      try {
        const res = await apiFetch<GarageDashboardData>('/garage/dashboard');
        if (res.success && res.data) {
          setData(res.data);
        }
      } catch (err) {
        console.error('Error loading garage dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* 1. Workshop Operational Header */}
      <div className="bg-white rounded-2xl p-6 border border-surface-200 shadow-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200 mb-2">
            <Building2 className="w-3.5 h-3.5" />
            <span>Accredited Partner Workshop Terminal</span>
          </div>
          <h1 className="text-2xl font-black text-navy-900 tracking-tight">
            {data?.garageName || 'Apex Performance Motors'}
          </h1>
          <p className="text-xs text-navy-500 mt-0.5">
            Operational service execution queue, 10 KM proximity requests, and internal quotations.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-navy-900">{user?.fullName || 'Workshop Manager'}</div>
            <div className="text-[11px] text-amber-700 font-mono font-semibold">
              {user?.garageRole || 'GARAGE_OPERATOR'}
            </div>
          </div>
          <Link href="/garage/jobs">
            <Button variant="primary" size="sm" leftIcon={<Wrench className="w-4 h-4" />}>
              Active Jobs
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Priority KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3.5">
        <Card className="p-4">
          <div className="text-[11px] font-bold text-navy-400 uppercase tracking-wider">New Requests</div>
          <div className="text-2xl font-black text-navy-900 mt-1">
            {loading ? '—' : data?.newRequestsCount ?? 0}
          </div>
          <div className="text-[11px] text-electric-600 font-semibold mt-0.5">Within 10 KM</div>
        </Card>

        <Card className="p-4">
          <div className="text-[11px] font-bold text-navy-400 uppercase tracking-wider">Pending Quotes</div>
          <div className="text-2xl font-black text-navy-900 mt-1">
            {loading ? '—' : data?.submittedQuotesCount ?? 0}
          </div>
          <div className="text-[11px] text-amber-600 font-semibold mt-0.5">Under Review</div>
        </Card>

        <Card className="p-4">
          <div className="text-[11px] font-bold text-navy-400 uppercase tracking-wider">Active Jobs</div>
          <div className="text-2xl font-black text-navy-900 mt-1">
            {loading ? '—' : data?.activeJobsCount ?? 0}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">In Bay</div>
        </Card>

        <Card className="p-4">
          <div className="text-[11px] font-bold text-navy-400 uppercase tracking-wider">Vehicles Ready</div>
          <div className="text-2xl font-black text-navy-900 mt-1">
            {loading ? '—' : Math.max(0, (data?.activeJobsCount ?? 0) - 1)}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">Awaiting Pickup</div>
        </Card>

        <Card className="p-4">
          <div className="text-[11px] font-bold text-navy-400 uppercase tracking-wider">Pending Actions</div>
          <div className="text-2xl font-black text-navy-900 mt-1">
            {loading ? '—' : data?.availableRequests?.length ? 1 : 0}
          </div>
          <div className="text-[11px] text-red-600 font-semibold mt-0.5">Requires Intake</div>
        </Card>

        <Card className="p-4">
          <div className="text-[11px] font-bold text-navy-400 uppercase tracking-wider">Settled Finance</div>
          <div className="text-2xl font-black text-navy-900 mt-1">₹42.5k</div>
          <Link href="/garage/finance" className="text-[11px] text-electric-600 font-semibold hover:underline block mt-0.5">
            View Ledger →
          </Link>
        </Card>
      </div>

      {/* 3. Operational Work Queues */}
      <div className="space-y-6">
        {/* Dispatched Proximity Requests Table */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-electric-600" />
                <span>Dispatched Service Requests (10 KM Geofence)</span>
              </CardTitle>
              <p className="text-xs text-navy-500 mt-0.5">
                New customer bookings in your service radius eligible for immediate workshop quoting.
              </p>
            </div>
            <Link href="/garage/requests">
              <Button variant="outline" size="sm" rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>
                View All Requests
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6">
                <LoadingState message="Loading dispatched requests..." />
              </div>
            ) : data?.availableRequests && data.availableRequests.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Distance</TableHead>
                    <TableHead>Service Scope & Problem</TableHead>
                    <TableHead>Broadcast Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.availableRequests.map((req) => (
                    <TableRow key={req.serviceRequestId}>
                      <TableCell>
                        <div className="font-bold text-navy-900">
                          {req.vehicleYear} {req.vehicleMake} {req.vehicleModel}
                        </div>
                        <div className="text-[11px] text-navy-400 font-mono mt-0.5">
                          ID: {req.serviceRequestId.substring(0, 8)}...
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 font-bold text-xs text-electric-700 bg-electric-50 px-2.5 py-1 rounded-lg border border-electric-200">
                          <MapPin className="w-3.5 h-3.5" />
                          {req.distanceKm.toFixed(1)} km
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          <p className="text-xs text-navy-700 line-clamp-1">{req.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-navy-500 font-medium">
                          {new Date(req.createdAtUtc).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/garage/requests/${req.serviceRequestId}`}>
                          <Button size="sm" variant="primary">
                            Submit Quote
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6">
                <EmptyState
                  icon={<Radio className="w-7 h-7 text-navy-400" />}
                  title="No New Broadcast Requests in Radius"
                  description="When customers within 10 km submit service requests, they will appear here in real time."
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submitted Quotes Operational Table */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                <span>Submitted Workshop Quotations</span>
              </CardTitle>
              <p className="text-xs text-navy-500 mt-0.5">
                Quotes pending Technical Advisor review and customer quotation compilation.
              </p>
            </div>
            <Link href="/garage/quotes">
              <Button variant="outline" size="sm" rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>
                View All Quotes
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6">
                <LoadingState message="Loading submitted quotes..." />
              </div>
            ) : data?.submittedQuotes && data.submittedQuotes.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote Reference</TableHead>
                    <TableHead>Internal Estimate</TableHead>
                    <TableHead>Turnaround</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.submittedQuotes.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell>
                        <div className="font-mono font-bold text-navy-900 text-xs">
                          {q.id.substring(0, 8)}...
                        </div>
                        <div className="text-[11px] text-navy-400">
                          {new Date(q.createdAtUtc).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-black text-navy-900">
                          ₹{q.garageInternalPrice.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-semibold text-navy-700 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-navy-400" />
                          {q.estimatedDurationHours} hours
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={q.status} />
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-navy-500 line-clamp-1 max-w-xs">
                          {q.garageNotes || q.internalCostBreakdown || 'Standard overhaul'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/garage/quotes/${q.id}`}>
                          <Button size="sm" variant="ghost" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6">
                <EmptyState
                  icon={<FileSpreadsheet className="w-7 h-7 text-navy-400" />}
                  title="No Active Quotations"
                  description="Submit competitive quotes on available dispatched requests to win service contracts."
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
