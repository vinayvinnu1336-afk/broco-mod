'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, ChevronDown, Film, ImageIcon, Images, RotateCw, Video, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { checkMediaFile, formatBytes, makeThumbnail, uploadMediaFile, UploadHandle } from '@/lib/media';
import { MediaKind, MediaLimits, MediaStage, ServiceMedia } from '@/types/media';

type ItemStatus = 'ready' | 'invalid' | 'uploading' | 'done' | 'error';

interface QueueItem {
  key: string;
  file: File;
  kind: MediaKind | null;
  caption: string;
  status: ItemStatus;
  progress: number;
  error?: string;
  thumb?: Blob | null;
  previewUrl?: string;
}

export interface MediaUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  /** API path that takes the multipart upload, e.g. /media/jobs/{id}. */
  endpoint: string;
  limits: MediaLimits;
  remainingSlots: number;
  /** Suggested answer to "Before or after the service?"; with none, the uploader waits for a choice. */
  defaultStage?: MediaStage;
  /** Ask when the photos were taken (garage and staff). Off: everything goes up as `defaultStage` or Other. */
  askStage?: boolean;
  /** Garages and advisors can mark workshop-only photos; defaults to shown. */
  allowHideFromCustomer?: boolean;
  onUploaded: (media: ServiceMedia) => void;
  onFinished?: (uploaded: number) => void;
}

let keySeq = 0;

/**
 * Pick photos and videos (camera or gallery on phones, file picker on computers), add a caption to each,
 * then upload them one by one with progress. Failed files stay in the list with a retry button.
 */
