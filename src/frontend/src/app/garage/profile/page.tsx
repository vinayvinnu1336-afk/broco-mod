'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Building2, Mail, MapPin, Phone, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { humanize } from '@/lib/format';

interface GarageProfileData {
  garageId: string;
  name: string;
  email: string;
  phoneNumber: string;
  address: string;
  longitude: number;
  latitude: number;
  isActive: boolean;
  teamMembers: Array<{
    userId: string;
    fullName: string;
    email: string;
    roleName: string;
    title: string;
  }>;
}

export default function GarageProfilePage() {
  const [profile, setProfile] = useState<GarageProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    const res = await apiFetch<GarageProfileData>('/garage/profile');
    if (res.success && res.data) {
      setProfile(res.data);
    } else {
      setError(res.message || 'Could not load the workshop profile.');
    }
    setLoading(false);
  }

  useEffect(() => {
    loadProfile();
  }, []);

  const hasLocation =
    profile != null &&
    Number.isFinite(profile.latitude) &&
    Number.isFinite(profile.longitude) &&
    !(profile.latitude === 0 && profile.longitude === 0);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Workshop profile"
        description="Your workshop’s contact details and the people who can use this portal."
      />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : error || !profile ? (
        <ErrorState title="Couldn’t load the profile" error={error} onRetry={loadProfile} />
      ) : (
        <div className="space-y-5 sm:space-y-6">
          <section className="flex items-center gap-4 rounded-2xl border border-surface-200 bg-white p-4 shadow-card sm:p-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Building2 className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-navy-900">{profile.name}</h2>
              <div className="mt-1">
                {profile.isActive ? (
                  <Badge variant="green" dot>
                    Active partner
                  </Badge>
                ) : (
                  <Badge variant="neutral" dot>
                    Inactive
                  </Badge>
                )}
              </div>
            </div>
          </section>

          <ListGroup title="Contact">
            <ListItem
              leading={<IconTile icon={Phone} tone="neutral" />}
              title={profile.phoneNumber || 'Not set'}
              subtitle="Phone"
              href={profile.phoneNumber ? `tel:${profile.phoneNumber.replace(/\s+/g, '')}` : undefined}
              hideChevron
            />
            <ListItem
              leading={<IconTile icon={Mail} tone="neutral" />}
              title={profile.email || 'Not set'}
              subtitle="Email"
              href={profile.email ? `mailto:${profile.email}` : undefined}
              hideChevron
            />
            <ListItem
              leading={<IconTile icon={MapPin} tone="neutral" />}
              title={<span className="whitespace-normal">{profile.address || 'Not set'}</span>}
              subtitle={hasLocation ? 'Address · open in Maps' : 'Address'}
              href={
                hasLocation
                  ? `https://www.google.com/maps/search/?api=1&query=${profile.latitude},${profile.longitude}`
                  : undefined
              }
            />
          </ListGroup>

          <ListGroup
            title={
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4 text-navy-400" />
                Team ({profile.teamMembers?.length ?? 0})
              </span>
            }
          >
            {profile.teamMembers && profile.teamMembers.length > 0 ? (
              profile.teamMembers.map((m) => (
                <ListItem
                  key={m.userId}
                  leading={<Avatar name={m.fullName || m.email} size="sm" />}
                  title={m.fullName || m.email}
                  subtitle={m.email}
                  meta={[m.title, humanize(m.roleName)].filter(Boolean).join(' · ')}
                />
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-navy-500">No team members linked to this workshop yet.</div>
            )}
          </ListGroup>
        </div>
      )}
    </div>
  );
}
