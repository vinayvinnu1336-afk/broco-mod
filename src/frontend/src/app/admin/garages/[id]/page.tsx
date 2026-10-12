'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminGarageDetail } from '@/types/adminOperations';
import {
  Briefcase,
  CheckCircle2,
  FileText,
  History,
  Inbox,
  Mail,
  MapPin,
  Phone,
  Trophy,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { IconTile, ListGroup, ListItem } from '@/components/ui/ListItem';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { formatDate, formatDateTime, humanize } from '@/lib/format';

// The API serialises the garage status enum as a number (1-4); names are also accepted.
const GARAGE_STATUS_NAMES: Record<string, string> = {
  '1': 'PendingVerification',
  '2': 'Verified',
  '3': 'Suspended',
  '4': 'Inactive',
};
const garageStatus = (status: unknown): string => {
  const key = String(status ?? '');
  return GARAGE_STATUS_NAMES[key] ?? key;
};

type GarageAction = 'verify' | 'activate' | 'suspend' | 'deactivate';

const ACTION_COPY: Record<GarageAction, { title: string; message: string; confirm: string; done: string }> = {
  verify: {
    title: 'Verify this garage?',
    message: 'Verified garages can receive service requests and send quotes.',
    confirm: 'Verify garage',
    done: 'Garage verified',
  },
  activate: {
    title: 'Reactivate this garage?',
    message: 'The garage will be able to receive service requests again.',
    confirm: 'Reactivate',
    done: 'Garage reactivated',
  },
  suspend: {
    title: 'Suspend this garage?',
    message: 'The garage stops receiving new service requests and quote invitations until you reactivate it.',
    confirm: 'Suspend garage',
    done: 'Garage suspended',
  },
  deactivate: {
    title: 'Deactivate this garage?',
    message: 'The garage is marked inactive and removed from matching. Use this when a garage leaves the network.',
    confirm: 'Deactivate garage',
    done: 'Garage deactivated',
  },
};

const MIN_RADIUS = 1;
const MAX_RADIUS = 50;

export default function AdminGarageDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const toast = useToast();
  const [garage, setGarage] = useState<AdminGarageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Service radius
  const [radiusKm, setRadiusKm] = useState<number>(10.0);
  const [savingRadius, setSavingRadius] = useState(false);
  const [radiusError, setRadiusError] = useState<string | null>(null);

  // Confirmation for verify / reactivate / suspend / deactivate
  const [action, setAction] = useState<GarageAction | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadGarageDetail = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<AdminGarageDetail>(`/admin/garages/${id}`);
    if (res.success && res.data) {
      setGarage(res.data);
      setRadiusKm(res.data.serviceRadiusKm);
      setError(null);
    } else {
      setError(res.message || 'Failed to load garage details.');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadGarageDetail();
  }, [loadGarageDetail]);

  const handleUpdateRadius = async () => {
    if (radiusKm < MIN_RADIUS || radiusKm > MAX_RADIUS) {
      setRadiusError(`Choose a distance between ${MIN_RADIUS} and ${MAX_RADIUS} km.`);
      return;
    }
    setSavingRadius(true);
    setRadiusError(null);

    const res = await apiFetch(`/admin/garages/${id}/radius`, {
      method: 'PUT',
      body: JSON.stringify({ radiusKm }),
    });

    setSavingRadius(false);
    if (res.success) {
      toast.success('Service area updated', `${radiusKm.toFixed(1)} km`);
      loadGarageDetail();
    } else {
      setRadiusError(res.message || 'Could not update the service area.');
    }
  };

  const openAction = (type: GarageAction) => {
    setAction(type);
    setActionReason('');
    setActionError(null);
  };

  const closeAction = () => {
    if (!actionLoading) setAction(null);
  };

  const submitAction = async () => {
    if (!action) return;
    const needsReason = action === 'suspend' || action === 'deactivate';
    if (needsReason && !actionReason.trim()) {
      setActionError('Add a reason for this change.');
      return;
    }

    setActionLoading(true);
    setActionError(null);

    const res = await apiFetch(`/admin/garages/${id}/${action}`, {
      method: 'POST',
      body: JSON.stringify(needsReason ? { reason: actionReason.trim() } : {}),
    });

    setActionLoading(false);

    if (res.success) {
      toast.success(ACTION_COPY[action].done, garage?.name);
      setAction(null);
      setActionReason('');
      loadGarageDetail();
    } else {
      setActionError(res.message || 'That did not work. Please try again.');
    }
  };

  if (loading && !garage) {
    return (
      <div className="space-y-5" aria-busy="true">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-2/3" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-[92px] rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (error || !garage) {
    return (
      <div className="space-y-5">
        <PageHeader title="Garage" backHref="/admin/garages" backLabel="Garages" />
        <ErrorState title="Could not load this garage" error={error || 'Garage not found.'} onRetry={loadGarageDetail} />
      </div>
    );
  }

  const status = garageStatus(garage.status);
  const needsReason = action === 'suspend' || action === 'deactivate';
  const radiusChanged = Math.abs(radiusKm - garage.serviceRadiusKm) > 0.001;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        backHref="/admin/garages"
        backLabel="Garages"
        eyebrow={<StatusBadge status={status} />}
        title={garage.name}
        description={`Joined ${formatDate(garage.createdAtUtc)}`}
        actions={
          <>
            {status === 'PendingVerification' && (
              <Button onClick={() => openAction('verify')} leftIcon={<CheckCircle2 className="h-4 w-4" />}>
                Verify garage
              </Button>
            )}
            {status === 'Suspended' && (
              <Button onClick={() => openAction('activate')} leftIcon={<CheckCircle2 className="h-4 w-4" />}>
                Reactivate
              </Button>
            )}
            {status === 'Verified' && (
              <Button variant="outline" onClick={() => openAction('suspend')}>
                Suspend
              </Button>
            )}
            {status !== 'Inactive' && (
              <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => openAction('deactivate')}>
                Deactivate
              </Button>
            )}
          </>
        }
      />

      {garage.statusReason && (
        <Card className="p-4 sm:p-5">
          <p className="text-sm text-navy-700">
            <span className="font-semibold text-navy-900">Status note: </span>
            {garage.statusReason}
          </p>
          {garage.statusChangedAtUtc && (
            <p className="mt-1 text-xs text-navy-500">Changed {formatDateTime(garage.statusChangedAtUtc)}</p>
          )}
        </Card>
      )}

      {/* Activity numbers */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Requests received" value={garage.totalDispatchesReceived} icon={Inbox} tone="blue" />
        <StatCard label="Quotes sent" value={garage.totalQuotesSubmitted} icon={FileText} tone="blue" />
        <StatCard label="Quotes won" value={garage.totalQuotesWon} icon={Trophy} tone="green" />
        <StatCard label="Win rate" value={`${Math.round(Number(garage.winRatePercentage) || 0)}%`} icon={Trophy} tone="neutral" />
        <StatCard label="Active jobs" value={garage.activeJobsCount} icon={Wrench} tone="amber" />
        <StatCard label="Completed jobs" value={garage.completedJobsCount} icon={Briefcase} tone="green" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        {/* Contact */}
        <ListGroup title="Contact">
          <ListItem
            href={`mailto:${garage.email}`}
            hideChevron
            leading={<IconTile icon={Mail} tone="neutral" />}
            title={garage.email || '—'}
            subtitle="Email"
          />
          <ListItem
            href={garage.phoneNumber ? `tel:${garage.phoneNumber}` : undefined}
            hideChevron
            leading={<IconTile icon={Phone} tone="neutral" />}
            title={garage.phoneNumber || 'Not provided'}
            subtitle="Phone"
          />
          <ListItem
            leading={<IconTile icon={MapPin} tone="neutral" />}
            title={<span className="whitespace-normal">{garage.address || 'No address'}</span>}
            subtitle="Address"
            meta={`Map position ${Number(garage.latitude).toFixed(4)}, ${Number(garage.longitude).toFixed(4)}`}
          />
        </ListGroup>

        {/* Service area */}
        <Card>
          <CardHeader>
            <CardTitle>Service area</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-5">
            <p className="text-sm text-navy-500">
              The garage is offered service requests from customers within this distance.
            </p>
            <div className="flex items-baseline justify-between">
              <label htmlFor="service-radius" className="text-sm font-medium text-navy-800">
                Distance
              </label>
              <span className="text-lg font-bold tabular-nums text-navy-900">{radiusKm.toFixed(1)} km</span>
            </div>
            <input
              id="service-radius"
              type="range"
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              step="0.5"
              value={radiusKm}
              onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
              className="h-11 w-full cursor-pointer accent-electric-600"
            />
            <div className="flex justify-between text-xs text-navy-400">
              <span>{MIN_RADIUS} km</span>
              <span>{MAX_RADIUS} km</span>
            </div>
            {radiusError && (
              <p role="alert" className="text-sm font-medium text-red-600">
                {radiusError}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {radiusChanged && (
                <Button
                  variant="ghost"
                  onClick={() => setRadiusKm(garage.serviceRadiusKm)}
                  disabled={savingRadius}
                  className="w-full sm:w-auto"
                >
                  Reset
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleUpdateRadius}
                disabled={savingRadius || !radiusChanged}
                isLoading={savingRadius}
                className="w-full sm:w-auto"
              >
                Save distance
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent jobs */}
        <ListGroup title="Recent jobs">
          {garage.recentJobs.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-navy-500">No jobs for this garage yet.</p>
          ) : (
            garage.recentJobs.map((j) => (
              <ListItem
                key={j.id}
                leading={<IconTile icon={Wrench} tone="neutral" />}
                title={j.jobNumber}
                subtitle={j.vehicleSummary}
                meta={`Request ${j.requestNumber} · ${formatDate(j.createdAtUtc)}`}
                trailing={<StatusBadge status={j.status} />}
              />
            ))
          )}
        </ListGroup>

        {/* Audit history */}
        <ListGroup title="Change history">
          {garage.auditHistory.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-navy-500">No changes recorded.</p>
          ) : (
            garage.auditHistory.map((evt) => (
              <ListItem
                key={evt.id}
                leading={<IconTile icon={History} tone="neutral" />}
                title={humanize(evt.action)}
                subtitle={evt.details}
                meta={`${evt.userEmail || 'System'} · ${formatDateTime(evt.timestampUtc)}`}
              />
            ))
          )}
        </ListGroup>
      </div>

      <p className="break-all px-1 text-xs text-navy-400">Garage ID {garage.id}</p>

      <ConfirmationDialog
        isOpen={!!action}
        onClose={closeAction}
        onConfirm={submitAction}
        isLoading={actionLoading}
        variant={action === 'deactivate' ? 'danger' : action === 'suspend' ? 'warning' : 'primary'}
        title={action ? ACTION_COPY[action].title.replace('this garage', garage.name) : ''}
        confirmText={action ? ACTION_COPY[action].confirm : 'Confirm'}
        message={
          action && (
            <div className="space-y-3">
              <p>{ACTION_COPY[action].message}</p>
              {needsReason && (
                <Textarea
                  id="garage-action-reason"
                  label="Reason"
                  rows={3}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Why are you doing this?"
                  required
                />
              )}
              {actionError && (
                <p role="alert" className="text-sm font-medium text-red-600">
                  {actionError}
                </p>
              )}
            </div>
          )
        }
      />
    </div>
  );
}
