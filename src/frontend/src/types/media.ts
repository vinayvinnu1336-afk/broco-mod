export type MediaKind = 'Photo' | 'Video';
export type MediaStage = 'Before' | 'During' | 'After' | 'Inspection' | 'Other';

export const MEDIA_STAGES: { value: MediaStage; label: string }[] = [
  { value: 'Before', label: 'Before' },
  { value: 'During', label: 'During work' },
  { value: 'After', label: 'After' },
  { value: 'Inspection', label: 'Inspection' },
  { value: 'Other', label: 'Other' },
];

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
