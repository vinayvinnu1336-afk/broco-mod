// Booking advance (10%) checkout, shared by the booking flow and the request detail page.
import { apiFetch } from '@/lib/api';

/** InitiatePaymentResponseDto */
export interface InitiatePaymentResponse {
  paymentId: string;
  paymentNumber?: string;
  amount: number;
  currency?: string;
  gatewayProvider: string;
  gatewayOrderId?: string | null;
  checkoutUrl?: string | null;
}

export interface VerifiedPayment {
  id?: string;
  paymentId?: string;
  paymentNumber?: string;
  amount?: number;
  status?: string;
  gatewayPaymentId?: string;
  paidAtUtc?: string | null;
}

export type AdvanceResult =
  | { kind: 'paid'; amount: number; payment: VerifiedPayment; paymentId: string }
  | { kind: 'redirect'; amount: number }
  | { kind: 'failed'; message: string; amount?: number };

// The development gateway has no checkout page; it is confirmed straight away. Only used when the API says so.
export const DEV_GATEWAY = 'DevelopmentFake';

/** Default share paid online to BroCo to confirm a booking; the server's numbers win once known. */
export const ADVANCE_PERCENT = 10;

/** 10% of the total, rounded to whole rupees (at least ₹1, never more than the total). Mirrors the server. */
export function advanceFor(total: number, percent = ADVANCE_PERCENT): number {
  if (!total || total <= 0) return 0;
  return Math.min(total, Math.max(1, Math.round((total * percent) / 100)));
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Starts the advance checkout for a service request. With the development gateway it verifies
 * immediately; with a real provider it redirects the browser to the provider's checkout page.
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

  if (init.gatewayProvider === DEV_GATEWAY) {
    const verify = await apiFetch<VerifiedPayment>('/customer/payments/verify', {
      method: 'POST',
      body: JSON.stringify({
        paymentId: init.paymentId,
        gatewayPaymentId: `pay_dev_${randomId()}`,
        gatewaySignature: 'sig_fake_valid',
        gatewayOrderId: init.gatewayOrderId,
      }),
    });
    if (verify.success) {
      return { kind: 'paid', amount: init.amount, payment: verify.data ?? {}, paymentId: init.paymentId };
    }
    return { kind: 'failed', amount: init.amount, message: verify.message || 'We could not confirm the payment. Please try again.' };
  }

  if (init.checkoutUrl) {
    // Real payment provider: continue on its secure checkout page.
    window.location.href = init.checkoutUrl;
    return { kind: 'redirect', amount: init.amount };
  }
  return { kind: 'failed', amount: init.amount, message: 'Online payment is not available right now. Please try again later.' };
}

/** "Booking advance (10%)" for the BookingAdvance payment purpose; null for anything else. */
export function advancePurposeLabel(purpose: string | null | undefined): string | null {
  const key = String(purpose ?? '').replace(/[\s_-]/g, '').toLowerCase();
  return key === 'bookingadvance' ? `Booking advance (${ADVANCE_PERCENT}%)` : null;
}
