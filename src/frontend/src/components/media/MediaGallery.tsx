'use client';

import React, { useState } from 'react';
import { EyeOff, FileText, Film, ImageOff, Play } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/media';
import { ServiceMedia, UpdateServiceMediaRequest } from '@/types/media';
import { MediaViewer } from './MediaViewer';
import { stageLabel } from './StageChips';

const GRID = {
  normal: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5',
  dense: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4',
  compact: 'grid-cols-4 sm:grid-cols-6 lg:grid-cols-8',
};

export interface MediaGalleryProps {
  items: ServiceMedia[];
  /** Staff screens: show which items are hidden from the customer. */
  showVisibility?: boolean;
  onUpdate?: (item: ServiceMedia, changes: UpdateServiceMediaRequest) => Promise<string | null>;
  onDelete?: (item: ServiceMedia) => Promise<string | null>;
  /** Called when a picture fails to load, e.g. because its signed link expired while the page was open. */
  onLoadError?: () => void;
  /** Inside a stage group (Before / After ...) the stage chip on each tile is redundant. */
  hideStageLabel?: boolean;
  /** "dense": fewer columns from md up, for half-width groups. "compact": small tiles for minor groups. */
  density?: 'normal' | 'dense' | 'compact';
}

/** Square thumbnails (3 across on phones, 4-5 on wider screens); tap one to open the full-screen viewer. */
export function MediaGallery({
  items,
  showVisibility = false,
  onUpdate,
  onDelete,
  onLoadError,
  hideStageLabel = false,
  density = 'normal',
}: MediaGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  const safeIndex = openIndex != null && items.length > 0 ? Math.min(openIndex, items.length - 1) : null;

  return (
    <>
      <ul
        className={`grid gap-2 ${GRID[density]}`}
        aria-label="Photos and videos"
      >
        {items.map((item, i) => {
          const thumb = resolveMediaUrl(item.thumbnailUrl ?? (item.kind === 'Photo' ? item.url : null));
          const label = item.caption || `${item.kind === 'Video' ? 'Video' : 'Photo'} ${i + 1}`;
          if (item.kind === 'Document') return <DocumentTile key={item.id} item={item} />;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setOpenIndex(i)}
                className="group relative block aspect-square w-full overflow-hidden rounded-xl bg-surface-100 ring-1 ring-inset ring-surface-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-600 focus-visible:ring-offset-2"
                aria-label={`Open ${item.kind === 'Video' ? 'video' : 'photo'}: ${label}`}
              >
                {thumb && !broken[item.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                    onError={() => {
                      setBroken((b) => ({ ...b, [item.id]: true }));
                      onLoadError?.();
                    }}
                  />
                ) : (
                  <span
                    className={`flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                      item.kind === 'Video' ? 'bg-navy-800 text-white/70' : 'text-navy-400'
                    }`}
                  >
                    {item.kind === 'Video' ? <Film className="h-6 w-6" /> : <ImageOff className="h-6 w-6" />}
                    <span className="max-w-full truncate px-1">{item.kind === 'Video' ? 'Video' : item.fileName.split('.').pop()?.toUpperCase()}</span>
                  </span>
                )}

                {item.kind === 'Video' && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-950/60 text-white shadow-sm backdrop-blur-[2px]">
                      <Play className="ml-0.5 h-5 w-5 fill-current" />
                    </span>
                  </span>
                )}

                {!hideStageLabel && (
                  <span className="pointer-events-none absolute bottom-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate rounded-full bg-navy-950/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-[2px]">
                    {stageLabel(item.stage)}
                  </span>
                )}

                {showVisibility && !item.isVisibleToCustomer && (
                  <span
                    className="pointer-events-none absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-navy-700 shadow-sm"
                    title="Hidden from customer"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    <span className="sr-only">Hidden from customer</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {safeIndex != null && (
        <MediaViewer
          items={items}
          index={safeIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
          onUpdate={onUpdate}
          onDelete={
            onDelete &&
            (async (item) => {
              const message = await onDelete(item);
              if (!message && items.length <= 1) setOpenIndex(null);
              return message;
            })
          }
          showVisibility={showVisibility}
        />
      )}
    </>
  );
}

/** PDFs (e.g. the customer's old quotation) open in a new tab through their signed link; browsers show them inline. */
function DocumentTile({ item }: { item: ServiceMedia }) {
  return (
    <li>
      <a
        href={resolveMediaUrl(item.url)}
        target="_blank"
        rel="noopener noreferrer"
        className="relative flex aspect-square w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-surface-50 px-2 text-center ring-1 ring-inset ring-surface-200 transition hover:bg-electric-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-600 focus-visible:ring-offset-2"
        aria-label={`Open PDF in a new tab: ${item.caption || item.fileName}`}
        title={item.caption ? `${item.caption} (${item.fileName})` : item.fileName}
      >
        <FileText className="h-7 w-7 text-electric-600" aria-hidden="true" />
        <span className="line-clamp-2 w-full break-all text-[11px] font-medium leading-tight text-navy-700">{item.fileName}</span>
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate rounded-full bg-navy-950/60 px-2 py-0.5 text-[11px] font-medium text-white">
          {stageLabel(item.stage)}
        </span>
      </a>
    </li>
  );
}