export function MediaUploader({
  isOpen,
  onClose,
  endpoint,
  limits,
  remainingSlots,
  defaultStage,
  askStage = true,
  allowHideFromCustomer = true,
  onUploaded,
  onFinished,
}: MediaUploaderProps) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stage, setStage] = useState<MediaStage | null>(defaultStage ?? null);
  const [moreStages, setMoreStages] = useState(false);
  const [visible, setVisible] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [touch, setTouch] = useState(false);
  const galleryInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const current = useRef<UploadHandle | null>(null);
  const cancelled = useRef(false);
  const queueRef = useRef<QueueItem[]>([]);
  queueRef.current = queue;

  useEffect(() => {
    setTouch(typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStage(defaultStage ?? (askStage ? null : 'Other'));
      setMoreStages(!!defaultStage && !MAIN_STAGES.some((s) => s.value === defaultStage));
      setVisible(true);
    }
  }, [isOpen, defaultStage, askStage]);

  // Free preview memory when the dialog closes or unmounts.
  useEffect(() => {
    if (isOpen) return;
    queueRef.current.forEach((q) => q.previewUrl && URL.revokeObjectURL(q.previewUrl));
    setQueue([]);
  }, [isOpen]);
  useEffect(() => () => queueRef.current.forEach((q) => q.previewUrl && URL.revokeObjectURL(q.previewUrl)), []);

  const update = (key: string, patch: Partial<QueueItem>) =>
    setQueue((items) => items.map((q) => (q.key === key ? { ...q, ...patch } : q)));

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const pending = queueRef.current.filter((q) => q.status !== 'invalid' && q.status !== 'done').length;
    let slots = remainingSlots - pending;
    const added: QueueItem[] = Array.from(list).map((file) => {
      const check = checkMediaFile(file, limits);
      const key = `m${++keySeq}`;
      if ('error' in check) return { key, file, kind: null, caption: '', status: 'invalid', progress: 0, error: check.error };
      if (slots <= 0) {
        return { key, file, kind: check.kind, caption: '', status: 'invalid', progress: 0, error: 'No more room: this request already has the most photos and videos allowed.' };
      }
      slots -= 1;
      return { key, file, kind: check.kind, caption: '', status: 'ready', progress: 0 };
    });
    setQueue((items) => [...items, ...added]);

    // Previews (and the thumbnails sent with the upload) are made in the background.
    added
      .filter((q) => q.kind)
      .forEach(async (q) => {
        const thumb = await makeThumbnail(q.file, q.kind!);
        update(q.key, { thumb, previewUrl: thumb ? URL.createObjectURL(thumb) : undefined });
      });
  }

  function removeItem(key: string) {
    const item = queueRef.current.find((q) => q.key === key);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    setQueue((items) => items.filter((q) => q.key !== key));
  }

  async function uploadAll() {
    if (!stage) return;
    setUploading(true);
    cancelled.current = false;
    let uploaded = 0;
    for (const item of queueRef.current.filter((q) => q.status === 'ready' || q.status === 'error')) {
      if (cancelled.current) break;
      update(item.key, { status: 'uploading', progress: 0, error: undefined });
      const latest = queueRef.current.find((q) => q.key === item.key) ?? item;
      const handle = uploadMediaFile(
        endpoint,
        item.file,
        { caption: latest.caption, stage: stage ?? 'Other', isVisibleToCustomer: visible, thumbnail: latest.thumb },
        (progress) => update(item.key, { progress })
      );
      current.current = handle;
      const result = await handle.promise;
      current.current = null;
      if (result.ok) {
        uploaded += 1;
        update(item.key, { status: 'done', progress: 1 });
        onUploaded(result.media);
      } else {
        update(item.key, { status: 'error', error: result.message });
      }
    }
    setUploading(false);
    onFinished?.(uploaded);
    const failed = queueRef.current.some((q) => q.status === 'error' || q.status === 'ready');
    if (!failed && !cancelled.current) onClose();
  }

  function cancelUpload() {
    cancelled.current = true;
    current.current?.abort();
  }

  const readyCount = queue.filter((q) => q.status === 'ready' || q.status === 'error').length;
  const needsStage = askStage && !stage;
  const hasVideos = queue.some((q) => q.kind === 'Video' && q.status !== 'invalid');

  return (
    <Modal
      isOpen={isOpen}
      onClose={uploading ? cancelUpload : onClose}
      title="Add photos & videos"
      description={`Photos up to ${formatBytes(limits.maxPhotoBytes)}, videos up to ${formatBytes(limits.maxVideoBytes)}. ${remainingSlots} more allowed.`}
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          {uploading ? (
            <Button variant="outline" onClick={cancelUpload} className="w-full sm:w-auto">
              Stop
            </Button>
          ) : (
            <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Cancel
            </Button>
          )}
          <Button
            onClick={uploadAll}
            disabled={readyCount === 0 || uploading || needsStage}
            isLoading={uploading}
            title={needsStage ? 'Choose before or after the service first' : undefined}
            className="w-full sm:w-auto"
          >
            {readyCount > 0 ? `Upload ${readyCount}` : 'Upload'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* First question: which side of the service these show (the galleries group by it) */}
        {askStage && (
          <fieldset disabled={uploading}>
            <legend id="upload-stage-label" className="mb-1.5 text-sm font-medium text-navy-800">
              Before or after the service? <span className="text-semantic-error">*</span>
            </legend>
            <div role="radiogroup" aria-labelledby="upload-stage-label" aria-required="true" className="grid grid-cols-2 gap-2">
              {MAIN_STAGES.map((s) => (
                <StageOption key={s.value} label={s.label} hint={s.hint} active={stage === s.value} onClick={() => setStage(s.value)} />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setMoreStages((v) => !v)}
              aria-expanded={moreStages}
              className="mt-2 inline-flex min-h-[36px] items-center gap-1 text-sm font-medium text-electric-700 hover:underline"
            >
              More
              <ChevronDown className={`h-4 w-4 transition-transform ${moreStages ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {moreStages && (
              <div role="radiogroup" aria-label="Other stages" className="mt-1 flex flex-wrap gap-2">
                {MORE_STAGES.map((s) => {
                  const active = stage === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setStage(s.value)}
                      className={`inline-flex min-h-[36px] items-center rounded-full border px-3.5 text-sm font-medium transition touch-manipulation ${
                        active
                          ? 'border-navy-900 bg-navy-900 text-white'
                          : 'border-surface-200 bg-white text-navy-600 hover:border-surface-300 hover:text-navy-900'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            )}
            {needsStage && queue.length > 0 && (
              <p className="mt-1.5 text-xs text-semantic-error">Choose before or after the service to upload.</p>
            )}
          </fieldset>
        )}

        {/* Pickers */}
        <div className={`grid gap-2 ${touch ? 'grid-cols-3' : 'grid-cols-1'}`}>
          {touch && (
            <>
              <PickerTile icon={<Camera className="h-6 w-6" />} label="Take photo" onClick={() => photoInput.current?.click()} disabled={uploading} />
              <PickerTile icon={<Video className="h-6 w-6" />} label="Record video" onClick={() => videoInput.current?.click()} disabled={uploading} />
            </>
          )}
          <PickerTile
            icon={<Images className="h-6 w-6" />}
            label={touch ? 'Gallery' : 'Choose photos or videos'}
            hint={touch ? undefined : 'JPG, PNG, WebP, HEIC, MP4, MOV or WebM'}
            onClick={() => galleryInput.current?.click()}
            disabled={uploading || remainingSlots <= 0}
          />
        </div>
        <input
          ref={galleryInput}
          type="file"
          accept="image/*,video/*,.heic,.heif,.mov"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={videoInput}
          type="file"
          accept="video/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {/* Selected files */}
        {queue.length > 0 && (
          <ul className="divide-y divide-surface-200 overflow-hidden rounded-2xl border border-surface-200" aria-label="Selected files">
            {queue.map((item) => (
              <li key={item.key} className="flex gap-3 p-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-100">
                  {item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-navy-400">
                      {item.kind === 'Video' ? <Film className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
                    </span>
                  )}
                  {item.status === 'done' && (
                    <span className="absolute inset-0 flex items-center justify-center bg-emerald-600/70 text-white">
                      <CheckCircle2 className="h-7 w-7" />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-navy-900">{item.file.name}</div>
                      <div className="text-xs text-navy-500">
                        {item.kind ?? 'File'} · {formatBytes(item.file.size)}
                      </div>
                    </div>
                    {item.status !== 'uploading' && item.status !== 'done' && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.key)}
                        className="-mr-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-navy-400 hover:bg-surface-100 hover:text-navy-700"
                        aria-label={`Remove ${item.file.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {item.status === 'invalid' ? (
                    <p className="flex items-start gap-1.5 text-xs text-semantic-error">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {item.error}
                    </p>
                  ) : item.status === 'uploading' || item.status === 'done' ? (
                    <div>
                      <div
                        className="h-1.5 overflow-hidden rounded-full bg-surface-200"
                        role="progressbar"
                        aria-label={`Uploading ${item.file.name}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(item.progress * 100)}
                      >
                        <div
                          className={`h-full rounded-full transition-[width] duration-200 ${item.status === 'done' ? 'bg-emerald-500' : 'bg-electric-600'}`}
                          style={{ width: `${Math.max(4, Math.round(item.progress * 100))}%` }}
                        />
                      </div>
                      <div className="mt-1 text-xs text-navy-500">
                        {item.status === 'done' ? 'Uploaded' : `${Math.round(item.progress * 100)}%`}
                      </div>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={item.caption}
                        maxLength={500}
                        onChange={(e) => update(item.key, { caption: e.target.value })}
                        placeholder="Add a caption (optional)"
                        aria-label={`Caption for ${item.file.name}`}
                        className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-base text-navy-900 placeholder:text-navy-400 focus:border-electric-600 focus:outline-none focus:ring-2 focus:ring-electric-600/20 sm:text-sm"
                      />
                      {item.status === 'error' && (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-semantic-error">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0 flex-1">{item.error}</span>
                          <button
                            type="button"
                            onClick={uploadAll}
                            disabled={uploading}
                            className="inline-flex items-center gap-1 font-semibold text-electric-700 hover:underline disabled:opacity-50"
                          >
                            <RotateCw className="h-3.5 w-3.5" /> Retry
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Shared details */}
        <div className="space-y-4">
          {allowHideFromCustomer && (
            <Checkbox
              id="upload-visible"
              label="Customer can see these"
              description="Turn off for workshop-only photos and videos."
              checked={visible}
              disabled={uploading}
              onChange={(e) => setVisible(e.target.checked)}
            />
          )}
          {hasVideos && <p className="text-xs text-navy-500">Videos can take a while on mobile data. Keep this screen open until they finish.</p>}
        </div>
      </div>
    </Modal>
  );
}

const MAIN_STAGES: { value: MediaStage; label: string; hint: string }[] = [
  { value: 'Before', label: 'Before service', hint: 'Car as it came in' },
  { value: 'After', label: 'After service', hint: 'Work done, ready to hand over' },
];
const MORE_STAGES: { value: MediaStage; label: string }[] = [
  { value: 'Inspection', label: 'Inspection' },
  { value: 'During', label: 'During work' },
  { value: 'Other', label: 'Other' },
];

function StageOption({ label, hint, active, onClick }: { label: string; hint: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex min-h-[64px] flex-col items-start justify-center rounded-2xl border-2 px-3 py-2.5 text-left transition touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-600 ${
        active ? 'border-electric-600 bg-electric-50' : 'border-surface-200 bg-white hover:border-surface-300'
      }`}
    >
      <span className={`flex items-center gap-1.5 text-sm font-semibold ${active ? 'text-electric-800' : 'text-navy-900'}`}>
        {active && <CheckCircle2 className="h-4 w-4 text-electric-600" aria-hidden />}
        {label}
      </span>
      <span className="mt-0.5 text-xs text-navy-500">{hint}</span>
    </button>
  );
}

function PickerTile({ icon, label, hint, onClick, disabled }: { icon: React.ReactNode; label: string; hint?: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-surface-300 bg-surface-50 px-3 py-4 text-center text-sm font-semibold text-navy-800 transition hover:border-electric-400 hover:bg-electric-50 hover:text-electric-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-600 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
    >
      <span className="text-electric-600">{icon}</span>
      {label}
      {hint && <span className="text-xs font-normal text-navy-500">{hint}</span>}
    </button>
  );
}
