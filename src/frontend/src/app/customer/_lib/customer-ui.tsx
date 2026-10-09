// Small presentation helpers shared by the customer portal pages. Not a route: Next ignores
// folders that start with an underscore.

import React, { ReactNode } from 'react';
import { Check } from 'lucide-react';

/**
 * API status values arrive in several spellings ("GaragesNotified", "GARAGES_NOTIFIED", "Sent").
 * Normalise to UPPER_SNAKE so comparisons work for all of them.
 */
export function statusKey(status: string | null | undefined): string {
  return String(status ?? '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toUpperCase();
}

/** Service request statuses after which nothing else will happen. */
export function isRequestFinished(status: string | null | undefined): boolean {
  const key = statusKey(status);
  return key === 'COMPLETED' || key === 'CANCELLED' || key === 'CLOSED';
}

/** Coarse request stages the customer cares about, derived only from the request status. */
export const REQUEST_STAGES = ['Requested', 'Quote', 'Booked', 'In service', 'Done'] as const;

/** Index into REQUEST_STAGES for a service request status, or -1 when cancelled/unknown. */
export function requestStageIndex(status: string | null | undefined): number {
  switch (statusKey(status)) {
    case 'NEW':
    case 'SUBMITTED':
    case 'ASSIGNED_TO_ADVISOR':
    case 'UNDER_REVIEW':
    case 'ADVISOR_REVIEW':
    case 'ADVISORREVIEW':
    case 'GARAGE_MATCHING':
    case 'GARAGES_NOTIFIED':
      return 0;
    case 'QUOTES_RECEIVED':
    case 'GARAGE_SELECTED':
    case 'GARAGESELECTED':
    case 'CUSTOMER_QUOTATION_SENT':
    case 'CUSTOMER_REJECTED':
      return 1;
    case 'CUSTOMER_ACCEPTED':
    case 'BOOKING_CONFIRMED':
      return 2;
    case 'IN_PROGRESS':
      return 3;
    case 'COMPLETED':
      return 4;
    default:
      return -1;
  }
}

/** One plain sentence telling the customer what happens next for a request status. */
export function requestNextStep(status: string | null | undefined): string | null {
  switch (statusKey(status)) {
    case 'NEW':
    case 'SUBMITTED':
    case 'ASSIGNED_TO_ADVISOR':
      return 'We have your request. A service advisor will review it.';
    case 'UNDER_REVIEW':
    case 'ADVISOR_REVIEW':
    case 'ADVISORREVIEW':
      return 'Your advisor is reviewing your request.';
    case 'GARAGE_MATCHING':
    case 'GARAGES_NOTIFIED':
      return 'Garages near you have been asked to quote.';
    case 'QUOTES_RECEIVED':
    case 'GARAGE_SELECTED':
    case 'GARAGESELECTED':
      return 'Your advisor is comparing garage quotes and will send you a price.';
    case 'CUSTOMER_QUOTATION_SENT':
      return 'Your quote is ready. Review it and accept or decline.';
    case 'CUSTOMER_REJECTED':
      return 'You declined the quote. Your advisor may follow up with another option.';
    case 'CUSTOMER_ACCEPTED':
    case 'BOOKING_CONFIRMED':
      return 'Booking confirmed. The garage will schedule your service.';
    case 'IN_PROGRESS':
      return 'Your car is being serviced.';
    case 'COMPLETED':
      return 'This service is complete.';
    case 'CANCELLED':
      return 'This request was cancelled.';
    default:
      return null;
  }
}

/** Thin horizontal progress meter for the coarse request stages. */
export function RequestProgress({ status, className = '' }: { status: string; className?: string }) {
  const current = requestStageIndex(status);
  if (current < 0) return null;
  return (
    <div className={className}>
      <div className="flex gap-1" aria-hidden="true">
        {REQUEST_STAGES.map((stage, i) => (
          <span
            key={stage}
            className={`h-1.5 flex-1 rounded-full ${i <= current ? 'bg-electric-600' : 'bg-surface-200'}`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-navy-400">
        {REQUEST_STAGES.map((stage, i) => (
          <span key={stage} className={i === current ? 'font-semibold text-navy-800' : ''}>
            {stage}
          </span>
        ))}
      </div>
      <span className="sr-only">
        Stage {current + 1} of {REQUEST_STAGES.length}: {REQUEST_STAGES[current]}
      </span>
    </div>
  );
}

/** Label / value row used in receipt-style detail cards. Stacks cleanly at 375 px. */
export function DetailRow({
  label,
  children,
  mono = false,
  strong = false,
}: {
  label: ReactNode;
  children: ReactNode;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-navy-500">{label}</dt>
      <dd
        className={`min-w-0 text-right text-sm break-words ${mono ? 'font-mono text-[13px]' : ''} ${
          strong ? 'font-semibold text-navy-900' : 'text-navy-800'
        }`}
      >
        {children}
      </dd>
    </div>
  );
}

/** Vertical checklist of steps (done / current / upcoming). Reads well on phones. */
export function StepList({
  steps,
}: {
  steps: { label: string; state: 'done' | 'current' | 'upcoming'; hint?: ReactNode }[];
}) {
  return (
    <ol className="space-y-0">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={step.label} className="relative flex gap-3 pb-4 last:pb-0">
            {!last && (
              <span
                className={`absolute left-[11px] top-6 bottom-0 w-0.5 ${
                  step.state === 'done' ? 'bg-electric-600' : 'bg-surface-200'
                }`}
                aria-hidden="true"
              />
            )}
            <span
              className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                step.state === 'done'
                  ? 'bg-electric-600 text-white'
                  : step.state === 'current'
                  ? 'bg-white text-electric-700 ring-2 ring-electric-600'
                  : 'bg-surface-100 text-navy-400 ring-1 ring-surface-200'
              }`}
            >
              {step.state === 'done' ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <div
                className={`text-sm ${
                  step.state === 'upcoming' ? 'text-navy-400' : 'font-semibold text-navy-900'
                }`}
              >
                {step.label}
                {step.state === 'current' && <span className="sr-only"> (current step)</span>}
              </div>
              {step.hint && <div className="mt-0.5 text-xs text-navy-500">{step.hint}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Small section heading used inside pages. */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3 px-1">
      <h2 className="text-base font-semibold text-navy-900">{children}</h2>
      {action}
    </div>
  );
}

/** Plain label for a payment purpose enum. */
export function paymentPurposeLabel(purpose: string | null | undefined): string {
  switch (statusKey(purpose)) {
    case 'SERVICE_QUOTATION':
      return 'Service booking';
    case 'ADDITIONAL_WORK':
      return 'Extra work';
    default:
      return purpose ? purpose.replace(/([a-z])([A-Z])/g, '$1 $2') : 'Payment';
  }
}

/** Plain label for a payment method enum (keeps acronyms like UPI intact). */
export function paymentMethodLabel(method: string | null | undefined): string | null {
  if (!method) return null;
  switch (statusKey(method)) {
    case 'UPI':
      return 'UPI';
    case 'NET_BANKING':
      return 'Net banking';
    case 'CARD':
      return 'Card';
    case 'WALLET':
      return 'Wallet';
    default:
      return method;
  }
}
