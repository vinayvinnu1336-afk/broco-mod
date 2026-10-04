'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { AdminGarageDetail } from '@/types/adminOperations';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Clock,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Shield,
  Sliders,
  Wrench,
  Trophy,
  History,
  X,
  Check
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';

export default function AdminGarageDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [garage, setGarage] = useState<AdminGarageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Radius editing state
  const [radiusKm, setRadiusKm] = useState<number>(10.0);
  const [savingRadius, setSavingRadius] = useState(false);
  const [radiusSuccess, setRadiusSuccess] = useState(false);
  const [radiusError, setRadiusError] = useState<string | null>(null);

  // Modal State for Suspend / Deactivate
  const [actionModal, setActionModal] = useState<'suspend' | 'deactivate' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadGarageDetail = async () => {
    setLoading(true);
    const res = await apiFetch<AdminGarageDetail>(`/admin/garages/${id}`);
    if (res.success && res.data) {
      setGarage(res.data);
      setRadiusKm(res.data.serviceRadiusKm);
    } else {
      setError(res.message || 'Failed to load workshop details.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadGarageDetail();
  }, [id]);

  const handleUpdateRadius = async () => {
    if (radiusKm < 1.0 || radiusKm > 50.0) {
      setRadiusError('Radius must be between 1.0 and 50.0 KM.');
      return;
    }
    setSavingRadius(true);
    setRadiusError(null);
    setRadiusSuccess(false);

    const res = await apiFetch(`/admin/garages/${id}/radius`, {
      method: 'PUT',
      body: JSON.stringify({ radiusKm }),
    });

    setSavingRadius(false);
    if (res.success) {
      setRadiusSuccess(true);
      setTimeout(() => setRadiusSuccess(false), 3000);
      loadGarageDetail();
    } else {
      setRadiusError(res.message || 'Failed to update service radius.');
    }
  };

  const handleVerify = async () => {
    if (!confirm('Are you sure you want to verify this partner workshop?')) return;
    const res = await apiFetch(`/admin/garages/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (res.success) {
      loadGarageDetail();
    } else {
      alert(res.message || 'Failed to verify garage');
    }
  };

  const handleActivate = async () => {
    if (!confirm('Are you sure you want to reactivate this workshop?')) return;
    const res = await apiFetch(`/admin/garages/${id}/activate`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (res.success) {
      loadGarageDetail();
    } else {
      alert(res.message || 'Failed to activate garage');
    }
  };

  const submitActionModal = async () => {
    if (!actionModal) return;
    if (!actionReason.trim()) {
      setActionError('Reason is required.');
      return;
    }

    setActionLoading(true);
    setActionError(null);

    const endpoint = actionModal === 'suspend'
      ? `/admin/garages/${id}/suspend`
      : `/admin/garages/${id}/deactivate`;

    const res = await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({ reason: actionReason.trim() }),
    });

    setActionLoading(false);

    if (res.success) {
      setActionModal(null);
      setActionReason('');
      loadGarageDetail();
    } else {
      setActionError(res.message || 'Action failed');
    }
  };

  if (loading) {
    return <LoadingState message="Loading partner workshop profile..." />;
  }

  if (error || !garage) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-rose-600 mb-2" />
        <h2 className="text-base font-bold text-rose-900">Unable to load workshop</h2>
        <p className="mt-1 text-sm text-rose-700">{error || 'Workshop not found.'}</p>
        <Link href="/admin/garages" className="mt-4 inline-block">
          <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}>
            Back to Workshop Network
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
          href="/admin/garages"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-navy-600 hover:text-navy-900 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Workshop Network
        </Link>
        <span className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-1 text-xs font-mono font-bold text-navy-700">
          ID: {garage.id}
        </span>
      </div>

      {/* Header Profile Card */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-surface-100 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-navy-900">{garage.name}</h1>
              <StatusBadge status={garage.status} />
            </div>
            <p className="mt-1 text-xs text-navy-600">
              Registered on {new Date(garage.createdAtUtc).toLocaleDateString()} &bull;{' '}
              {garage.statusReason && <span>Status Note: {garage.statusReason}</span>}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {garage.status === 'PendingVerification' && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleVerify}
                leftIcon={<Check className="h-3.5 w-3.5" />}
              >
                Verify Workshop
              </Button>
            )}

            {garage.status === 'Verified' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActionModal('suspend')}
                leftIcon={<AlertTriangle className="h-3.5 w-3.5" />}
              >
                Suspend
              </Button>
            )}

            {garage.status === 'Suspended' && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleActivate}
                leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
              >
                Reactivate
              </Button>
            )}

            {garage.status !== 'Inactive' && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setActionModal('deactivate')}
                leftIcon={<Ban className="h-3.5 w-3.5" />}
              >
                Deactivate
              </Button>
            )}
          </div>
        </div>

        {/* Contact and Location Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5">
          <div className="space-y-1">
            <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Contact Info:</span>
            <p className="text-xs text-navy-800 flex items-center gap-2 font-medium">
              <Mail className="h-3.5 w-3.5 text-navy-400" /> {garage.email}
            </p>
            <p className="text-xs text-navy-800 flex items-center gap-2 font-medium">
              <Phone className="h-3.5 w-3.5 text-navy-400" /> {garage.phoneNumber}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Workshop Address:</span>
            <p className="text-xs text-navy-800 flex items-start gap-2 font-medium">
              <MapPin className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" /> {garage.address}
            </p>
            <p className="text-[11px] font-mono text-navy-500">
              Lon: {garage.longitude.toFixed(4)}, Lat: {garage.latitude.toFixed(4)}
            </p>
          </div>

          {/* Configurable Service Radius Widget */}
          <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-navy-900 flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-electric-600" /> Service Radius
              </span>
              <span className="font-mono text-xs font-bold text-navy-900 bg-white border border-surface-200 px-2 py-0.5 rounded-lg">
                {radiusKm.toFixed(1)} KM
              </span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1.0"
                max="50.0"
                step="0.5"
                value={radiusKm}
                onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-surface-200 rounded-lg appearance-none cursor-pointer accent-electric-600"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleUpdateRadius}
                disabled={savingRadius || radiusKm === garage.serviceRadiusKm}
                isLoading={savingRadius}
              >
                Save
              </Button>
            </div>
            {radiusSuccess && <p className="text-[11px] text-emerald-700 font-bold">Radius updated successfully.</p>}
            {radiusError && <p className="text-[11px] text-rose-600">{radiusError}</p>}
            <p className="text-[10px] text-navy-500">
              PostGIS 10 KM proximity engine matches requests within this radius (1.0 - 50.0 KM).
            </p>
          </div>
        </div>
      </Card>

      {/* Operational Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="p-4 text-center">
          <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Dispatches</span>
          <p className="mt-1 text-2xl font-black text-navy-900">{garage.totalDispatchesReceived}</p>
        </Card>
        <Card className="p-4 text-center">
          <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Quotes Sent</span>
          <p className="mt-1 text-2xl font-black text-navy-900">{garage.totalQuotesSubmitted}</p>
        </Card>
        <Card className="p-4 text-center">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Quotes Won</span>
          <p className="mt-1 text-2xl font-black text-emerald-700">{garage.totalQuotesWon}</p>
        </Card>
        <Card className="p-4 text-center">
          <span className="text-xs font-bold text-electric-700 uppercase tracking-wider">Win Rate</span>
          <p className="mt-1 text-2xl font-black text-electric-700">{garage.winRatePercentage}%</p>
        </Card>
        <Card className="p-4 text-center">
          <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">Active Jobs</span>
          <p className="mt-1 text-2xl font-black text-orange-600">{garage.activeJobsCount}</p>
        </Card>
        <Card className="p-4 text-center">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Completed Jobs</span>
          <p className="mt-1 text-2xl font-black text-emerald-700">{garage.completedJobsCount}</p>
        </Card>
      </div>

      {/* Recent Jobs & Audit History */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Jobs */}
        <Card className="p-6">
          <h3 className="text-base font-bold text-navy-900 flex items-center gap-2 border-b border-surface-100 pb-3">
            <Wrench className="h-4 w-4 text-orange-600" /> Recent Workshop Jobs
          </h3>
          <div className="mt-4 divide-y divide-surface-100">
            {garage.recentJobs.length === 0 ? (
              <p className="py-6 text-center text-xs text-navy-500">No jobs recorded for this garage.</p>
            ) : (
              garage.recentJobs.map((j) => (
                <div key={j.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-bold text-navy-900">{j.jobNumber}</span>
                    <p className="text-[11px] text-navy-600">{j.vehicleSummary}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={j.status} />
                    <p className="text-[10px] text-navy-500 mt-1">{new Date(j.createdAtUtc).toLocaleDateString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Audit History */}
        <Card className="p-6">
          <h3 className="text-base font-bold text-navy-900 flex items-center gap-2 border-b border-surface-100 pb-3">
            <History className="h-4 w-4 text-navy-500" /> Audit History
          </h3>
          <div className="mt-4 divide-y divide-surface-100">
            {garage.auditHistory.length === 0 ? (
              <p className="py-6 text-center text-xs text-navy-500">No audit events recorded.</p>
            ) : (
              garage.auditHistory.map((evt) => (
                <div key={evt.id} className="py-2.5 flex items-start justify-between gap-4 text-xs">
                  <div>
                    <span className="font-bold text-navy-900">{evt.action}</span>
                    <p className="text-[11px] text-navy-600 mt-0.5">{evt.userEmail || 'System'} &bull; {evt.details}</p>
                  </div>
                  <span className="text-[10px] text-navy-400 whitespace-nowrap font-mono">{new Date(evt.timestampUtc).toLocaleDateString()}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Action Reason Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-surface-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-surface-100 pb-3">
              <h3 className="text-base font-bold text-navy-900 capitalize">
                {actionModal} Workshop: {garage.name}
              </h3>
              <button
                onClick={() => setActionModal(null)}
                className="text-navy-400 hover:text-navy-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-xs text-navy-600">
              {actionModal === 'suspend'
                ? 'Suspending this workshop will immediately halt new proximity dispatches and quotation opportunities until reactivated.'
                : 'Deactivating this workshop marks it as inactive in the partner directory.'}
            </p>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-bold text-navy-800">
                Reason for {actionModal}: <span className="text-rose-600">*</span>
              </label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Enter audit rationale, compliance note, or reason..."
                rows={3}
                className="w-full rounded-xl border border-surface-200 bg-surface-50 p-2.5 text-xs text-navy-900 focus:border-navy-900 focus:outline-none"
              />
              {actionError && <p className="text-xs text-rose-600">{actionError}</p>}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActionModal(null)}
              >
                Cancel
              </Button>
              <Button
                variant={actionModal === 'suspend' ? 'secondary' : 'danger'}
                size="sm"
                onClick={submitActionModal}
                isLoading={actionLoading}
              >
                Confirm {actionModal}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
