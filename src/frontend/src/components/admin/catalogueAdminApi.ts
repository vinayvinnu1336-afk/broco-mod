// Admin-only catalogue, pricing, commission and enquiry API calls (SUPER_ADMIN).
import { apiFetch, getApiBase } from '@/lib/api';
import type { CarModel, Manufacturer, ServicePackage } from '@/lib/catalogue';
import type { ApiResponse } from '@/types/auth';
import type { PagedResult } from './FormControls';

export const BODY_TYPES = ['Hatchback', 'Sedan', 'SUV', 'MUV', 'Van', 'Pickup', 'Coupe', 'Convertible'] as const;

/** Sensible pricing segment for a body type, used as the default when adding a model. */
export const SEGMENT_FOR_BODY: Record<string, string> = {
  Hatchback: 'Hatchback',
  Sedan: 'Sedan',
  SUV: 'SUV',
  MUV: 'SUV',
  Van: 'SUV',
  Pickup: 'SUV',
  Coupe: 'Luxury',
  Convertible: 'Luxury',
};

export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
export const LOGO_MAX_BYTES = 512 * 1024;

export interface ManufacturerInput {
  name: string;
  country: string;
  displayOrder: number;
  isActive: boolean;
  isPopular: boolean;
}

export interface ModelInput {
  name: string;
  bodyType: string;
  segment: string;
  fuels: string[];
  yearFrom: number;
  yearTo: number | null;
  isActive: boolean;
}

export interface PackageInput {
  name: string;
  tagline: string;
  intervalKm: number;
  intervalMonths: number;
  durationHours: number;
  warrantyKm: number;
  warrantyDays: number;
  includes: string[];
  displayOrder: number;
  isActive: boolean;
  isRecommended: boolean;
}

export interface PriceCell {
  packageCode: string;
  fuelType: string;
  price: number | null;
}

export interface ModelPriceSheet {
  modelId: string;
  manufacturerName: string;
  modelName: string;
  segment: string;
  fuels: string[];
  prices: PriceCell[];
}

export interface SegmentPriceResult {
  created: number;
  updated: number;
  skipped: number;
}

export interface Commission {
  id: string;
  commissionNumber: string;
  garageId: string;
  garageName: string;
  serviceJobId?: string;
  jobNumber: string;
  serviceRequestId?: string;
  requestNumber: string;
  vehicleSummary: string;
  currency?: string;
  serviceValue: number;
  advanceCollectedByPlatform: number;
  balanceCollectedByGarage: number;
  commissionPercentage: number;
  commissionAmount: number;
  taxPercentage?: number;
  taxAmount: number;
  totalDue: number;
  status: string;
  dueAtUtc: string;
  isOverdue: boolean;
  paidAtUtc: string | null;
  settledVia: string | null;
  paymentReference: string | null;
  waiverReason: string | null;
  remindersSent: number;
  lastReminderAtUtc: string | null;
  createdAtUtc?: string;
}

export interface CommissionOverview {
  outstandingAmount: number;
  outstandingCount: number;
  overdueAmount: number;
  overdueCount: number;
  collectedAmount: number;
  garagesWithOverdue: number;
}

export interface Lead {
  id: string;
  mobileNumber: string;
  city: string;
  vehicleModelId?: string | null;
  vehicleSummary: string;
  fuelType: string | null;
  serviceInterest: string | null;
  source: string;
  status: string;
  notes: string | null;
  createdAtUtc: string;
}

const json = (body: unknown) => JSON.stringify(body);

