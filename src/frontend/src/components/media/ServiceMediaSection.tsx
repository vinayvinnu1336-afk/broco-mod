'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { DEFAULT_MEDIA_LIMITS } from '@/lib/media';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { MediaStage, ServiceMedia, ServiceMediaList, UpdateServiceMediaRequest } from '@/types/media';
import { MediaStageGroups } from './MediaStageGroups';
import { MediaUploader } from './MediaUploader';

export interface ServiceMediaSectionProps {
  /** Either a job (garage screens) or a service request (advisor, admin and customer screens). */
  jobId?: string;
  requestId?: string;
  title?: string;
  /** Who is looking, for the wording; what they may do always comes from the API. */
  audience: 'garage' | 'staff' | 'customer';
  defaultStage?: MediaStage;
  /** Render nothing while loading or when there is nothing to see and nothing to do (customer screens). */
  hideWhenEmpty?: boolean;
  /** "card": title inside a card (most screens). "section": title above the card (garage job screen). */
  variant?: 'card' | 'section';
  className?: string;
}

/**
 * "Photos & videos" card for a service request or job: the gallery, plus upload for garages and BroCo staff
 * and edit/delete where the API allows it. Customers only view what is shown to them.
 */
export function ServiceMediaSection({
  jobId,
  requestId,
  title = 'Photos & videos',
  audience,
  defaultStage,
  hideWhenEmpty = false,
  variant = 'card',
  className = '',
}: ServiceMediaSectionProps) {
  const toast = useToast();
  const endpoint = jobId ? `/media/jobs/${jobId}` : `/media/requests/${requestId}`;
  const [data, setData] = useState<ServiceMediaList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploaderOpen, setUploaderOpen] = useState(false);
  // Stage picked by tapping a group's "Add" (Before / After); otherwise the screen's suggestion.
  const [uploadStage, setUploadStage] = useState<MediaStage | undefined>(undefined);
  const lastRefresh = useRef(0);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      const res = await apiFetch<ServiceMediaList>(endpoint);
      if (res.success && res.data) {
        setData(res.data);
        setError(null);
      } else if (!quiet) {
        setError(res.message || 'Could not load photos and videos.');
      }
      lastRefresh.current = Date.now();
      setLoading(false);
    },
    [endpoint]
  );

  useEffect(() => {
    if (jobId || requestId) load();
  }, [jobId, requestId, load]);

  // Signed links last about an hour; if a picture fails after that, fetch fresh links (at most once a minute).
  const onLoadError = useCallback(() => {
    if (!data) return;
    const expired = Date.now() > new Date(data.items[0]?.urlExpiresAtUtc ?? 0).getTime() - 60_000;
    if (expired && Date.now() - lastRefresh.current > 60_000) load(true);
  }, [data, load]);

  const items = data?.items ?? [];

  function addItem(media: ServiceMedia) {
    setData((d) => (d ? { ...d, items: [...d.items, media], remainingSlots: Math.max(0, d.remainingSlots - 1) } : d));
  }

  async function updateItem(item: ServiceMedia, changes: UpdateServiceMediaRequest): Promise<string | null> {
    const res = await apiFetch<ServiceMedia>(`/media/${item.id}`, { method: 'PATCH', body: JSON.stringify(changes) });
    if (!res.success || !res.data) return res.message || 'Could not save.';
    const saved = res.data;
    setData((d) => (d ? { ...d, items: d.items.map((m) => (m.id === saved.id ? saved : m)) } : d));
    toast.success('Saved');
    return null;
  }

  async function deleteItem(item: ServiceMedia): Promise<string | null> {
    const res = await apiFetch<unknown>(`/media/${item.id}`, { method: 'DELETE' });
    if (!res.success) return res.message || 'Could not delete.';
    setData((d) => (d ? { ...d, items: d.items.filter((m) => m.id !== item.id), remainingSlots: d.remainingSlots + 1 } : d));
    toast.success(item.kind === 'Video' ? 'Video deleted' : 'Photo deleted');
    return null;
  }

  const canUpload = !!data?.canUpload;
  const canManage = items.some((m) => m.canEdit || m.canDelete);
  const photos = items.filter((m) => m.kind === 'Photo').length;
  const videos = items.filter((m) => m.kind === 'Video').length;
  const documents = items.length - photos - videos;
  const summary = [
    photos ? `${photos} photo${photos === 1 ? '' : 's'}` : null,
    videos ? `${videos} video${videos === 1 ? '' : 's'}` : null,
    documents ? `${documents} PDF${documents === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const emptyText =
    audience === 'customer'
      ? 'Photos and videos of your car from the garage or your BroCo advisor will show here.'
      : audience === 'garage'
        ? 'Add photos when the car comes in and when the work is done, so the customer can see what was fixed.'
        : 'No photos or videos yet. Add them here, or ask the garage to upload from their job screen.';

  if (hideWhenEmpty && (loading || error || (items.length === 0 && !canUpload))) return null;

  function openUploader(stage?: MediaStage) {
    setUploadStage(stage);
    setUploaderOpen(true);
  }
  const roomLeft = (data?.remainingSlots ?? 0) > 0;

  const headingId = `media-title-${jobId ?? requestId}`;
  const addButton = canUpload && (
    <Button
      variant="outline"
      size="sm"
      leftIcon={<ImagePlus className="h-4 w-4" />}
      onClick={() => openUploader()}
      disabled={(data?.remainingSlots ?? 0) <= 0}
      title={(data?.remainingSlots ?? 0) <= 0 ? `The most allowed is ${data?.maxItems}` : undefined}
      className="shrink-0"
    >
      Add
    </Button>
  );
  const heading = (
    <div className="min-w-0">
      <h2 id={headingId} className="text-base font-semibold text-navy-900">
        {title}
      </h2>
      {summary && <p className="mt-0.5 text-xs text-navy-500">{summary}</p>}
    </div>
  );

  const body = loading ? (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5" aria-label="Loading photos and videos">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="aspect-square w-full rounded-xl" />
      ))}
    </div>
  ) : error ? (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
      <span>{error}</span>
      <button type="button" onClick={() => load()} className="font-semibold underline">
        Try again
      </button>
    </div>
  ) : (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-sm text-navy-500">{emptyText}</p>}
      <MediaStageGroups
        items={items}
        idPrefix={headingId}
        showVisibility={audience !== 'customer'}
        onUpdate={canManage ? updateItem : undefined}
        onDelete={canManage ? deleteItem : undefined}
        onLoadError={onLoadError}
        onAdd={canUpload && roomLeft ? openUploader : undefined}
      />
    </div>
  );

  const uploader = canUpload && data && (
    <MediaUploader
      isOpen={uploaderOpen}
      onClose={() => setUploaderOpen(false)}
      endpoint={endpoint}
      limits={data.limits ?? DEFAULT_MEDIA_LIMITS}
      remainingSlots={data.remainingSlots}
      defaultStage={uploadStage ?? defaultStage}
      askStage={audience !== 'customer'}
      onUploaded={addItem}
      onFinished={(n) => n > 0 && toast.success(n === 1 ? 'Uploaded' : `${n} uploaded`)}
    />
  );

  // Title above the card, like the other sections on the garage job screen.
  if (variant === 'section') {
    return (
      <section aria-labelledby={headingId} className={`space-y-3 ${className}`}>
        <div className="flex items-center justify-between gap-3 px-1">
          {heading}
          {addButton}
        </div>
        <div className="rounded-2xl border border-surface-200 bg-white p-3 shadow-card sm:p-4">{body}</div>
        {uploader}
      </section>
    );
  }

  return (
    <Card className={`p-4 sm:p-5 ${className}`}>
      <section aria-labelledby={headingId}>
        <div className="flex items-start justify-between gap-3">
          {heading}
          {addButton}
        </div>
        <div className="mt-3">{body}</div>
      </section>
      {uploader}
    </Card>
  );
}
