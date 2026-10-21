'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, FileText, ImageOff, Trash2, Upload } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { formatBytes, resolveMediaUrl } from '@/lib/media';
import { CustomerFileDraft, customerLimitsFrom, releaseDraft, setUnsentFiles, unsentFiles, uploadCustomerFile } from '@/lib/customerUploads';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { MediaGallery } from '@/components/media/MediaGallery';
import { ServiceMedia, ServiceMediaList } from '@/types/media';
import { CustomerFilesField } from './CustomerFiles';

/**
 * Customer request page: photos the garage or BroCo shared, and the photos and PDFs the customer added
 * (e.g. an old quotation). The customer can add more, retry files that did not upload after booking, and
 * delete their own.
 */
export function CustomerUploadsCard({ requestId }: { requestId: string }) {
  const toast = useToast();
  const [data, setData] = useState<ServiceMediaList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Files that failed right after booking come back here with a Retry button.
  const [drafts, setDrafts] = useState<CustomerFileDraft[]>(() => unsentFiles(requestId));
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ServiceMedia | null>(null);
  const [deleting, setDeleting] = useState(false);
  const draftsRef = useRef<CustomerFileDraft[]>([]);
  draftsRef.current = drafts;
  const lastRefresh = useRef(0);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      const res = await apiFetch<ServiceMediaList>(`/media/requests/${requestId}`);
      if (res.success && res.data) {
        setData(res.data);
        setError(null);
      } else if (!quiet) {
        setError(res.message || 'Could not load photos and documents.');
      }
      lastRefresh.current = Date.now();
      setLoading(false);
    },
    [requestId]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Leaving the page with files still not uploaded: keep them for when the customer comes back (same tab).
  useEffect(
    () => () => {
      const left = draftsRef.current.filter((d) => d.status === 'error' || d.status === 'ready');
      setUnsentFiles(requestId, left);
      draftsRef.current.filter((d) => !left.includes(d)).forEach(releaseDraft);
    },
    [requestId]
  );

  const onLoadError = useCallback(() => {
    if (Date.now() - lastRefresh.current > 60_000) load(true);
  }, [load]);

  const items = data?.items ?? [];
  const mine = items.filter((m) => m.stage === 'CustomerUpload');
  const shared = items.filter((m) => m.stage !== 'CustomerUpload');
  const canUpload = !!data?.canUpload;
  const limits = customerLimitsFrom(data?.limits, data?.maxItems);
  const room = data?.remainingSlots ?? 0;
  const toSend = drafts.filter((d) => d.status === 'ready' || d.status === 'error');

  const update = (key: string, patch: Partial<CustomerFileDraft>) =>
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  async function send(keys: string[]) {
    setUploading(true);
    let sent = 0;
    for (const key of keys) {
      const draft = draftsRef.current.find((d) => d.key === key);
      if (!draft) continue;
      update(key, { status: 'uploading', progress: 0, error: undefined });
      const result = await uploadCustomerFile(requestId, draft, (progress) => update(key, { progress }));
      if (result.ok) {
        sent += 1;
        update(key, { status: 'done', progress: 1 });
        setData((d) => (d ? { ...d, items: [...d.items, result.media], remainingSlots: Math.max(0, d.remainingSlots - 1) } : d));
      } else {
        update(key, { status: 'error', error: result.message });
      }
    }
    setUploading(false);
    if (sent > 0) {
      toast.success(sent === 1 ? 'File added' : `${sent} files added`);
      // Uploaded rows now show in the list above; drop them from the queue after the tick has been seen.
      window.setTimeout(() => {
        setDrafts((list) => {
          list.filter((d) => d.status === 'done').forEach(releaseDraft);
          return list.filter((d) => d.status !== 'done');
        });
      }, 1200);
    }
  }

  async function remove(item: ServiceMedia) {
    setDeleting(true);
    const res = await apiFetch<unknown>(`/media/${item.id}`, { method: 'DELETE' });
    setDeleting(false);
    if (!res.success) {
      toast.error('Could not delete', res.message || 'Please try again.');
      return;
    }
    setConfirmDelete(null);
    setData((d) => (d ? { ...d, items: d.items.filter((m) => m.id !== item.id), remainingSlots: d.remainingSlots + 1 } : d));
    toast.success(item.kind === 'Document' ? 'PDF deleted' : 'Photo deleted');
  }

  if (loading) {
    return (
      <Card className="p-4 sm:p-5" aria-busy="true">
        <Skeleton className="h-5 w-48" />
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-xl" />
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-navy-900">Photos &amp; documents</h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          <span>{error}</span>
          <button type="button" onClick={() => load()} className="font-semibold underline">
            Try again
          </button>
        </div>
      </Card>
    );
  }

  if (items.length === 0 && !canUpload && drafts.length === 0) return null;

  const unsentCount = drafts.filter((d) => d.status === 'error').length;

  return (
    <Card className="p-4 sm:p-5">
      <section aria-labelledby={`files-${requestId}`} className="space-y-4">
        <div>
          <h2 id={`files-${requestId}`} className="text-base font-semibold text-navy-900">
            Photos &amp; documents
          </h2>
          <p className="mt-0.5 text-sm text-navy-500">
            {canUpload
              ? 'Add an old quotation, a bill, or photos of a dent or warning light. Garages quoting your car can see them.'
              : 'Photos and files for this request.'}
          </p>
        </div>

        {unsentCount > 0 && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="status">
            {unsentCount === 1 ? '1 file' : `${unsentCount} files`} didn&apos;t upload yet. Tap Retry below, or remove it.
          </p>
        )}

        {shared.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-navy-800">From the garage &amp; BroCo</h3>
            <MediaGallery items={shared} onLoadError={onLoadError} />
          </div>
        )}

        {mine.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-navy-800">Added by you</h3>
            <ul className="divide-y divide-surface-200 overflow-hidden rounded-2xl border border-surface-200" aria-label="Files you added">
              {mine.map((m) => (
                <UploadedRow key={m.id} item={m} onDelete={m.canDelete ? () => setConfirmDelete(m) : undefined} onLoadError={onLoadError} />
              ))}
            </ul>
          </div>
        )}

        {canUpload && (
          <div className="space-y-3">
            <CustomerFilesField drafts={drafts} onChange={setDrafts} room={room} limits={limits} disabled={uploading} onRetry={(key) => send([key])} />
            {toSend.length > 0 && (
              <Button
                onClick={() => send(toSend.map((d) => d.key))}
                isLoading={uploading}
                disabled={uploading}
                leftIcon={!uploading ? <Upload className="h-4 w-4" /> : undefined}
                className="w-full sm:w-auto"
              >
                {uploading ? 'Uploading…' : toSend.length === 1 ? 'Upload 1 file' : `Upload ${toSend.length} files`}
              </Button>
            )}
          </div>
        )}
      </section>

      <Modal
        isOpen={!!confirmDelete}
        onClose={() => !deleting && setConfirmDelete(null)}
        title={confirmDelete?.kind === 'Document' ? 'Delete this PDF?' : 'Delete this photo?'}
        description="Garages and your advisor will no longer see it."
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deleting} className="w-full sm:w-auto">
              Keep it
            </Button>
            <Button variant="danger" onClick={() => confirmDelete && remove(confirmDelete)} isLoading={deleting} className="w-full sm:w-auto">
              Delete
            </Button>
          </div>
        }
      >
        {confirmDelete && <p className="break-all text-sm text-navy-700">{confirmDelete.caption || confirmDelete.fileName}</p>}
      </Modal>
    </Card>
  );
}

