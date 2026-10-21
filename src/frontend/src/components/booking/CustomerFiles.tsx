'use client';

import React, { useRef } from 'react';
import { AlertCircle, CheckCircle2, FileText, Paperclip, RotateCw, X } from 'lucide-react';
import { formatBytes } from '@/lib/media';
import {
  CUSTOMER_FILE_ACCEPT,
  CUSTOMER_FILE_LIMITS,
  CustomerFileDraft,
  CustomerFileLimits,
  draftsFromFiles,
  releaseDraft,
} from '@/lib/customerUploads';

export interface CustomerFilesFieldProps {
  drafts: CustomerFileDraft[];
  onChange: (drafts: CustomerFileDraft[]) => void;
  /** How many more files may be added (the limit minus what is already uploaded). */
  room: number;
  limits?: CustomerFileLimits;
  disabled?: boolean;
  /** Request page: retry one failed upload. */
  onRetry?: (key: string) => void;
  /** Id for the picker button, so a label elsewhere can point at it. */
  id?: string;
}

/**
 * Pick photos and PDFs (camera or gallery on phones), add an optional caption to each, remove any.
 * Shows upload progress and errors when the parent uploads them.
 */
export function CustomerFilesField({ drafts, onChange, room, limits = CUSTOMER_FILE_LIMITS, disabled = false, onRetry, id }: CustomerFilesFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const pending = drafts.filter((d) => d.status !== 'invalid' && d.status !== 'done').length;
  const left = Math.max(0, room - pending);

  function add(files: FileList | null) {
    if (!files || files.length === 0) return;
    onChange([...drafts, ...draftsFromFiles(files, left, limits)]);
  }

  function remove(key: string) {
    const draft = drafts.find((d) => d.key === key);
    if (draft) releaseDraft(draft);
    onChange(drafts.filter((d) => d.key !== key));
  }

  function setCaption(key: string, caption: string) {
    onChange(drafts.map((d) => (d.key === key ? { ...d, caption } : d)));
  }

  return (
    <div className="space-y-3">
      {drafts.length > 0 && (
        <ul className="divide-y divide-surface-200 overflow-hidden rounded-2xl border border-surface-200 bg-white" aria-label="Files to attach">
          {drafts.map((d) => (
            <li key={d.key} className="flex gap-3 p-3">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-100 text-navy-400">
                {d.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.previewUrl} alt="" className="h-full w-full object-cover" />
                ) : d.kind === 'Document' ? (
                  <span className="flex flex-col items-center gap-0.5 text-electric-600">
                    <FileText className="h-6 w-6" aria-hidden="true" />
                    <span className="text-[10px] font-bold tracking-wide">PDF</span>
                  </span>
                ) : (
                  <Paperclip className="h-5 w-5" aria-hidden="true" />
                )}
                {d.status === 'done' && (
                  <span className="absolute inset-0 flex items-center justify-center bg-emerald-600/70 text-white">
                    <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-navy-900">{d.file.name}</div>
                    <div className="text-xs text-navy-500">
                      {d.kind === 'Document' ? 'PDF' : d.kind === 'Photo' ? 'Photo' : 'File'} · {formatBytes(d.file.size)}
                    </div>
                  </div>
                  {d.status !== 'uploading' && d.status !== 'done' && !disabled && (
                    <button
                      type="button"
                      onClick={() => remove(d.key)}
                      className="-mr-1 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-navy-400 hover:bg-surface-100 hover:text-navy-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-600"
                      aria-label={`Remove ${d.file.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {d.status === 'invalid' ? (
                  <p className="flex items-start gap-1.5 text-xs text-semantic-error">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {d.error}
                  </p>
                ) : d.status === 'uploading' || d.status === 'done' ? (
                  <div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-surface-200"
                      role="progressbar"
                      aria-label={`Uploading ${d.file.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(d.progress * 100)}
                    >
                      <div
                        className={`h-full rounded-full transition-[width] duration-200 ${d.status === 'done' ? 'bg-emerald-500' : 'bg-electric-600'}`}
                        style={{ width: `${Math.max(4, Math.round(d.progress * 100))}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-navy-500">{d.status === 'done' ? 'Uploaded' : `Uploading… ${Math.round(d.progress * 100)}%`}</div>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={d.caption}
                      maxLength={500}
                      disabled={disabled}
                      onChange={(e) => setCaption(d.key, e.target.value)}
                      placeholder={d.kind === 'Document' ? 'What is it? e.g. Last service bill (optional)' : 'What does it show? (optional)'}
                      aria-label={`Caption for ${d.file.name}`}
                      className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-base text-navy-900 placeholder:text-navy-400 focus:border-electric-600 focus:outline-none focus:ring-2 focus:ring-electric-600/20 disabled:bg-surface-50 sm:text-sm"
                    />
                    {d.status === 'error' && (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-semantic-error" role="alert">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1">{d.error || 'Not uploaded.'}</span>
                        {onRetry && (
                          <button
                            type="button"
                            onClick={() => onRetry(d.key)}
                            disabled={disabled}
                            className="inline-flex min-h-[32px] items-center gap-1 font-semibold text-electric-700 hover:underline disabled:opacity-50"
                          >
                            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        id={id}
        type="button"
        onClick={() => input.current?.click()}
        disabled={disabled || left <= 0}
        className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl border-2 border-dashed border-surface-300 bg-surface-50 px-4 py-3 text-left transition hover:border-electric-400 hover:bg-electric-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-600 disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-electric-600 shadow-sm">
          <Paperclip className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-navy-900">
            {left <= 0 ? `Up to ${limits.maxFiles} files` : drafts.length > 0 ? 'Add more' : 'Add photos or PDFs'}
          </span>
          <span className="block text-xs text-navy-500">
            JPG, PNG, WebP, HEIC or PDF · up to {formatBytes(Math.max(limits.maxPhotoBytes, limits.maxDocumentBytes))} each
          </span>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept={CUSTOMER_FILE_ACCEPT}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
