'use client';

import React from 'react';
import { MEDIA_STAGES, MediaStage } from '@/types/media';

export function stageLabel(stage: MediaStage | string): string {
  return MEDIA_STAGES.find((s) => s.value === stage)?.label ?? String(stage);
}

/** Single-choice chips for when a photo or video was taken. Wraps instead of scrolling (only five options). */
export function StageChips({
  value,
  onChange,
  labelledBy,
  disabled,
}: {
  value: MediaStage;
  onChange: (stage: MediaStage) => void;
  labelledBy?: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {MEDIA_STAGES.map((stage) => {
        const active = stage.value === value;
        return (
          <button
            key={stage.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(stage.value)}
            className={`inline-flex min-h-[36px] items-center rounded-full border px-3.5 text-sm font-medium transition touch-manipulation disabled:opacity-50 ${
              active
                ? 'border-navy-900 bg-navy-900 text-white'
                : 'border-surface-200 bg-white text-navy-600 hover:border-surface-300 hover:text-navy-900'
            }`}
          >
            {stage.label}
          </button>
        );
      })}
    </div>
  );
}
