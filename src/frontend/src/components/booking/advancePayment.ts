// Booking advance (10%) checkout, shared by the booking flow and the request detail page.
import { apiFetch } from '@/lib/api';
import { startCheckout } from '@/lib/payments/checkout';
import type { InitiatedPayment, VerifiedPayment } from '@/lib/payments/checkout';

export { DEV_GATEWAY } from '@/lib/payments/checkout';
export type { VerifiedPayment } from '@/lib/payments/checkout';

/** InitiatePaymentResponseDto */
export type InitiatePaymentResponse = InitiatedPayment;

export type AdvanceResult =
  | { kind: 'paid'; amount: number; payment: VerifiedPayment; paymentId: string }
  | { kind: 'redirect'; amount: number }
  /** The customer closed the checkout; the booking is saved and still waits for its advance. */
  | { kind: 'dismissed'; amount: number }
  | { kind: 'failed'; message: string; amount?: number };

/** Default share paid online to BroCo to confirm a booking; the server's numbers win once known. */
export const ADVANCE_PERCENT = 10;

/** 10% of the total, rounded to whole rupees (at least ₹1, never more than the total). Mirrors the server. */
export function advanceFor(total: number, percent = ADVANCE_PERCENT): number {
  if (!total || total <= 0) return 0;
  return Math.min(total, Math.max(1, Math.round((total * percent) / 100)));
}

/**
 * Starts the advance checkout for a service request: the development gateway confirms it immediately,
 * Razorpay opens its payment sheet in the page, a hosted provider redirects the browser.
 */
export async function payBookingAdvance(requestId: string): Promise<AdvanceResult> {
  const idempotencyKey = `ADV-${requestId}-${Date.now()}`;
  const res = await apiFetch<InitiatePaymentResponse>(`/customer/requests/${requestId}/advance/pay`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ idempotencyKey }),
  });
  if (!res.success || !res.data) {
    return { kind: 'failed', message: res.message || 'We could not start the payment. Please try again.' };
  }
  const init = res.data;
  const result = await startCheckout(init, '/customer/payments/verify');
  switch (result.kind) {
    case 'paid':
      return { kind: 'paid', amount: init.amount, payment: result.payment, paymentId: init.paymentId };
    case 'redirect':
      return { kind: 'redirect', amount: init.amount };
    case 'dismissed':
      return { kind: 'dismissed', amount: init.amount };
    default:
      return { kind: 'failed', amount: init.amount, message: result.message };
  }
}

/** "Booking advance (10%)" for the BookingAdvance payment purpose; null for anything else. */
export function advancePurposeLabel(purpose: string | null | undefined): string | null {
  const key = String(purpose ?? '').replace(/[\s_-]/g, '').toLowerCase();
  return key === 'bookingadvance' ? `Booking advance (${ADVANCE_PERCENT}%)` : null;
}
