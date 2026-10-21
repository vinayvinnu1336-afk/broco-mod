import { formatBytes, makeThumbnail, uploadMediaFile, UploadHandle } from '@/lib/media';
import { MediaLimits, ServiceMedia } from '@/types/media';

/**
 * Photos and PDFs the customer attaches to a request (an old quotation, a bill, a dent, a warning light).
 * The API marks them as "Customer upload"; garages quoting the request can see them.
 */

export type CustomerFileKind = 'Photo' | 'Document';

export interface CustomerFileLimits {
  maxFiles: number;
  maxPhotoBytes: number;
  maxDocumentBytes: number;
  photoExtensions: string[];
  documentExtensions: string[];
}

/** Same as the API defaults (Media:MaxCustomerItemsPerRequest, MaxPhotoBytes, MaxDocumentBytes). */
export const CUSTOMER_FILE_LIMITS: CustomerFileLimits = {
  maxFiles: 10,
  maxPhotoBytes: 10 * 1024 * 1024,
  maxDocumentBytes: 10 * 1024 * 1024,
  photoExtensions: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
  documentExtensions: ['pdf'],
};

export function customerLimitsFrom(limits: MediaLimits | null | undefined, maxFiles?: number): CustomerFileLimits {
  if (!limits) return { ...CUSTOMER_FILE_LIMITS, maxFiles: maxFiles ?? CUSTOMER_FILE_LIMITS.maxFiles };
  return {
    maxFiles: maxFiles ?? CUSTOMER_FILE_LIMITS.maxFiles,
    maxPhotoBytes: limits.maxPhotoBytes,
    maxDocumentBytes: limits.maxDocumentBytes ?? CUSTOMER_FILE_LIMITS.maxDocumentBytes,
    photoExtensions: limits.photoExtensions,
    documentExtensions: limits.documentExtensions ?? CUSTOMER_FILE_LIMITS.documentExtensions,
  };
}

/** The file picker's accept list: photos (HEIC by name, as some browsers give it no type) and PDFs. */
export const CUSTOMER_FILE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf,.pdf';

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** Same rules as the API (which also checks the file's bytes), so mistakes show before anything is sent. */
export function checkCustomerFile(file: File, limits: CustomerFileLimits = CUSTOMER_FILE_LIMITS): { kind: CustomerFileKind } | { error: string } {
  const ext = extensionOf(file.name);
  const type = (file.type || '').toLowerCase();
  const isDocument = limits.documentExtensions.includes(ext) || (!ext && type === 'application/pdf');
  const isPhoto = !isDocument && (limits.photoExtensions.includes(ext) || (!ext && type.startsWith('image/') && type !== 'image/gif'));
  if (!isPhoto && !isDocument) {
    return {
      error: type.startsWith('video/')
        ? 'Videos can’t be added here. Add photos (JPG, PNG, WebP, HEIC) or a PDF.'
        : 'Not a supported file. Add photos (JPG, PNG, WebP, HEIC) or a PDF.',
    };
  }
  if (file.size === 0) return { error: 'This file is empty.' };
  const kind: CustomerFileKind = isDocument ? 'Document' : 'Photo';
  const max = kind === 'Photo' ? limits.maxPhotoBytes : limits.maxDocumentBytes;
  if (file.size > max) return { error: `${formatBytes(file.size)} is too big. ${kind === 'Photo' ? 'Photos' : 'PDFs'} can be up to ${formatBytes(max)}.` };
  return { kind };
}

export type DraftStatus = 'ready' | 'invalid' | 'uploading' | 'done' | 'error';

/** A file picked by the customer, before or while it is uploaded. */
export interface CustomerFileDraft {
  key: string;
  file: File;
  kind: CustomerFileKind | null;
  caption: string;
  status: DraftStatus;
  progress: number;
  error?: string;
  /** Object URL of the photo itself, for the small preview in the list. */
  previewUrl?: string;
}

let keySeq = 0;

/** Turns picked files into drafts; files beyond `room` are marked as over the limit. */
export function draftsFromFiles(files: FileList | File[], room: number, limits: CustomerFileLimits = CUSTOMER_FILE_LIMITS): CustomerFileDraft[] {
  let left = room;
  return Array.from(files).map((file) => {
    const key = `cf${++keySeq}`;
    const check = checkCustomerFile(file, limits);
    if ('error' in check) return { key, file, kind: null, caption: '', status: 'invalid', progress: 0, error: check.error };
    if (left <= 0) {
      return { key, file, kind: check.kind, caption: '', status: 'invalid', progress: 0, error: `You can add up to ${limits.maxFiles} files.` };
    }
    left -= 1;
    const previewUrl = check.kind === 'Photo' && typeof URL !== 'undefined' ? URL.createObjectURL(file) : undefined;
    return { key, file, kind: check.kind, caption: '', status: 'ready', progress: 0, previewUrl };
  });
}

export function releaseDraft(draft: CustomerFileDraft) {
  if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
}

/** Uploads one customer file (with a small browser-made preview for photos) and reports progress. */
export async function uploadCustomerFile(
  requestId: string,
  draft: CustomerFileDraft,
  onProgress: (fraction: number) => void,
  onHandle?: (handle: UploadHandle) => void
): Promise<{ ok: true; media: ServiceMedia } | { ok: false; message: string }> {
  const thumbnail = draft.kind === 'Photo' ? await makeThumbnail(draft.file, 'Photo') : null;
  const handle = uploadMediaFile(
    `/media/requests/${requestId}`,
    draft.file,
    { caption: draft.caption, stage: 'CustomerUpload', isVisibleToCustomer: true, thumbnail },
    onProgress
  );
  onHandle?.(handle);
  return handle.promise;
}

// Files that did not upload right after booking are kept here (in memory) so the request page can offer a
// retry without the customer picking them again. A page reload loses them; the request page then simply
// shows what did upload.
const unsent = new Map<string, CustomerFileDraft[]>();

export function setUnsentFiles(requestId: string, drafts: CustomerFileDraft[]) {
  if (drafts.length === 0) unsent.delete(requestId);
  else unsent.set(requestId, drafts.map((d) => ({ ...d, status: (d.status === 'ready' ? 'ready' : 'error') as DraftStatus, progress: 0 })));
}

export function unsentFiles(requestId: string): CustomerFileDraft[] {
  return unsent.get(requestId) ?? [];
}
