export type PaymentStatus =
  | 'Pending'
  | 'Paid'
  | 'Failed'
  | 'Refunded'
  | 'PartiallyRefunded'
  | 'Cancelled';

export type PaymentPurpose = 'ServiceQuotation' | 'AdditionalWork' | 'BookingAdvance' | 'GarageCommission';

export type PaymentMethod = 'Card' | 'UPI' | 'NetBanking' | 'Wallet';

export type InvoiceStatus = 'Draft' | 'Issued' | 'Paid' | 'Void' | 'Refunded';

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

/** One entry of an invoice's lineItemsJson. */
export interface InvoiceLineItemDto {
  description: string;
  itemType: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  /** Booking advances only: the full service price and what is still payable at the garage. */
  serviceTotal?: number;
  balanceAtGarage?: number;
}

/** Mirrors the API's InvoiceDto. Line items arrive as a JSON string; read them with parseInvoiceLineItems. */
export interface InvoiceDto {
  id: string;
  invoiceNumber: string;
  paymentId: string;
  customerQuotationId?: string | null;
  additionalWorkQuotationId?: string | null;
  serviceJobId?: string | null;
  customerId: string;
  garageId?: string | null;
  status: InvoiceStatus;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  billingName: string;
  billingEmail: string;
  billingAddress?: string | null;
  lineItemsJson: string;
  issuedAtUtc: string;
  paidAtUtc?: string | null;
  voidedAtUtc?: string | null;
  voidReason?: string | null;
}

/** The invoice's line items; an empty list when the stored JSON is missing or unreadable. */
export function parseInvoiceLineItems(invoice: Pick<InvoiceDto, 'lineItemsJson'>): InvoiceLineItemDto[] {
  try {
    const items = JSON.parse(invoice.lineItemsJson || '[]');
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

/** The booking-advance line when this invoice is the receipt for BroCo's 10% advance. */
export function bookingAdvanceLine(items: InvoiceLineItemDto[]): InvoiceLineItemDto | undefined {
  return items.find((i) => i.itemType === 'BookingAdvance');
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

/** Mirrors the API's FinanceOverviewDto. */
export interface FinanceOverviewDto {
  totalGrossRevenue: number;
  totalPlatformRevenue: number;
  totalGarageSettlements: number;
  totalRefunds: number;
  netPlatformProfit: number;
  totalPaymentsCount: number;
  totalInvoicesCount: number;
  pendingSettlementsCount: number;
  completedSettlementsCount: number;
  totalPlatformFeeGst: number;
  totalPlatformMargin: number;
  /** 10% advances customers paid BroCo online, net of refunds. */
  totalBookingAdvances: number;
  /** Commission garages paid BroCo, including GST. */
  totalCommissionCollected: number;
  totalCommissionOutstanding: number;
  totalCommissionGst: number;
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
