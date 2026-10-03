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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Verified':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
      case 'PendingVerification':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
      case 'Suspended':
        return 'border-rose-500/30 bg-rose-500/10 text-rose-400';
      case 'Inactive':
        return 'border-neutral-700 bg-neutral-800 text-neutral-400';
      default:
        return 'border-neutral-700 bg-neutral-800 text-neutral-300';
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-500 border-t-transparent" />
          <p className="text-sm text-neutral-400">Loading partner workshop profile...</p>
        </div>
      </div>
    );
  }

  if (error || !garage) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-rose-400 mb-2" />
        <h2 className="text-base font-semibold text-rose-200">Unable to load workshop</h2>
        <p className="mt-1 text-sm text-rose-300/80">{error || 'Workshop not found.'}</p>
        <Link
          href="/admin/garages"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-neutral-800 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Workshop Network
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/garages"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-white transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Workshop Network
        </Link>
        <span className="rounded-full border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs font-mono font-medium text-neutral-300">
          ID: {garage.id}
        </span>
      </div>

      {/* Header Profile Card */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-neutral-800 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-white">{garage.name}</h1>
              <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${getStatusBadge(garage.status)}`}>
                {garage.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              Registered on {new Date(garage.createdAtUtc).toLocaleDateString()} &bull;{' '}
              {garage.statusReason && <span>Status Note: {garage.statusReason}</span>}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {garage.status === 'PendingVerification' && (
              <button
                onClick={handleVerify}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                <Check className="h-3.5 w-3.5" /> Verify Workshop
              </button>
            )}

            {garage.status === 'Verified' && (
              <button
                onClick={() => setActionModal('suspend')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
              >
                <AlertTriangle className="h-3.5 w-3.5" /> Suspend
              </button>
            )}

            {garage.status === 'Suspended' && (
              <button
                onClick={handleActivate}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Reactivate
              </button>
            )}

            {garage.status !== 'Inactive' && (
              <button
                onClick={() => setActionModal('deactivate')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3.5 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-950/40"
              >
                <Ban className="h-3.5 w-3.5" /> Deactivate
              </button>
            )}
          </div>
        </div>

        {/* Contact and Location Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Contact Info:</span>
            <p className="text-xs text-neutral-200 flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-neutral-500" /> {garage.email}
            </p>
            <p className="text-xs text-neutral-200 flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-neutral-500" /> {garage.phoneNumber}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Workshop Address:</span>
            <p className="text-xs text-neutral-200 flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" /> {garage.address}
            </p>
            <p className="text-[11px] font-mono text-neutral-500">
              Lon: {garage.longitude.toFixed(4)}, Lat: {garage.latitude.toFixed(4)}
            </p>
          </div>

          {/* Configurable Service Radius Widget */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-blue-400" /> Service Radius
              </span>
              <span className="font-mono text-xs font-bold text-white bg-neutral-800 px-2 py-0.5 rounded">
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
                className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
              <button
                onClick={handleUpdateRadius}
                disabled={savingRadius || radiusKm === garage.serviceRadiusKm}
                className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-40 transition"
              >
                {savingRadius ? '...' : 'Save'}
              </button>
            </div>
            {radiusSuccess && <p className="text-[11px] text-emerald-400">Radius updated successfully.</p>}
            {radiusError && <p className="text-[11px] text-rose-400">{radiusError}</p>}
            <p className="text-[10px] text-neutral-500">
              PostGIS 10 KM proximity engine matches requests within this radius (1.0 - 50.0 KM).
            </p>
          </div>
        </div>
      </div>

      {/* Operational Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-center">
          <span className="text-xs text-neutral-400">Dispatches</span>
          <p className="mt-1 text-2xl font-bold text-white">{garage.totalDispatchesReceived}</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-center">
          <span className="text-xs text-neutral-400">Quotes Sent</span>
          <p className="mt-1 text-2xl font-bold text-white">{garage.totalQuotesSubmitted}</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-center">
          <span className="text-xs text-neutral-400">Quotes Won</span>
          <p className="mt-1 text-2xl font-bold text-emerald-400">{garage.totalQuotesWon}</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-center">
          <span className="text-xs text-neutral-400">Win Rate</span>
          <p className="mt-1 text-2xl font-bold text-blue-400">{garage.winRatePercentage}%</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-center">
          <span className="text-xs text-neutral-400">Active Jobs</span>
          <p className="mt-1 text-2xl font-bold text-orange-400">{garage.activeJobsCount}</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-center">
          <span className="text-xs text-neutral-400">Completed Jobs</span>
          <p className="mt-1 text-2xl font-bold text-emerald-400">{garage.completedJobsCount}</p>
        </div>
      </div>

      {/* Recent Jobs & Audit History */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Recent Jobs */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
          <h3 className="text-base font-semibold text-white flex items-center gap-2 border-b border-neutral-800 pb-3">
            <Wrench className="h-4 w-4 text-orange-400" /> Recent Workshop Jobs
          </h3>
          <div className="mt-4 divide-y divide-neutral-800">
            {garage.recentJobs.length === 0 ? (
              <p className="py-6 text-center text-xs text-neutral-500">No jobs recorded for this garage.</p>
            ) : (
              garage.recentJobs.map((j) => (
                <div key={j.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-semibold text-white">{j.jobNumber}</span>
                    <p className="text-[11px] text-neutral-400">{j.vehicleSummary}</p>
                  </div>
                  <div className="text-right">
                    <span className="rounded bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-300">{j.status}</span>
                    <p className="text-[10px] text-neutral-500 mt-0.5">{new Date(j.createdAtUtc).toLocaleDateString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Audit History */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
          <h3 className="text-base font-semibold text-white flex items-center gap-2 border-b border-neutral-800 pb-3">
            <History className="h-4 w-4 text-neutral-400" /> Audit History
          </h3>
          <div className="mt-4 divide-y divide-neutral-800">
            {garage.auditHistory.length === 0 ? (
              <p className="py-6 text-center text-xs text-neutral-500">No audit events recorded.</p>
            ) : (
              garage.auditHistory.map((evt) => (
                <div key={evt.id} className="py-2.5 flex items-start justify-between gap-4 text-xs">
                  <div>
                    <span className="font-semibold text-neutral-200">{evt.action}</span>
                    <p className="text-[11px] text-neutral-400 mt-0.5">{evt.userEmail || 'System'} &bull; {evt.details}</p>
                  </div>
                  <span className="text-[10px] text-neutral-500 whitespace-nowrap">{new Date(evt.timestampUtc).toLocaleDateString()}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Action Reason Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base font-semibold text-white capitalize">
                {actionModal} Workshop: {garage.name}
              </h3>
              <button
                onClick={() => setActionModal(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-xs text-neutral-400">
              {actionModal === 'suspend'
                ? 'Suspending this workshop will immediately halt new proximity dispatches and quotation opportunities until reactivated.'
                : 'Deactivating this workshop marks it as inactive in the partner directory.'}
            </p>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-semibold text-neutral-300">
                Reason for {actionModal}: <span className="text-red-400">*</span>
              </label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Enter audit rationale, compliance note, or reason..."
                rows={3}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 p-2.5 text-xs text-white focus:border-red-500 focus:outline-none"
              />
              {actionError && <p className="text-xs text-rose-400">{actionError}</p>}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setActionModal(null)}
                className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-700"
              >
                Cancel
              </button>
              <button
                onClick={submitActionModal}
                disabled={actionLoading}
                className={`rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                  actionModal === 'suspend' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {actionLoading ? 'Processing...' : `Confirm ${actionModal}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
