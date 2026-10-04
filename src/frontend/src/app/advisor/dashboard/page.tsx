'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { AttentionItem } from '@/types/adminOperations';
import { 
  Inbox, 
  Calculator, 
  CheckSquare, 
  ShieldCheck, 
  Clock, 
  ArrowRight, 
  Wrench, 
  AlertTriangle, 
  UserCheck, 
  CheckCircle2, 
  ListTodo, 
  RefreshCw,
  FileSpreadsheet,
  Layers,
  ChevronRight
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';

interface AdvisorDashboardData {
  assignedRequestsCount: number;
  pendingQuoteReviewsCount: number;
  awaitingCustomerDecisionCount: number;
  activeServiceJobsCount: number;
  additionalWorkPendingReviewCount: number;
  completedJobsThisMonth: number;
  priorityAttentionItems: AttentionItem[];
}

export default function AdvisorDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AdvisorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async () => {
    setRefreshing(true);
    try {
      const res = await apiFetch<AdvisorDashboardData>('/advisor/dashboard');
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Error fetching advisor dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return <LoadingState message="Loading Technical Advisor Console..." />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* 1. Header Command Bar */}
      <div className="bg-white rounded-2xl p-6 border border-surface-200 shadow-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-electric-50 text-electric-700 text-xs font-bold border border-electric-200 mb-2">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Technical Review Duty • Verified Advisor Console</span>
          </div>
          <h1 className="text-2xl font-black text-navy-900 tracking-tight">
            Advisor Operational Command Center
          </h1>
          <p className="text-xs text-navy-500 mt-0.5">
            Logged in as <strong className="text-navy-800">{user?.fullName || 'Advisor'}</strong>. Oversee quote curations, markup models, garage assignments, and execution milestones.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboard}
            isLoading={refreshing}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Data
          </Button>
          <Link href="/advisor/work-queue">
            <Button variant="primary" size="sm" leftIcon={<ListTodo className="w-4 h-4" />}>
              Open Work Queue
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Key Triage KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <Card hoverEffect className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-navy-400 uppercase tracking-wider">
              Pending Quote Reviews
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-navy-900 mt-2">
            {data?.pendingQuoteReviewsCount ?? 0}
          </div>
          <div className="text-xs text-navy-500 mt-1">Workshop proposals awaiting audit</div>
          <Link
            href="/advisor/quotes"
            className="text-xs font-bold text-electric-600 hover:text-electric-700 flex items-center gap-1 mt-3"
          >
            <span>Audit workshop quotes</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </Card>

        <Card hoverEffect className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-navy-400 uppercase tracking-wider">
              Active Service Jobs
            </span>
            <div className="w-9 h-9 rounded-xl bg-electric-50 text-electric-600 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-navy-900 mt-2">
            {data?.activeServiceJobsCount ?? 0}
          </div>
          <div className="text-xs text-navy-500 mt-1">In workshop bays across territory</div>
          <Link
            href="/advisor/jobs"
            className="text-xs font-bold text-electric-600 hover:text-electric-700 flex items-center gap-1 mt-3"
          >
            <span>Monitor active bays</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </Card>

        <Card hoverEffect className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-navy-400 uppercase tracking-wider">
              Awaiting Customer Decisions
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-navy-900 mt-2">
            {data?.awaitingCustomerDecisionCount ?? 0}
          </div>
          <div className="text-xs text-navy-500 mt-1">Sanitized customer proposals dispatched</div>
          <Link
            href="/advisor/requests"
            className="text-xs font-bold text-electric-600 hover:text-electric-700 flex items-center gap-1 mt-3"
          >
            <span>View proposals</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </Card>
      </div>

      {/* 3. Priority Attention Triage Queue */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Priority Attention & Action Items</span>
            </CardTitle>
            <p className="text-xs text-navy-500 mt-0.5">
              Service requests requiring triage, garage reassignment, or customer escalation.
            </p>
          </div>
          <Link href="/advisor/work-queue">
            <Button variant="outline" size="sm">
              Full Triage Queue
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {data?.priorityAttentionItems && data.priorityAttentionItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Reference</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Summary & Context</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.priorityAttentionItems.map((item, idx) => (
                  <TableRow key={item.referenceId || idx}>
                    <TableCell>
                      <span className="font-mono font-bold text-xs text-navy-900">
                        {item.referenceNumber || item.referenceId?.substring(0, 8)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-semibold text-navy-800">
                        {item.category || 'Quote Review'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-navy-700 line-clamp-1 max-w-md">
                        <span className="font-medium text-navy-900">{item.title}</span> - {item.description}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={item.severity === 'CRITICAL' ? 'red' : item.severity === 'WARNING' ? 'amber' : 'blue'}
                        dot
                      >
                        {item.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={item.actionUrl || '/advisor/work-queue'}>
                        <Button size="sm" variant="primary">
                          Triage
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
                icon={<CheckCircle2 className="w-7 h-7 text-emerald-600" />}
                title="All Operational Queues Clear"
                description="No urgent service requests or quotation reviews are currently blocked."
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
