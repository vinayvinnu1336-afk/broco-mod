'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { ListGroup, ListItem } from '@/components/ui/ListItem';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';

interface AdvisorProfileData {
  advisorId: string;
  userId: string;
  fullName: string;
  email: string;
  employeeCode: string;
  specialization: string;
  maxAssignedRequests: number;
}

export default function AdvisorProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<AdvisorProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<AdvisorProfileData>('/advisor/profile');
    if (res.success && res.data) {
      setProfile(res.data);
      setError(null);
    } else {
      setError(res.message || 'Could not load your profile.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const name = profile?.fullName || user?.fullName || '';
  const email = profile?.email || user?.email || '';

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader title="Profile" description="Your advisor account details." />

      {loading ? (
        <div className="max-w-2xl space-y-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ) : (
        <div className="max-w-2xl space-y-5">
          <Card className="flex items-center gap-4 p-4 sm:p-5">
            <Avatar name={name || 'Advisor'} size="xl" />
            <div className="min-w-0">
              <div className="truncate text-lg font-bold text-navy-900">{name || 'Advisor'}</div>
              {email && <div className="truncate text-sm text-navy-500">{email}</div>}
            </div>
          </Card>

          {error && !profile ? (
            <ErrorState title="Could not load your advisor details" error={error} onRetry={loadProfile} />
          ) : (
            profile && (
              <ListGroup title="Advisor details">
                <ListItem title="Employee code" trailing={<span className="font-mono text-sm text-navy-700">{profile.employeeCode || '—'}</span>} />
                <ListItem title="Specialisation" trailing={<span className="text-sm text-navy-700">{profile.specialization || '—'}</span>} />
                <ListItem
                  title="Open requests you can hold"
                  trailing={<span className="text-sm tabular-nums text-navy-700">{profile.maxAssignedRequests}</span>}
                />
              </ListGroup>
            )
          )}
        </div>
      )}
    </div>
  );
}
