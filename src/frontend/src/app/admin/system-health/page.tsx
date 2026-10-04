'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { SystemHealth } from '@/types/adminOperations';
import {
  Activity,
  Database,
  Cpu,
  Server,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Clock,
  HardDrive
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';

export default function AdminSystemHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHealth = async () => {
    setRefreshing(true);
    const res = await apiFetch<SystemHealth>('/admin/system-health');
    if (res.success && res.data) {
      setHealth(res.data);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadHealth();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Healthy':
      case 'Installed':
      case 'Connected':
        return (
          <Badge variant="green" icon={CheckCircle2}>
            {status}
          </Badge>
        );
      case 'Degraded':
        return (
          <Badge variant="amber" icon={AlertTriangle}>
            {status}
          </Badge>
        );
      default:
        return (
          <Badge variant="red" icon={XCircle}>
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-navy-900">System Infrastructure & Health</h1>
            {health && getStatusBadge(health.overallStatus)}
          </div>
          <p className="mt-1 text-sm text-navy-600">
            Real-time telemetry and availability verification for PostgreSQL, PostGIS, Redis, and backend processes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadHealth}
            isLoading={refreshing}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh Telemetry
          </Button>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Pinging infrastructure components..." />
      ) : !health ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-sm font-bold text-rose-800">Unable to retrieve system health metrics.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className="p-5">
              <span className="text-xs font-bold text-navy-500 flex items-center gap-1.5 uppercase tracking-wider">
                <Clock className="h-3.5 w-3.5 text-electric-600" /> Process Uptime
              </span>
              <p className="mt-2 text-xl font-bold font-mono text-navy-900">{health.uptime}</p>
              <p className="mt-1 text-[11px] text-navy-500">Continuous operation</p>
            </Card>

            <Card className="p-5">
              <span className="text-xs font-bold text-navy-500 flex items-center gap-1.5 uppercase tracking-wider">
                <Cpu className="h-3.5 w-3.5 text-purple-600" /> Process Working Set
              </span>
              <p className="mt-2 text-xl font-bold font-mono text-navy-900">
                {formatBytes(health.processMemoryBytes)}
              </p>
              <p className="mt-1 text-[11px] text-navy-500">Managed runtime memory</p>
            </Card>

            <Card className="p-5">
              <span className="text-xs font-bold text-navy-500 flex items-center gap-1.5 uppercase tracking-wider">
                <Activity className="h-3.5 w-3.5 text-emerald-600" /> Last Checked
              </span>
              <p className="mt-2 text-sm font-bold font-mono text-navy-900">
                {new Date(health.timestampUtc).toLocaleTimeString()}
              </p>
              <p className="mt-1 text-[11px] text-navy-500">UTC System Timestamp</p>
            </Card>
          </div>

          {/* Component Health Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* PostgreSQL Database */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-surface-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <Database className="h-5 w-5 text-electric-600" />
                  <div>
                    <h3 className="text-sm font-bold text-navy-900">PostgreSQL 16</h3>
                    <p className="text-[11px] text-navy-500">Relational Persistence Engine</p>
                  </div>
                </div>
                {getStatusBadge(health.database.status)}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                  <span className="text-navy-500 font-medium">Connection:</span>
                  <p className="font-bold text-navy-900 mt-0.5">
                    {health.database.canConnect ? 'Can Connect' : 'Connection Failed'}
                  </p>
                </div>
                <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                  <span className="text-navy-500 font-medium">Query Latency:</span>
                  <p className="font-mono font-bold text-emerald-700 mt-0.5">
                    {health.database.latencyMs} ms
                  </p>
                </div>
              </div>
            </Card>

            {/* PostGIS Spatial Extension */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-surface-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <HardDrive className="h-5 w-5 text-emerald-600" />
                  <div>
                    <h3 className="text-sm font-bold text-navy-900">PostGIS 3.4</h3>
                    <p className="text-[11px] text-navy-500">Spatial Proximity & Geodesic Indexing</p>
                  </div>
                </div>
                {getStatusBadge(health.postGis.status)}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                  <span className="text-navy-500 font-medium">Extension State:</span>
                  <p className="font-bold text-navy-900 mt-0.5">
                    {health.postGis.isInstalled ? 'Enabled & Indexed' : 'Not Installed'}
                  </p>
                </div>
                <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                  <span className="text-navy-500 font-medium">Version String:</span>
                  <p className="font-mono text-[11px] font-bold text-navy-800 mt-0.5 truncate">
                    {health.postGis.version || 'PostGIS 3.4'}
                  </p>
                </div>
              </div>
            </Card>

            {/* Redis Cache */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-surface-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <Zap className="h-5 w-5 text-amber-600" />
                  <div>
                    <h3 className="text-sm font-bold text-navy-900">Redis 7</h3>
                    <p className="text-[11px] text-navy-500">Session & In-Memory Cache</p>
                  </div>
                </div>
                {getStatusBadge(health.redis.status)}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                  <span className="text-navy-500 font-medium">Connection:</span>
                  <p className="font-bold text-navy-900 mt-0.5">
                    {health.redis.isConnected ? 'Connected' : 'Disconnected'}
                  </p>
                </div>
                <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                  <span className="text-navy-500 font-medium">Ping Latency:</span>
                  <p className="font-mono font-bold text-emerald-700 mt-0.5">
                    {health.redis.latencyMs} ms
                  </p>
                </div>
              </div>
            </Card>

            {/* Background Workers */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-surface-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <Server className="h-5 w-5 text-purple-600" />
                  <div>
                    <h3 className="text-sm font-bold text-navy-900">Background Workers</h3>
                    <p className="text-[11px] text-navy-500">Hosted Task Processors</p>
                  </div>
                </div>
                {getStatusBadge(health.backgroundWorkers.status)}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                  <span className="text-navy-500 font-medium">Health State:</span>
                  <p className="font-bold text-navy-900 mt-0.5">
                    {health.backgroundWorkers.isHealthy ? 'Healthy' : 'Stopped'}
                  </p>
                </div>
                <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                  <span className="text-navy-500 font-medium">Active Workers:</span>
                  <p className="font-mono font-bold text-navy-900 mt-0.5">
                    {health.backgroundWorkers.activeWorkerCount}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