export const adminCatalogueApi = {
  createManufacturer: (body: ManufacturerInput) =>
    apiFetch<Manufacturer>('/admin/catalogue/manufacturers', { method: 'POST', body: json(body) }),
  updateManufacturer: (id: string, body: ManufacturerInput) =>
    apiFetch<Manufacturer>(`/admin/catalogue/manufacturers/${id}`, { method: 'PUT', body: json(body) }),
  removeLogo: (id: string) => apiFetch<Manufacturer>(`/admin/catalogue/manufacturers/${id}/logo`, { method: 'DELETE' }),

  /** Multipart upload; apiFetch always sends JSON so this calls fetch directly. */
  uploadLogo: async (id: string, file: File): Promise<ApiResponse<Manufacturer>> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('broco_access_token') : null;
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch(`${getApiBase()}/admin/catalogue/manufacturers/${id}/logo`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return {
          success: false,
          message: data?.message || `Upload failed (${res.status})`,
          errors: data?.errors || [res.statusText],
        } as ApiResponse<Manufacturer>;
      }
      return data as ApiResponse<Manufacturer>;
    } catch (err) {
      const message = (err as Error)?.message || 'Network error while uploading the logo.';
      return { success: false, message, errors: [message] } as ApiResponse<Manufacturer>;
    }
  },

  createModel: (manufacturerId: string, body: ModelInput) =>
    apiFetch<CarModel>(`/admin/catalogue/manufacturers/${manufacturerId}/models`, { method: 'POST', body: json(body) }),
  updateModel: (id: string, body: ModelInput) =>
    apiFetch<CarModel>(`/admin/catalogue/models/${id}`, { method: 'PUT', body: json(body) }),

  packages: () => apiFetch<ServicePackage[]>('/admin/catalogue/packages'),
  updatePackage: (id: string, body: PackageInput) =>
    apiFetch<ServicePackage>(`/admin/catalogue/packages/${id}`, { method: 'PUT', body: json(body) }),

  modelPrices: (modelId: string) => apiFetch<ModelPriceSheet>(`/admin/catalogue/models/${modelId}/prices`),
  saveModelPrices: (modelId: string, prices: PriceCell[]) =>
    apiFetch<ModelPriceSheet>(`/admin/catalogue/models/${modelId}/prices`, { method: 'PUT', body: json({ prices }) }),
  applySegmentPrice: (body: { segment: string; fuelType: string; packageCode: string; price: number; overwriteExisting: boolean }) =>
    apiFetch<SegmentPriceResult>('/admin/catalogue/prices/segment', { method: 'POST', body: json(body) }),

  commissions: (params: { status?: string; garageId?: string; page: number; pageSize: number }) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.garageId) q.set('garageId', params.garageId);
    q.set('page', String(params.page));
    q.set('pageSize', String(params.pageSize));
    return apiFetch<PagedResult<Commission>>(`/admin/commissions?${q.toString()}`);
  },
  commissionOverview: () => apiFetch<CommissionOverview>('/admin/commissions/overview'),
  markCommissionReceived: (id: string, body: { reference: string; method?: string }) =>
    apiFetch<Commission>(`/admin/commissions/${id}/mark-received`, { method: 'POST', body: json(body) }),
  waiveCommission: (id: string, reason: string) =>
    apiFetch<Commission>(`/admin/commissions/${id}/waive`, { method: 'POST', body: json({ reason }) }),

  leads: (params: { status?: string; page: number; pageSize: number }) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    q.set('page', String(params.page));
    q.set('pageSize', String(params.pageSize));
    return apiFetch<PagedResult<Lead>>(`/admin/leads?${q.toString()}`);
  },
  updateLead: (id: string, body: { status: string; notes: string | null }) =>
    apiFetch<Lead>(`/admin/leads/${id}`, { method: 'PUT', body: json(body) }),
};

/** First validation error from an ApiResponse, or its message. */
export function apiError(res: { message?: string; errors?: unknown }, fallback: string): string {
  const errors = res.errors;
  // ASP.NET model validation: { errors: { Field: ["message"] } }
  if (errors && typeof errors === 'object' && !Array.isArray(errors)) {
    const first = Object.values(errors as Record<string, unknown>)[0];
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
  }
  return res.message || fallback;
}
