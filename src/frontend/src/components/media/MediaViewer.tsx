'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, EyeOff, Eye, ImageOff, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { formatDateTime } from '@/lib/format';
import { resolveMediaUrl } from '@/lib/media';
import { MediaStage, ServiceMedia, UpdateServiceMediaRequest } from '@/types/media';
import { StageChips, stageLabel } from './StageChips';

export interface MediaViewerProps {
  items: ServiceMedia[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Staff only: save caption / stage / visibility. Resolves to an error message, or null when saved. */
  onUpdate?: (item: ServiceMedia, changes: UpdateServiceMediaRequest) => Promise<string | null>;
  onDelete?: (item: ServiceMedia) => Promise<string | null>;
  /** Show the "customer can see" state (not shown to customers themselves). */
  showVisibility?: boolean;
}

/**
 * Full-screen photo and video viewer: swipe, arrow keys or the side buttons to move, Escape to close.
 * On phones the details sit under the picture; from `lg` up they are a side panel.
 */
export function MediaViewer({ items, index, onIndexChange, onClose, onUpdate, onDelete, showVisibility = false }: MediaViewerProps) {
  const [mounted, setMounted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<{ caption: string; stage: MediaStage; visible: boolean }>({ caption: '', stage: 'Other', visible: true });
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const item = items[index];
  const count = items.length;
  const go = useCallback(
    (delta: number) => {
      if (count < 2) return;
      onIndexChange((index + delta + count) % count);
    },
    [count, index, onIndexChange]
  );

  useEffect(() => setMounted(true), []);

  // Leaving an item drops any half-done edit.
  useEffect(() => {
    setEditing(false);
    setError(null);
  }, [item?.id]);

  // Lock page scroll and restore focus to the tile that opened the viewer.
  useEffect(() => {
    if (!mounted) return;
    const returnFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [mounted]);

  // The confirm dialog unlocks the page when it closes; lock it again while the viewer is still open.
  const wasConfirming = useRef(false);
  useEffect(() => {
    if (wasConfirming.current && !confirmDelete) document.body.style.overflow = 'hidden';
    wasConfirming.current = confirmDelete;
  }, [confirmDelete]);

  useEffect(() => {
    if (confirmDelete) return; // the dialog on top handles keys
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable);
      if (e.key === 'Escape') {
        e.preventDefault();
        if (editing) setEditing(false);
        else onClose();
      } else if (!typing && e.key === 'ArrowLeft') {
        go(-1);
      } else if (!typing && e.key === 'ArrowRight') {
        go(1);
      } else if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, textarea, video[controls], [tabindex]:not([tabindex="-1"])')
        ).filter((el) => el.getClientRects().length > 0);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmDelete, editing, go, onClose]);

  if (!mounted || !item) return null;

  const src = resolveMediaUrl(item.url);
  const poster = resolveMediaUrl(item.thumbnailUrl);
  const label = item.caption || `${item.kind === 'Video' ? 'Video' : 'Photo'} ${index + 1} of ${count}`;
  const canEdit = !!onUpdate && item.canEdit;
  const canDelete = !!onDelete && item.canDelete;

  function startEdit() {
    setForm({ caption: item.caption ?? '', stage: item.stage, visible: item.isVisibleToCustomer });
    setError(null);
    setEditing(true);
  }

  async function save() {
    if (!onUpdate) return;
    setBusy(true);
    const message = await onUpdate(item, { caption: form.caption, stage: form.stage, isVisibleToCustomer: form.visible });
    setBusy(false);
    if (message) setError(message);
    else setEditing(false);
  }

  async function quickToggleVisibility() {
    if (!onUpdate) return;
    setBusy(true);
    const message = await onUpdate(item, { isVisibleToCustomer: !item.isVisibleToCustomer });
    setBusy(false);
    setError(message);
  }

  async function remove() {
    if (!onDelete) return;
    setBusy(true);
    const message = await onDelete(item);
    setBusy(false);
    setConfirmDelete(false);
    if (message) setError(message);
  }

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  };

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${label}. Photos and videos viewer`}
      className="fixed inset-0 z-[55] flex flex-col bg-navy-950 text-white animate-fade-in lg:flex-row"
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
          <span className="text-sm font-medium tabular-nums text-white/80" aria-live="polite">
            {index + 1} / {count}
          </span>
          <div className="flex items-center gap-1">
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Open the original in a new tab"
            >
              <Download className="h-5 w-5" />
            </a>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Close viewer"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Media */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-2 sm:px-14" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {failed[item.id] ? (
            <div className="flex max-w-xs flex-col items-center gap-3 text-center text-sm text-white/80">
              <ImageOff className="h-10 w-10 text-white/50" />
              <p>This {item.kind === 'Video' ? 'video' : 'photo'} can’t be shown in this browser.</p>
              <a href={src} target="_blank" rel="noopener noreferrer" className="font-semibold text-electric-300 underline">
                Open or download it
              </a>
            </div>
          ) : item.kind === 'Video' ? (
            <video
              key={item.id}
              src={src}
              poster={poster}
              controls
              playsInline
              preload="metadata"
              className="max-h-full max-w-full rounded-lg bg-black"
              onError={() => setFailed((f) => ({ ...f, [item.id]: true }))}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={item.id}
              src={src}
              alt={label}
              className="max-h-full max-w-full select-none rounded-lg object-contain"
              draggable={false}
              onError={() => setFailed((f) => ({ ...f, [item.id]: true }))}
            />
          )}

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                className="absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:inline-flex"
                aria-label="Previous"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                className="absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:inline-flex"
                aria-label="Next"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
        </div>

        {/* Phone: dots + prev/next row */}
        {count > 1 && (
          <div className="flex items-center justify-center gap-4 pb-2 sm:hidden">
            <button type="button" onClick={() => go(-1)} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white/80 active:bg-white/10" aria-label="Previous">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div className="flex max-w-[50vw] gap-1.5 overflow-hidden" aria-hidden="true">
              {items.slice(0, 12).map((m, i) => (
                <span key={m.id} className={`h-1.5 w-1.5 shrink-0 rounded-full ${i === index ? 'bg-white' : 'bg-white/30'}`} />
              ))}
            </div>
            <button type="button" onClick={() => go(1)} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white/80 active:bg-white/10" aria-label="Next">
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="max-h-[42dvh] shrink-0 overflow-y-auto rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-navy-900 lg:max-h-none lg:w-[360px] lg:rounded-none lg:border-l lg:border-surface-200 lg:p-5">
        {editing ? (
          <div className="space-y-4">
            <Textarea
              label="Caption"
              rows={2}
              maxLength={500}
              value={form.caption}
              onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
              placeholder="e.g. Scratch on the front bumper"
            />
            <div>
              <div className="mb-1.5 text-sm font-medium text-navy-800" id="viewer-stage-label">
                Stage
              </div>
              <StageChips value={form.stage} onChange={(stage) => setForm((f) => ({ ...f, stage }))} labelledBy="viewer-stage-label" />
            </div>
            <Checkbox
              id="viewer-visible"
              label="Customer can see this"
              description="Turn off for workshop-only photos."
              checked={form.visible}
              onChange={(e) => setForm((f) => ({ ...f, visible: e.target.checked }))}
            />
            {error && <p className="text-sm text-semantic-error">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditing(false)} disabled={busy}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={save} isLoading={busy}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-electric-50 px-2.5 py-0.5 text-xs font-semibold text-electric-700">
                {stageLabel(item.stage)}
              </span>
              {showVisibility &&
                (item.isVisibleToCustomer ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    <Eye className="h-3.5 w-3.5" /> Customer can see
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2.5 py-0.5 text-xs font-medium text-navy-600">
                    <EyeOff className="h-3.5 w-3.5" /> Hidden from customer
                  </span>
                ))}
            </div>
            <p className={`whitespace-pre-wrap break-words text-[15px] ${item.caption ? 'text-navy-900' : 'text-navy-400'}`}>
              {item.caption || 'No caption'}
            </p>
            <p className="text-xs text-navy-500">
              {item.uploadedByName} · {formatDateTime(item.createdAtUtc)}
            </p>
            {error && <p className="text-sm text-semantic-error">{error}</p>}
            {(canEdit || canDelete) && (
              <div className="flex flex-wrap gap-2 border-t border-surface-200 pt-3">
                {canEdit && (
                  <Button variant="outline" size="sm" leftIcon={<Pencil className="h-4 w-4" />} onClick={startEdit}>
                    Edit
                  </Button>
                )}
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={item.isVisibleToCustomer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    onClick={quickToggleVisibility}
                    isLoading={busy}
                  >
                    {item.isVisibleToCustomer ? 'Hide from customer' : 'Show to customer'}
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-semantic-error hover:bg-red-50 hover:text-red-700"
                    leftIcon={<Trash2 className="h-4 w-4" />}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmationDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        isLoading={busy}
        variant="danger"
        title={`Delete this ${item.kind === 'Video' ? 'video' : 'photo'}?`}
        message="It will be removed for the garage, the advisor and the customer."
        confirmText="Delete"
      />
    </div>,
    document.body
  );
}
