export type QuoteLineType = 'Labour' | 'Part' | 'Service' | 'Other';

export interface CreateQuoteLineItemRequest {
  lineType: QuoteLineType;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  discountAmount?: number;
  sortOrder?: number;
}

export interface CreateGarageQuoteRequest {
  garageRequestId: string;
  currency?: string;
  estimatedCompletionHours?: number | null;
  estimatedCompletionDays?: number | null;
  validUntil?: string | null;
  garageRemarks?: string | null;
  lineItems?: CreateQuoteLineItemRequest[] | null;
}

export interface UpdateGarageQuoteDraftRequest {
  currency?: string;
  estimatedCompletionHours?: number | null;
  estimatedCompletionDays?: number | null;
  validUntil?: string | null;
  garageRemarks?: string | null;
  lineItems?: CreateQuoteLineItemRequest[] | null;
}

export interface SubmitGarageQuoteCommand {
  idempotencyKey?: string | null;
}

export interface WithdrawGarageQuoteCommand {
  reason: string;
}

export interface GarageQuoteLineItemDto {
  id: string;
  lineType: QuoteLineType;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountAmount: number;
  itemSubtotal: number;
  lineTax: number;
  lineTotal: number;
  sortOrder: number;
}

export interface GarageQuoteVersionSummaryDto {
  id: string;
  versionNumber: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  estimatedCompletionDays?: number | null;
  validUntil: string;
  garageRemarks?: string | null;
  submittedAtUtc: string;
  lineItems: GarageQuoteLineItemDto[];
}

export interface GarageQuoteSummaryDto {
  id: string;
  garageRequestId: string;
  serviceRequestId: string;
  requestNumber: string;
  vehicleSummary: string;
  quoteNumber: string;
  versionNumber: number;
  status: string;
  currency: string;
  totalAmount: number;
  estimatedCompletionDays?: number | null;
  validUntil: string;
  submittedAtUtc?: string | null;
  createdAtUtc: string;
}

export interface GarageQuoteDetailDto {
  id: string;
  garageRequestId: string;
  serviceRequestId: string;
  serviceRequestNumber: string;
  vehicleSummary: string;
  quoteNumber: string;
  versionNumber: number;
  status: string;
  currency: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  estimatedCompletionHours?: number | null;
  estimatedCompletionDays?: number | null;
  validUntil: string;
  garageRemarks?: string | null;
  createdAtUtc: string;
  submittedAtUtc?: string | null;
  withdrawnAtUtc?: string | null;
  withdrawalReason?: string | null;
  lineItems: GarageQuoteLineItemDto[];
  versions: GarageQuoteVersionSummaryDto[];
}

export interface AdvisorGarageQuoteSummaryDto {
  id: string;
  quoteNumber: string;
  serviceRequestNumber: string;
  garageId: string;
  garageName: string;
  garageDistanceKm: number;
  vehicleSummary: string;
  problemSummary: string;
  totalAmount: number;
  currency: string;
  estimatedCompletionDays?: number | null;
  validUntil: string;
  status: string;
  submittedAtUtc?: string | null;
}

export interface AdvisorGarageQuoteDetailDto {
  id: string;
  quoteNumber: string;
  serviceRequestNumber: string;
  garageId: string;
  garageName: string;
  garagePhone: string;
  garageAddress: string;
  garageDistanceKm: number;
  vehicleSummary: string;
  problemSummary: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  estimatedCompletionHours?: number | null;
  estimatedCompletionDays?: number | null;
  validUntil: string;
  garageRemarks?: string | null;
  status: string;
  submittedAtUtc?: string | null;
  lineItems: GarageQuoteLineItemDto[];
  versions: GarageQuoteVersionSummaryDto[];
}

export interface AdminGarageQuoteSummaryDto {
  id: string;
  quoteNumber: string;
  serviceRequestNumber: string;
  garageId: string;
  garageName: string;
  vehicleSummary: string;
  totalAmount: number;
  currency: string;
  status: string;
  submittedAtUtc?: string | null;
  createdAtUtc: string;
}

export interface AdminGarageQuoteDetailDto {
  id: string;
  quoteNumber: string;
  serviceRequestNumber: string;
  garageId: string;
  garageName: string;
  garagePhone: string;
  garageAddress: string;
  vehicleSummary: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  estimatedCompletionHours?: number | null;
  estimatedCompletionDays?: number | null;
  validUntil: string;
  garageRemarks?: string | null;
  status: string;
  submittedAtUtc?: string | null;
  withdrawnAtUtc?: string | null;
  withdrawalReason?: string | null;
  lineItems: GarageQuoteLineItemDto[];
  versions: GarageQuoteVersionSummaryDto[];
}
