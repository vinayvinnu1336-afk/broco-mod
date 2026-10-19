'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { SystemHealth } from '@/types/adminOperations';
import { Activity, AlertTriangle, CheckCircle2, Clock, Cpu, Database, MapPin, RefreshCw, Server, XCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { IconTile, ListGroup, ListItem } from '@/components/ui/ListItem';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDateTime } from '@/lib/format';
import { IntegrationsSection } from './IntegrationsSection';

// The API returns { status, latencyMs, error } per component (plus version / notes / activeJobsCount);
// the older boolean fields from `SystemHealth` are still read when present.
interface ComponentHealth {
  status?: string;
  latencyMs?: number;
  error?: string | null;
  version?: string | null;
  notes?: string | null;
  activeJobsCount?: number;
  canConnect?: boolean;
  isConnected?: boolean;
  isInstalled?: boolean;
  isHealthy?: boolean;
  activeWorkerCount?: number;
}

interface HealthView {
  overallStatus?: string;
  timestampUtc?: string;
  uptime?: unknown;
  processMemoryBytes?: number;
  database?: ComponentHealth;
  postGis?: ComponentHealth;
  redis?: ComponentHealth;
  backgroundWorkers?: ComponentHealth;
}

type Tone = 'green' | 'amber' | 'red' | 'neutral';

function toneFor(status?: string): Tone {
  const s = (status ?? '').toLowerCase();
  if (s === 'healthy' || s === 'connected' || s === 'installed') return 'green';
  if (s === 'degraded') return 'amber';
  if (!s) return 'neutral';
  return 'red';
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** .NET TimeSpan JSON ("1.02:03:04.5678" or "02:03:04") -> "1 d 2 h" / "2 h 3 min". */
function formatUptime(value: unknown): string {
  if (typeof value !== 'string') return '—';
  const match = value.match(/^(?:(\d+)\.)?(\d{1,2}):(\d{2}):(\d{2})/);
  if (!match) return value;
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

const latency = (ms?: number) => (typeof ms === 'number' ? `Responded in ${Math.max(1, Math.round(ms))} ms` : undefined);

const OVERALL_COPY: Record<Tone, { title: string; body: string; icon: React.ElementType }> = {
  green: { title: 'Everything is working', body: 'All services responded normally.', icon: CheckCircle2 },
  amber: { title: 'Some services are slow or unavailable', body: 'The platform is up, but one or more services need attention.', icon: AlertTriangle },
  red: { title: 'Something is down', body: 'A core service is not responding. Most screens may fail until it is back.', icon: XCircle },
  neutral: { title: 'Status unknown', body: 'The server did not report an overall status.', icon: Activity },
};

export default function AdminSystemHealthPage() {
  const [health, setHealth] = useState<HealthView | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    setRefreshing(true);
    const res = await apiFetch<SystemHealth>('/admin/system-health');
    if (res.success && res.data) {
      setHealth(res.data as unknown as HealthView);
      setLoadError(null);
    } else {
      setLoadError(res.message || 'Could not check system health.');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const overallTone = toneFor(health?.overallStatus);
  const overall = OVERALL_COPY[overallTone];

  const db = health?.database;
  const geo = health?.postGis;
  const cache = health?.redis;
  const workers = health?.backgroundWorkers;
  const workerJobs = workers?.activeJobsCount ?? workers?.activeWorkerCount;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="System health"
        description="Live check of the database, map search, cache, background jobs and integrations."
        actions={
          <Button variant="outline" onClick={loadHealth} isLoading={refreshing} leftIcon={<RefreshCw className="h-4 w-4" />}>
            Check again
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-20 rounded-2xl" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[92px] rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : !health ? (
        <ErrorState title="Health check failed" error={loadError} onRetry={loadHealth} />
      ) : (
        <>
          <Card className="flex items-start gap-3 p-4 sm:p-5">
            <IconTile icon={overall.icon} tone={overallTone} />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-navy-900">{overall.title}</h2>
              <p className="mt-0.5 text-sm text-navy-500">{overall.body}</p>
            </div>
            {health.overallStatus && <StatusBadge status={health.overallStatus} className="hidden sm:inline-flex" />}
          </Card>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard label="Server running for" value={formatUptime(health.uptime)} icon={Clock} tone="blue" />
            <StatCard label="Server memory in use" value={formatBytes(health.processMemoryBytes)} icon={Cpu} tone="neutral" />
            <StatCard
              label="Last checked"
              value={<span className="text-lg">{formatDateTime(health.timestampUtc)}</span>}
              icon={Activity}
              tone="neutral"
              className="col-span-2 lg:col-span-1"
            />
          </div>

          <ListGroup title="Services">
            <ListItem
              leading={<IconTile icon={Database} tone={toneFor(db?.status)} />}
              title="Database"
              subtitle={<span className="whitespace-normal">{db?.error || latency(db?.latencyMs) || 'No details reported'}</span>}
              trailing={db?.status ? <StatusBadge status={db.status} /> : undefined}
            />
            <ListItem
              leading={<IconTile icon={MapPin} tone={toneFor(geo?.status)} />}
              title="Map search (PostGIS)"
              subtitle={
                <span className="whitespace-normal break-words">
                  {geo?.error || geo?.version || 'Used to find garages near a customer'}
                </span>
              }
              trailing={geo?.status ? <StatusBadge status={geo.status} /> : undefined}
            />
            <ListItem
              leading={<IconTile icon={Zap} tone={toneFor(cache?.status)} />}
              title="Cache (Redis)"
              subtitle={<span className="whitespace-normal break-words">{cache?.error || latency(cache?.latencyMs) || 'No details reported'}</span>}
              meta="If the cache is down the app falls back to slower in-memory storage."
              trailing={cache?.status ? <StatusBadge status={cache.status} /> : undefined}
            />
            <ListItem
              leading={<IconTile icon={Server} tone={toneFor(workers?.status)} />}
              title="Background jobs"
              subtitle={<span className="whitespace-normal">{workers?.notes || 'Quote expiry and notification sending'}</span>}
              meta={typeof workerJobs === 'number' ? `${workerJobs} service ${workerJobs === 1 ? 'job' : 'jobs'} in progress` : undefined}
              trailing={workers?.status ? <StatusBadge status={workers.status} /> : undefined}
            />
          </ListGroup>

          <IntegrationsSection />

          {loadError && (
            <p role="alert" className="px-1 text-sm text-red-600">
              The last check failed ({loadError}). Showing the previous result.
            </p>
          )}
        </>
      )}
    </div>
  );
}
