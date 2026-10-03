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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> {status}
          </span>
        );
      case 'Degraded':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" /> {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-400">
            <XCircle className="h-3.5 w-3.5" /> {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">System Infrastructure & Health</h1>
            {health && getStatusBadge(health.overallStatus)}
          </div>
          <p className="mt-1 text-sm text-neutral-400">
            Real-time telemetry and availability verification for PostgreSQL, PostGIS, Redis, and backend processes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadHealth}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3.5 py-2 text-sm font-medium text-neutral-200 transition hover:bg-neutral-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Telemetry
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            <p className="text-sm text-neutral-400">Pinging infrastructure components...</p>
          </div>
        </div>
      ) : !health ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
          <p className="text-sm text-rose-300">Unable to retrieve system health metrics.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
              <span className="text-xs text-neutral-400 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-blue-400" /> Process Uptime
              </span>
              <p className="mt-2 text-xl font-bold font-mono text-white">{health.uptime}</p>
              <p className="mt-1 text-[11px] text-neutral-500">Continuous operation</p>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
              <span className="text-xs text-neutral-400 flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-purple-400" /> Process Working Set
              </span>
              <p className="mt-2 text-xl font-bold font-mono text-white">
                {formatBytes(health.processMemoryBytes)}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">Managed runtime memory</p>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
              <span className="text-xs text-neutral-400 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-emerald-400" /> Last Checked
              </span>
              <p className="mt-2 text-sm font-bold font-mono text-white">
                {new Date(health.timestampUtc).toLocaleTimeString()}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">UTC System Timestamp</p>
            </div>
          </div>

          {/* Component Health Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* PostgreSQL Database */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <Database className="h-5 w-5 text-blue-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">PostgreSQL 16</h3>
                    <p className="text-[11px] text-neutral-500">Relational Persistence Engine</p>
                  </div>
                </div>
                {getStatusBadge(health.database.status)}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded border border-neutral-800 bg-neutral-950/60 p-3">
                  <span className="text-neutral-500">Connection:</span>
                  <p className="font-semibold text-white mt-0.5">
                    {health.database.canConnect ? 'Can Connect' : 'Connection Failed'}
                  </p>
                </div>
                <div className="rounded border border-neutral-800 bg-neutral-950/60 p-3">
                  <span className="text-neutral-500">Query Latency:</span>
                  <p className="font-mono font-semibold text-emerald-400 mt-0.5">
                    {health.database.latencyMs} ms
                  </p>
                </div>
              </div>
            </div>

            {/* PostGIS Spatial Extension */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <HardDrive className="h-5 w-5 text-emerald-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">PostGIS 3.4</h3>
                    <p className="text-[11px] text-neutral-500">Spatial Proximity & Geodesic Indexing</p>
                  </div>
                </div>
                {getStatusBadge(health.postGis.status)}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded border border-neutral-800 bg-neutral-950/60 p-3">
                  <span className="text-neutral-500">Extension State:</span>
                  <p className="font-semibold text-white mt-0.5">
                    {health.postGis.isInstalled ? 'Enabled & Indexed' : 'Not Installed'}
                  </p>
                </div>
                <div className="rounded border border-neutral-800 bg-neutral-950/60 p-3">
                  <span className="text-neutral-500">Version String:</span>
                  <p className="font-mono text-[11px] text-neutral-300 mt-0.5 truncate">
                    {health.postGis.version || 'PostGIS 3.4'}
                  </p>
                </div>
              </div>
            </div>

            {/* Redis Cache */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <Zap className="h-5 w-5 text-amber-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Redis 7</h3>
                    <p className="text-[11px] text-neutral-500">Session & In-Memory Cache</p>
                  </div>
                </div>
                {getStatusBadge(health.redis.status)}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded border border-neutral-800 bg-neutral-950/60 p-3">
                  <span className="text-neutral-500">Connection:</span>
                  <p className="font-semibold text-white mt-0.5">
                    {health.redis.isConnected ? 'Connected' : 'Disconnected'}
                  </p>
                </div>
                <div className="rounded border border-neutral-800 bg-neutral-950/60 p-3">
                  <span className="text-neutral-500">Ping Latency:</span>
                  <p className="font-mono font-semibold text-emerald-400 mt-0.5">
                    {health.redis.latencyMs} ms
                  </p>
                </div>
              </div>
            </div>

            {/* Background Workers */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <Server className="h-5 w-5 text-purple-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Background Workers</h3>
                    <p className="text-[11px] text-neutral-500">Hosted Task Processors</p>
                  </div>
                </div>
                {getStatusBadge(health.backgroundWorkers.status)}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded border border-neutral-800 bg-neutral-950/60 p-3">
                  <span className="text-neutral-500">Health State:</span>
                  <p className="font-semibold text-white mt-0.5">
                    {health.backgroundWorkers.isHealthy ? 'Healthy' : 'Stopped'}
                  </p>
                </div>
                <div className="rounded border border-neutral-800 bg-neutral-950/60 p-3">
                  <span className="text-neutral-500">Active Workers:</span>
                  <p className="font-mono font-semibold text-white mt-0.5">
                    {health.backgroundWorkers.activeWorkerCount}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