function UploadedRow({ item, onDelete, onLoadError }: { item: ServiceMedia; onDelete?: () => void; onLoadError: () => void }) {
  const [broken, setBroken] = useState(false);
  const href = resolveMediaUrl(item.url);
  const thumb = resolveMediaUrl(item.thumbnailUrl ?? (item.kind === 'Photo' ? item.url : null));
  const isDoc = item.kind === 'Document';
  return (
    <li className="flex items-center gap-3 p-3">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-100 text-navy-400 ring-1 ring-inset ring-surface-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-600"
        aria-label={`Open ${isDoc ? 'PDF' : 'photo'} ${item.fileName} in a new tab`}
      >
        {isDoc ? (
          <span className="flex flex-col items-center gap-0.5 text-electric-600">
            <FileText className="h-6 w-6" aria-hidden="true" />
            <span className="text-[10px] font-bold tracking-wide">PDF</span>
          </span>
        ) : thumb && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => {
              setBroken(true);
              onLoadError();
            }}
          />
        ) : (
          <ImageOff className="h-5 w-5" aria-hidden="true" />
        )}
      </a>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 break-words text-sm font-medium leading-snug text-navy-900">{item.caption || item.fileName}</div>
        <div className="truncate text-xs text-navy-500">
          {item.caption ? `${item.fileName} · ` : ''}
          {isDoc ? 'PDF' : 'Photo'} · {formatBytes(item.sizeBytes)}
        </div>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-navy-500 hover:bg-surface-100 hover:text-navy-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-600"
        aria-label={`Open ${item.fileName}`}
        title="Open"
      >
        <ExternalLink className="h-4 w-4" />
      </a>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="-ml-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-navy-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          aria-label={`Delete ${item.fileName}`}
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}
