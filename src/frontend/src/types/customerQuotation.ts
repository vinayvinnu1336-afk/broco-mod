export type QuoteLineType = 'Labour' | 'Part' | 'Service' | 'Other';

export type GarageAssignmentStatus = 'Assigned' | 'Cancelled' | 'Reassigned';

export type CustomerQuotationStatus = 
  | 'Draft' 
  | 'ReadyToSend' 
  | 'Sent' 
  | 'Accepted' 
  | 'Rejected' 
  | 'Expired' 
  | 'Cancelled';

export interface GarageQuoteLineItemDto {
  id: string;
  lineType: string;
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

export interface QuoteComparisonItemDto {
  quoteId: string;
  quoteNumber: string;
  garageId: string;
  garageName: string;
  garageAddress: string;
  distanceKm: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  estimatedDurationHours: number;
  estimatedDurationDays: number;
  status: string;
  submittedAtUtc: string;
  validUntil: string;
  notes?: string;
  lineItemsCount: number;
  lineItems: GarageQuoteLineItemDto[];
}

export interface GarageAssignmentDto {
  id: string;
  serviceRequestId: string;
  requestNumber: string;
  garageId: string;
  garageName: string;
  selectedQuoteId: string;
  quoteNumber: string;
  quotedAmount: number;
  assignedByAdvisorId: string;
  assignedByAdvisorName: string;
  assignedAtUtc: string;
  status: string;
  assignmentReason?: string;
  cancelledAtUtc?: string;
  cancellationReason?: string;
}

export interface QuoteComparisonDto {
  serviceRequestId: string;
  requestNumber: string;
  vehicleSummary: string;
  problemDescription: string;
  customerFormattedAddress: string;
  requestStatus: string;
  totalQuotesCount: number;
  pendingGaragesCount: number;
  lowestQuotedAmount?: number;
  latestQuoteReceivedAtUtc?: string;
  activeAssignment?: GarageAssignmentDto;
  quotes: QuoteComparisonItemDto[];
}

export interface AdvisorRequestNoteDto {
  id: string;
  serviceRequestId: string;
  advisorId: string;
  advisorName: string;
  note: string;
  createdAtUtc: string;
  updatedAtUtc?: string;
  isOwnNote: boolean;
}

export interface CreateAdvisorNoteRequest {
  note: string;
}

export interface UpdateAdvisorNoteRequest {
  note: string;
}

export interface AssignGarageRequest {
  garageId: string;
  quoteId: string;
  assignmentReason?: string;
}

export interface CustomerQuotationLineItemInputDto {
  lineType: QuoteLineType;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountAmount: number;
  sortOrder: number;
}

export interface CreateCustomerQuotationRequest {
  scopeSummary: string;
  advisorRemarks?: string;
  validUntilUtc: string;
  customerDiscount: number;
  currency: string;
  lineItems: CustomerQuotationLineItemInputDto[];
}

export interface UpdateCustomerQuotationDraftRequest {
  scopeSummary: string;
  advisorRemarks?: string;
  validUntilUtc: string;
  customerDiscount: number;
  lineItems: CustomerQuotationLineItemInputDto[];
}

export interface CustomerQuotationLineItemDto {
  id: string;
  lineType: QuoteLineType;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountAmount: number;
  lineTotal: number;
  sortOrder: number;
}

export interface CustomerQuotationVersionDto {
  id: string;
  versionNumber: number;
  customerSubtotal: number;
  customerDiscount: number;
  customerTax: number;
  customerTotal: number;
  validUntilUtc: string;
  advisorRemarks?: string;
  scopeSummary?: string;
  createdAtUtc: string;
}

export interface CustomerQuotationDto {
  id: string;
  serviceRequestId: string;
  requestNumber: string;
  garageAssignmentId?: string;
  assignedGarageId: string;
  assignedGarageName: string;
  advisorId: string;
  advisorName: string;
  quotationNumber: string;
  currency: string;
  customerSubtotal: number;
  customerDiscount: number;
  customerTax: number;
  customerTotal: number;
  validUntilUtc: string;
  status: CustomerQuotationStatus;
  versionNumber: number;
  scopeSummary: string;
  advisorRemarks?: string;
  createdAtUtc: string;
  updatedAtUtc?: string;
  sentAtUtc?: string;
  acceptedAtUtc?: string;
  rejectedAtUtc?: string;
  cancelledAtUtc?: string;
  lineItems: CustomerQuotationLineItemDto[];
  versions: CustomerQuotationVersionDto[];
}

export interface CustomerQuotationSummaryDto {
  id: string;
  serviceRequestId: string;
  requestNumber: string;
  assignedGarageName: string;
  quotationNumber: string;
  customerTotal: number;
  currency: string;
  status: CustomerQuotationStatus;
  versionNumber: number;
  validUntilUtc: string;
  sentAtUtc?: string;
  createdAtUtc: string;
}

export interface CustomerFacingLineItemDto {
  id: string;
  lineType: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountAmount: number;
  lineTotal: number;
  sortOrder: number;
}

export interface CustomerFacingQuotationDto {
  id: string;
  serviceRequestId: string;
  requestNumber: string;
  assignedGarageName?: string;
  quotationNumber: string;
  currency: string;
  customerSubtotal: number;
  customerDiscount: number;
  customerTax: number;
  customerTotal: number;
  validUntilUtc: string;
  status: string;
  versionNumber: number;
  scopeSummary: string;
  advisorRemarks?: string;
  sentAtUtc?: string;
  acceptedAtUtc?: string;
  rejectedAtUtc?: string;
  lineItems: CustomerFacingLineItemDto[];
}

export interface AcceptQuotationRequest {
  idempotencyKey?: string;
  customerRemarks?: string;
}

export interface RejectQuotationRequest {
  reason: string;
  category?: string;
  idempotencyKey?: string;
}

export interface CustomerQuotationDecisionDto {
  id: string;
  customerQuotationId: string;
  quotationNumber: string;
  customerQuotationVersionId: string;
  versionNumber: number;
  customerId: string;
  decision: string;
  category?: string;
  reason?: string;
  decidedAtUtc: string;
  idempotencyKey?: string;
}

export interface BookingConfirmationDto {
  quotationId: string;
  quotationNumber: string;
  serviceRequestId: string;
  requestNumber: string;
  garageId: string;
  garageName: string;
  garageAddress: string;
  garagePhone?: string;
  confirmedTotal: number;
  currency: string;
  confirmedAtUtc: string;
  status: string;
  vehicleSummary: string;
  message: string;
}

export interface GarageConfirmedBookingDto {
  assignmentId: string;
  serviceRequestId: string;
  requestNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  vehicleLicensePlate: string;
  problemDescription: string;
  confirmedAtUtc: string;
  quotedAmount: number;
  quoteNumber: string;
}
