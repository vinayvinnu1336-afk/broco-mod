/** Document: a PDF (an old quotation, a bill) added by the customer. */
export type MediaKind = 'Photo' | 'Video' | 'Document';
/** CustomerUpload is set by the API for what the customer adds; it is never picked in the uploader. */
export type MediaStage = 'Before' | 'During' | 'After' | 'Inspection' | 'Other' | 'CustomerUpload';

export const MEDIA_STAGES: { value: MediaStage; label: string }[] = [
  { value: 'Before', label: 'Before' },
  { value: 'During', label: 'During work' },
  { value: 'After', label: 'After' },
  { value: 'Inspection', label: 'Inspection' },
  { value: 'Other', label: 'Other' },
];

export const CUSTOMER_UPLOAD_LABEL = 'From customer';

/** A photo or video on a service request. `url`/`thumbnailUrl` are signed paths on the API host. */
export interface ServiceMedia {
  id: string;
  serviceRequestId: string;
  serviceJobId?: string | null;
  kind: MediaKind;
  stage: MediaStage;
  caption?: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  isVisibleToCustomer: boolean;
  uploadedByRole: string;
  uploadedByName: string;
  createdAtUtc: string;
  updatedAtUtc?: string | null;
  url: string;
  thumbnailUrl?: string | null;
  urlExpiresAtUtc: string;
  canEdit: boolean;
  canDelete: boolean;
}

export interface MediaLimits {
  maxPhotoBytes: number;
  maxVideoBytes: number;
  photoExtensions: string[];
  videoExtensions: string[];
  /** Older API builds don't send these. */
  maxDocumentBytes?: number;
  documentExtensions?: string[];
}

export interface ServiceMediaList {
  serviceRequestId: string;
  serviceJobId?: string | null;
  items: ServiceMedia[];
  canUpload: boolean;
  canEdit: boolean;
  maxItems: number;
  remainingSlots: number;
  limits: MediaLimits;
}

export interface UpdateServiceMediaRequest {
  caption?: string | null;
  stage?: MediaStage | null;
  isVisibleToCustomer?: boolean | null;
}
