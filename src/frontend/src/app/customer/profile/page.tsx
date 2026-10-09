'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { Mail, MapPin, MessageSquare, Phone } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ListGroup, ListItem, IconTile } from '@/components/ui/ListItem';
import { Skeleton } from '@/components/ui/Skeleton';

interface CustomerProfileData {
  customerId: string;
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string;
  preferredContactMethod: string;
}

const NOT_ADDED = <span className="text-navy-400">Not added</span>;

export default function CustomerProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CustomerProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const res = await apiFetch<CustomerProfileData>('/customer/profile');
      if (res.success && res.data) {
        setProfile(res.data);
      }
      setLoading(false);
    }
    loadProfile();
  }, []);

  const name = profile?.fullName || user?.fullName || '';
  const email = profile?.email || user?.email || '';
  const phone = profile?.phoneNumber || user?.phoneNumber || '';
  const initial = name ? name.trim().charAt(0).toUpperCase() : '?';

  return (
    <div className="mx-auto max-w-2xl space-y-5 sm:space-y-6">
      <PageHeader title="Profile" description="Your contact details." />

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading profile">
          <Skeleton className="h-20" />
          <Skeleton className="h-56" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 rounded-2xl border border-surface-200 bg-white p-4 shadow-card sm:p-5">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-electric-50 text-xl font-bold text-electric-700"
              aria-hidden="true"
            >
              {initial}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-navy-900">{name || 'Your account'}</h2>
              {email && <p className="truncate text-sm text-navy-500">{email}</p>}
            </div>
          </div>

          <ListGroup title="Contact details">
            <ListItem
              leading={<IconTile icon={Mail} tone="neutral" />}
              title="Email"
              subtitle={email || NOT_ADDED}
            />
            <ListItem
              leading={<IconTile icon={Phone} tone="neutral" />}
              title="Phone"
              subtitle={phone || NOT_ADDED}
            />
            <ListItem
              leading={<IconTile icon={MapPin} tone="neutral" />}
              title="Address"
              subtitle={profile?.address ? <span className="whitespace-normal break-words">{profile.address}</span> : NOT_ADDED}
            />
            <ListItem
              leading={<IconTile icon={MessageSquare} tone="neutral" />}
              title="Preferred contact"
              subtitle={profile?.preferredContactMethod || NOT_ADDED}
            />
          </ListGroup>
        </>
      )}
    </div>
  );
}
