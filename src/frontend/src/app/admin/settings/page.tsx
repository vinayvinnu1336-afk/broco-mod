'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Clock, KeyRound, Lock, MapPin, Maximize2, ShieldAlert } from 'lucide-react';
import { ErrorState } from '@/components/ui/ErrorState';
import { IconTile, ListGroup, ListItem } from '@/components/ui/ListItem';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { CommissionTermsCard } from '@/components/admin/CommissionTermsCard';

interface AdminSettings {
  defaultSearchRadiusKm: number;
  maxSearchRadiusKm: number;
  maxFailedLoginAttempts: number;
  accountLockoutMinutes: number;
  jwtExpiryMinutes: number;
  refreshTokenExpiryDays: number;
}

const unit = (value: number | undefined, one: string, many: string) =>
  typeof value === 'number' ? `${value} ${value === 1 ? one : many}` : '—';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<AdminSettings>('/admin/settings');
    if (res.success && res.data) {
      setSettings(res.data);
      setLoadError(null);
    } else {
      setLoadError(res.message || 'Could not load settings.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Settings"
        description="Commission terms can be changed here. The other platform rules are set on the server."
      />

      <CommissionTermsCard />

      {loading && !settings ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : !settings ? (
        <ErrorState title="Settings unavailable" error={loadError} onRetry={loadSettings} />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
          <ListGroup title="Finding garages">
            <ListItem
              leading={<IconTile icon={MapPin} tone="blue" />}
              title="Default search distance"
              subtitle="How far from the customer we look for garages"
              trailing={<Value>{typeof settings.defaultSearchRadiusKm === 'number' ? `${settings.defaultSearchRadiusKm} km` : '—'}</Value>}
            />
            <ListItem
              leading={<IconTile icon={Maximize2} tone="blue" />}
              title="Maximum search distance"
              subtitle="The furthest the search can be widened"
              trailing={<Value>{typeof settings.maxSearchRadiusKm === 'number' ? `${settings.maxSearchRadiusKm} km` : '—'}</Value>}
            />
          </ListGroup>

          <ListGroup title="Sign-in protection">
            <ListItem
              leading={<IconTile icon={ShieldAlert} tone="amber" />}
              title="Wrong passwords allowed"
              subtitle="Before the account is locked"
              trailing={<Value>{unit(settings.maxFailedLoginAttempts, 'try', 'tries')}</Value>}
            />
            <ListItem
              leading={<IconTile icon={Lock} tone="amber" />}
              title="Lockout time"
              subtitle="How long a locked account has to wait"
              trailing={<Value>{unit(settings.accountLockoutMinutes, 'minute', 'minutes')}</Value>}
            />
          </ListGroup>

          <ListGroup title="Sessions">
            <ListItem
              leading={<IconTile icon={Clock} tone="neutral" />}
              title="Session length"
              subtitle="Before the app quietly renews the sign-in"
              trailing={<Value>{unit(settings.jwtExpiryMinutes, 'minute', 'minutes')}</Value>}
            />
            <ListItem
              leading={<IconTile icon={KeyRound} tone="neutral" />}
              title="Stay signed in for"
              subtitle="Without using the app, before signing in again"
              trailing={<Value>{unit(settings.refreshTokenExpiryDays, 'day', 'days')}</Value>}
            />
          </ListGroup>
        </div>
      )}
    </div>
  );
}

function Value({ children }: { children: React.ReactNode }) {
  return <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-navy-900">{children}</span>;
}
