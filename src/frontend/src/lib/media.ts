import { getApiBase } from '@/lib/api';
import { MediaKind, MediaLimits, MediaStage, ServiceMedia } from '@/types/media';

/** Used until the list response says otherwise (they match the API defaults). */
export const DEFAULT_MEDIA_LIMITS: MediaLimits = {
  maxPhotoBytes: 10 * 1024 * 1024,
  maxVideoBytes: 100 * 1024 * 1024,
  photoExtensions: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
  videoExtensions: ['mp4', 'mov', 'webm', 'm4v'],
};

/**
 * Signed media links come back as paths on the API host (/api/v1/media/...). In local dev the API is on
 * another port, behind Nginx it is the same origin.
 */
export function resolveMediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  const base = getApiBase();
  if (/^https?:\/\//i.test(base)) return `${new URL(base).origin}${path}`;
  return path;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** Same rules as the API (which also checks the file's bytes); catches mistakes before a long upload. */
export function checkMediaFile(file: File, limits: MediaLimits): { kind: MediaKind } | { error: string } {
  const ext = extensionOf(file.name);
  const type = (file.type || '').toLowerCase();
  const isPhoto = limits.photoExtensions.includes(ext) || (!ext && type.startsWith('image/'));
  const isVideo = limits.videoExtensions.includes(ext) || (!ext && type.startsWith('video/'));
  if (!isPhoto && !isVideo) {
    return { error: 'Not a supported photo or video. Use JPG, PNG, WebP or HEIC photos, or MP4, MOV or WebM videos.' };
  }
  if (file.size === 0) return { error: 'This file is empty.' };
  const kind: MediaKind = isPhoto ? 'Photo' : 'Video';
  const max = kind === 'Photo' ? limits.maxPhotoBytes : limits.maxVideoBytes;
  if (file.size > max) {
    return { error: `${formatBytes(file.size)} is too big. ${kind === 'Photo' ? 'Photos' : 'Videos'} can be up to ${formatBytes(max)}.` };
  }
  return { kind };
}

const THUMB_MAX = 480;

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.78));
}

function drawScaled(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement | null {
  if (!width || !height) return null;
  const scale = Math.min(1, THUMB_MAX / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * A small JPEG preview made in the browser: the photo scaled down, or a video's first frame. Galleries load
 * these instead of full photos, which matters on phone data. Returns null when the browser can't decode the
 * file (e.g. HEIC outside Safari); the API then serves the original.
 */
export async function makeThumbnail(file: File, kind: MediaKind): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const url = URL.createObjectURL(file);
  try {
    if (kind === 'Photo') {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      const canvas = drawScaled(img, img.naturalWidth, img.naturalHeight);
      return canvas ? await canvasToBlob(canvas) : null;
    }

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('timeout')), 5000);
      video.onloadeddata = () => {
        video.currentTime = Math.min(0.5, (video.duration || 1) / 4);
      };
      video.onseeked = () => {
        window.clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error('decode'));
      };
    });
    const canvas = drawScaled(video, video.videoWidth, video.videoHeight);
    return canvas ? await canvasToBlob(canvas) : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface UploadFields {
  caption?: string;
  stage: MediaStage;
  isVisibleToCustomer: boolean;
  thumbnail?: Blob | null;
}

export interface UploadHandle {
  promise: Promise<{ ok: true; media: ServiceMedia } | { ok: false; message: string }>;
  abort: () => void;
}

/** Uploads one file with XMLHttpRequest so the caller gets real upload progress (fetch can't report it). */
export function uploadMediaFile(endpoint: string, file: File, fields: UploadFields, onProgress: (fraction: number) => void): UploadHandle {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<{ ok: true; media: ServiceMedia } | { ok: false; message: string }>((resolve) => {
    const form = new FormData();
    form.append('file', file, file.name);
    if (fields.caption?.trim()) form.append('caption', fields.caption.trim());
    form.append('stage', fields.stage);
    form.append('isVisibleToCustomer', String(fields.isVisibleToCustomer));
    if (fields.thumbnail) form.append('thumbnail', fields.thumbnail, 'thumbnail.jpg');

    xhr.open('POST', `${getApiBase()}${endpoint}`);
    const token = typeof window !== 'undefined' ? localStorage.getItem('broco_access_token') : null;
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.responseType = 'json';

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(0.99, e.loaded / e.total));
    };
    xhr.onload = () => {
      const body = xhr.response as { success?: boolean; message?: string; data?: ServiceMedia } | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.data) {
        onProgress(1);
        resolve({ ok: true, media: body.data });
      } else if (xhr.status === 401) {
        resolve({ ok: false, message: 'Your session has expired. Sign in again and retry.' });
      } else if (xhr.status === 413) {
        resolve({ ok: false, message: 'This file is too big to upload.' });
      } else {
        resolve({ ok: false, message: body?.message || `Upload failed (${xhr.status || 'network error'}).` });
      }
    };
    xhr.onerror = () => resolve({ ok: false, message: 'Upload failed. Check your internet connection and retry.' });
    xhr.onabort = () => resolve({ ok: false, message: 'Upload cancelled.' });
    xhr.send(form);
  });
  return { promise, abort: () => xhr.abort() };
}
