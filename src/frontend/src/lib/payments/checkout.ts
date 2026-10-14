// One checkout step for every online payment (booking advances, quote advances, garage commission):
// the API says which gateway created the order, and this opens the matching checkout and verifies the
// result with the API. Pages only deal with the outcome.
import { apiFetch } from '@/lib/api';
import { loadPublicConfig } from '@/components/location/googleMaps';
import { openRazorpayCheckout } from './razorpayCheckout';

/** The development gateway has no checkout page; it is confirmed straight away. Only used when the API says so. */
export const DEV_GATEWAY = 'DevelopmentFake';
export const RAZORPAY_GATEWAY = 'Razorpay';

/** InitiatePaymentResponseDto */
export interface InitiatedPayment {
  paymentId: string;
  paymentNumber?: string;
  amount: number;
  currency?: string;
  gatewayProvider: string;
  gatewayOrderId?: string | null;
  checkoutUrl?: string | null;
  providerData?: Record<string, string> | null;
}

/** PaymentDto fields the pages read back after verification. */
export interface VerifiedPayment {
  id?: string;
  paymentId?: string;
  paymentNumber?: string;
  amount?: number;
  status?: string;
  gatewayPaymentId?: string;
  gatewayOrderId?: string;
  customerQuotationId?: string | null;
  paidAtUtc?: string | null;
}

export type CheckoutResult =
  | { kind: 'paid'; payment: VerifiedPayment }
  /** The browser is leaving for the provider's hosted page; the page should stop here. */
  | { kind: 'redirect' }
  /** The customer closed the checkout: nothing happened and the payment is still pending. */
  | { kind: 'dismissed' }
  | { kind: 'failed'; message: string };

/** Customers verify at /customer/payments/verify; garages verify commission payments at /garage/commission/verify. */
export type VerifyEndpoint = '/customer/payments/verify' | '/garage/commission/verify';

export const PAYMENT_UNAVAILABLE = 'Online payment is not available right now. Please try again later.';
const VERIFY_FAILED = 'We could not confirm the payment. Please try again.';

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

async function verify(
  endpoint: VerifyEndpoint,
  body: { paymentId: string; gatewayPaymentId: string; gatewaySignature: string; gatewayOrderId?: string | null }
): Promise<CheckoutResult> {
  const res = await apiFetch<VerifiedPayment>(endpoint, { method: 'POST', body: JSON.stringify(body) });
  if (res.success) return { kind: 'paid', payment: res.data ?? {} };
  return { kind: 'failed', message: res.message || VERIFY_FAILED };
}

async function razorpayCheckout(init: InitiatedPayment, endpoint: VerifyEndpoint): Promise<CheckoutResult> {
  const data = init.providerData ?? {};
  // A replayed order (same booking, second "Pay now") carries only the order id; the key comes from the site config.
  const key = data.key_id || (await loadPublicConfig())?.razorpayKeyId || '';
  const orderId = data.order_id || init.gatewayOrderId || '';
  if (!key || !orderId) return { kind: 'failed', message: PAYMENT_UNAVAILABLE };

  const prefill: { name?: string; email?: string; contact?: string } = {};
  if (data.prefill_name) prefill.name = data.prefill_name;
  if (data.prefill_email) prefill.email = data.prefill_email;
  if (data.prefill_contact) prefill.contact = data.prefill_contact;

  let outcome;
  try {
    outcome = await openRazorpayCheckout({
      key,
      order_id: orderId,
      amount: Number(data.amount) || Math.round(init.amount * 100),
      currency: data.currency || init.currency || 'INR',
      name: data.name || 'BroCo',
      description: data.description || (init.paymentNumber ? `Payment ${init.paymentNumber}` : 'BroCo payment'),
      prefill,
      notes: init.paymentNumber ? { payment_number: init.paymentNumber } : undefined,
      theme: { color: data.theme_color || '#2563EB' },
    });
  } catch (err) {
    return { kind: 'failed', message: err instanceof Error ? err.message : PAYMENT_UNAVAILABLE };
  }

  if (outcome.kind === 'dismissed') return { kind: 'dismissed' };
  if (outcome.kind === 'failed') return { kind: 'failed', message: outcome.message };
  return verify(endpoint, {
    paymentId: init.paymentId,
    gatewayPaymentId: outcome.response.razorpay_payment_id,
    gatewaySignature: outcome.response.razorpay_signature,
    gatewayOrderId: outcome.response.razorpay_order_id || init.gatewayOrderId,
  });
}

/**
 * Takes a freshly initiated payment through its gateway's checkout and verification.
 * DevelopmentFake confirms immediately, Razorpay opens its sheet in the page, a provider with a
 * hosted page gets a redirect, and anything else is reported as unavailable.
 */
export async function startCheckout(init: InitiatedPayment, endpoint: VerifyEndpoint): Promise<CheckoutResult> {
  if (init.gatewayProvider === DEV_GATEWAY) {
    return verify(endpoint, {
      paymentId: init.paymentId,
      gatewayPaymentId: `pay_dev_${randomId()}`,
      gatewaySignature: 'sig_fake_valid',
      gatewayOrderId: init.gatewayOrderId,
    });
  }
  if (init.gatewayProvider === RAZORPAY_GATEWAY || init.providerData?.checkout === 'razorpay') {
    return razorpayCheckout(init, endpoint);
  }
  if (init.checkoutUrl) {
    // Hosted checkout: continue on the provider's secure page.
    window.location.href = init.checkoutUrl;
    return { kind: 'redirect' };
  }
  return { kind: 'failed', message: PAYMENT_UNAVAILABLE };
}
