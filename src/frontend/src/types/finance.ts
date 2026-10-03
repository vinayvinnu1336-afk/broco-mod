export type PaymentStatus =
  | 'Pending'
  | 'Paid'
  | 'Failed'
  | 'Refunded'
  | 'PartiallyRefunded'
  | 'Cancelled';

export type PaymentPurpose = 'ServiceQuotation' | 'AdditionalWork';

export type PaymentMethod = 'Card' | 'UPI' | 'NetBanking' | 'Wallet';

export type InvoiceStatus = 'Draft' | 'Issued' | 'Paid' | 'Void';

export type SettlementStatus =
  | 'Pending'
  | 'Processing'
  | 'Completed'
  | 'Failed'
  | 'OnHold';

export interface PaymentDto {
  id: string;
  paymentNumber: string;
  customerId: string;
  garageId: string;
  serviceJobId?: string;
  customerQuotationId?: string;
  additionalWorkQuotationId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  purpose: PaymentPurpose;
  paymentMethod?: PaymentMethod;
  gatewayProvider: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  paidAtUtc?: string;
  refundedAmount: number;
  refundReason?: string;
  failureReason?: string;
  createdAtUtc: string;
}

export interface InvoiceLineItemDto {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  itemType: string;
}

export interface InvoiceDto {
  id: string;
  invoiceNumber: string;
  paymentId: string;
  customerId: string;
  garageId: string;
  customerQuotationId?: string;
  serviceJobId?: string;
  subTotal: number;
  taxRatePercent: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  status: InvoiceStatus;
  issuedAtUtc: string;
  paidAtUtc?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerBillingAddress: string;
  garageName: string;
  garageAddress: string;
  garageGstNumber?: string;
  lineItems: InvoiceLineItemDto[];
  notes?: string;
}

export interface GarageSettlementDto {
  id: string;
  settlementNumber: string;
  paymentId: string;
  garageId: string;
  garageName: string;
  serviceJobId?: string;
  grossAmount: number;
  platformFeeRatePercent: number;
  platformFeeAmount: number;
  platformFeeGstRatePercent: number;
  platformFeeGstAmount: number;
  totalPlatformFee: number;
  netPayableToGarage: number;
  currency: string;
  status: SettlementStatus;
  payoutReference?: string;
  payoutProcessedAtUtc?: string;
  paymentReceivedAtUtc: string;
  createdAtUtc: string;
}

export interface FinanceOverviewDto {
  totalGrossRevenue: number;
  totalPlatformRevenue: number;
  totalGaragePayouts: number;
  pendingGarageSettlements: number;
  totalRefundedAmount: number;
  totalPaymentsCount: number;
  completedSettlementsCount: number;
  currency: string;
}

export interface FinancialLedgerEntryDto {
  id: string;
  entryNumber: string;
  entryType: string;
  accountType: string;
  amount: number;
  currency: string;
  direction: string;
  paymentId?: string;
  settlementId?: string;
  description: string;
  balanceAfter?: number;
  createdAtUtc: string;
}

export interface InitiatePaymentRequestDto {
  quotationId: string;
  idempotencyKey?: string;
}

export interface InitiateAdditionalWorkPaymentRequestDto {
  additionalWorkQuotationId: string;
  idempotencyKey?: string;
}

export interface InitiatePaymentResponseDto {
  paymentId: string;
  paymentNumber: string;
  amount: number;
  currency: string;
  gatewayProvider: string;
  gatewayOrderId?: string;
  checkoutUrl?: string;
  providerData?: Record<string, string>;
}

export interface VerifyPaymentRequestDto {
  paymentId: string;
  gatewayPaymentId: string;
  gatewaySignature?: string;
  gatewayOrderId?: string;
}

export interface RefundPaymentRequestDto {
  refundAmount: number;
  reason: string;
}

export interface CompleteSettlementRequestDto {
  payoutReference: string;
}
