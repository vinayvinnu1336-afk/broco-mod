'use client';

import React from 'react';
import { Camera, Plus } from 'lucide-react';
import { MediaStage, ServiceMedia, UpdateServiceMediaRequest } from '@/types/media';
import { MediaGallery } from './MediaGallery';

/** The two main groups, then the smaller ones (shown only when they have something). */
const MAIN_GROUPS: { stage: MediaStage; title: string; empty: string }[] = [
  { stage: 'Before', title: 'Before service', empty: 'No before photos yet' },
  { stage: 'After', title: 'After service', empty: 'No after photos yet' },
];
const EXTRA_GROUPS: { stage: MediaStage; title: string }[] = [
  { stage: 'Inspection', title: 'Inspection' },
  { stage: 'During', title: 'During work' },
  { stage: 'CustomerUpload', title: 'From customer' },
  { stage: 'Other', title: 'Other' },
];
const KNOWN = new Set<string>([...MAIN_GROUPS, ...EXTRA_GROUPS].map((g) => g.stage));

/** Items per group; anything with a stage this screen doesn't know goes under Other. */
export function groupMediaByStage(items: ServiceMedia[]): Record<string, ServiceMedia[]> {
  const groups: Record<string, ServiceMedia[]> = {};
  for (const item of items) {
    const key = KNOWN.has(item.stage) ? item.stage : 'Other';
    (groups[key] ??= []).push(item);
  }
  return groups;
}

export interface MediaStageGroupsProps {
  items: ServiceMedia[];
  showVisibility?: boolean;
  onUpdate?: (item: ServiceMedia, changes: UpdateServiceMediaRequest) => Promise<string | null>;
  onDelete?: (item: ServiceMedia) => Promise<string | null>;
  onLoadError?: () => void;
  /** When set, each main group's empty state offers "Add" for that stage. */
  onAdd?: (stage: MediaStage) => void;
  /** Ids prefix for headings (several sections can be on one page). */
  idPrefix: string;
}

/**
 * "Before service" and "After service" side by side from `md` up (stacked on phones), each with a count and an
 * empty state, then Inspection / During work / From customer / Other below, only when they have items.
 */
export function MediaStageGroups({ items, showVisibility, onUpdate, onDelete, onLoadError, onAdd, idPrefix }: MediaStageGroupsProps) {
  const groups = groupMediaByStage(items);
  const extras = EXTRA_GROUPS.filter((g) => (groups[g.stage]?.length ?? 0) > 0);

  const gallery = (list: ServiceMedia[], dense: boolean) => (
    <MediaGallery
      items={list}
      showVisibility={showVisibility}
      onUpdate={onUpdate}
      onDelete={onDelete}
      onLoadError={onLoadError}
      hideStageLabel
      density={dense ? 'dense' : 'compact'}
    />
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {MAIN_GROUPS.map((g) => {
          const list = groups[g.stage] ?? [];
          const headingId = `${idPrefix}-${g.stage}`;
          return (
            <section
              key={g.stage}
              aria-labelledby={headingId}
              className={`min-w-0 rounded-xl border p-3 ${g.stage === 'After' ? 'border-emerald-200 bg-emerald-50/40' : 'border-surface-200 bg-surface-50/60'}`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 id={headingId} className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${g.stage === 'After' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    aria-hidden
                  />
                  {g.title}
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium tabular-nums text-navy-600 ring-1 ring-inset ring-surface-200">
                    <span className="sr-only">, </span>
                    {list.length}
                    <span className="sr-only"> {list.length === 1 ? 'item' : 'items'}</span>
                  </span>
                </h3>
                {onAdd && list.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onAdd(g.stage)}
                    className="inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2 text-xs font-semibold text-electric-700 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-600"
                    aria-label={`Add ${g.title.toLowerCase()} photos`}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    Add
                  </button>
                )}
              </div>
              {list.length > 0 ? (
                gallery(list, true)
              ) : onAdd ? (
                <button
                  type="button"
                  onClick={() => onAdd(g.stage)}
                  className="flex w-full items-center gap-3 rounded-lg border border-dashed border-surface-300 bg-white p-3 text-left text-sm text-navy-500 transition hover:border-electric-400 hover:text-electric-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-600"
                >
                  <Camera className="h-5 w-5 shrink-0 text-navy-400" aria-hidden />
                  <span>
                    {g.empty}. <span className="font-semibold text-electric-700">Add</span>
                  </span>
                </button>
              ) : (
                <p className="flex items-center gap-3 rounded-lg border border-dashed border-surface-300 bg-white p-3 text-sm text-navy-500">
                  <Camera className="h-5 w-5 shrink-0 text-navy-400" aria-hidden />
                  {g.empty}
                </p>
              )}
            </section>
          );
        })}
      </div>

      {extras.map((g) => {
        const list = groups[g.stage]!;
        const headingId = `${idPrefix}-${g.stage}`;
        return (
          <section key={g.stage} aria-labelledby={headingId} className="min-w-0">
            <h3 id={headingId} className="mb-2 flex items-center gap-2 px-0.5 text-xs font-semibold uppercase tracking-wide text-navy-500">
              {g.title}
              <span className="tabular-nums font-medium normal-case tracking-normal text-navy-400">· {list.length}</span>
            </h3>
            {gallery(list, false)}
          </section>
        );
      })}
    </div>
  );
}
