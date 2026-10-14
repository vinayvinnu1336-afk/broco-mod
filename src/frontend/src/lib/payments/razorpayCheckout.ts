// Razorpay Checkout (https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/):
// the API creates the order and hands us its id in providerData; this opens Razorpay's own payment
// sheet in the page and reports what the customer did. Only the public key id ever reaches the browser.

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

/** What Razorpay hands back on a successful payment; the API verifies the signature before trusting it. */
export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailure {
  error?: { code?: string; description?: string; reason?: string; step?: string; source?: string };
}

export interface RazorpayCheckoutOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  image?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void; confirm_close?: boolean; escape?: boolean };
  retry?: { enabled?: boolean };
}

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', handler: (response: RazorpayFailure) => void): void;
}

type RazorpayWindow = Window & { Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance };

let scriptPromise: Promise<void> | null = null;

/** Adds checkout.js to the page once; later calls share the same promise. */
export function loadRazorpayCheckout(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Razorpay Checkout needs a browser.'));
  if ((window as RazorpayWindow).Razorpay) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SCRIPT}"]`);
      const script = existing ?? document.createElement('script');
      const fail = () => {
        scriptPromise = null;
        reject(new Error('Could not load the Razorpay checkout. Check your connection and try again.'));
      };
      script.addEventListener('load', () => ((window as RazorpayWindow).Razorpay ? resolve() : fail()));
      script.addEventListener('error', fail);
      if (!existing) {
        script.src = CHECKOUT_SCRIPT;
        script.async = true;
        document.head.appendChild(script);
      }
    });
  }
  return scriptPromise;
}

export type RazorpayOutcome =
  | { kind: 'success'; response: RazorpaySuccess }
  | { kind: 'failed'; message: string }
  | { kind: 'dismissed' };

/** Razorpay's error descriptions are already customer-facing; fall back to something plain. */
export function razorpayFailureMessage(failure: RazorpayFailure | undefined): string {
  const description = failure?.error?.description?.trim();
  return description || 'The payment did not go through. No money was taken; please try again.';
}

/**
 * Opens Razorpay Checkout and resolves once the customer has paid, given up after a failed attempt,
 * or simply closed the sheet. Rejects only when checkout.js cannot be loaded.
 */
export async function openRazorpayCheckout(
  options: Omit<RazorpayCheckoutOptions, 'handler' | 'modal' | 'retry'>
): Promise<RazorpayOutcome> {
  await loadRazorpayCheckout();
  const Razorpay = (window as RazorpayWindow).Razorpay;
  if (!Razorpay) throw new Error('Razorpay Checkout is not available.');

  return new Promise<RazorpayOutcome>((resolve) => {
    let settled = false;
    // With retry on, Razorpay keeps the sheet open after a failed attempt: the customer retries (the
    // handler fires later) or closes it, in which case the last failure is the reason we report.
    let lastFailure: string | null = null;
    const settle = (outcome: RazorpayOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };
    const instance = new Razorpay({
      ...options,
      handler: (response) => settle({ kind: 'success', response }),
      modal: {
        ondismiss: () => settle(lastFailure ? { kind: 'failed', message: lastFailure } : { kind: 'dismissed' }),
        confirm_close: true,
      },
      retry: { enabled: true },
    });
    instance.on('payment.failed', (failure) => {
      lastFailure = razorpayFailureMessage(failure);
    });
    instance.open();
  });
}
