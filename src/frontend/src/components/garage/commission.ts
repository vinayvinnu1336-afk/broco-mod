import { apiFetch } from '@/lib/api';

/** GET /garage/commission item (GarageCommissionDto). */
export interface GarageCommission {
  id: string;
  commissionNumber: string;
  serviceJobId: string;
  jobNumber: string;
  requestNumber: string;
  vehicleSummary: string;
  currency?: string;
  serviceValue: number;
  advanceCollectedByPlatform: number;
  balanceCollectedByGarage: number;
  commissionPercentage: number;
  commissionAmount: number;
  taxPercentage: number;
  taxAmount: number;
  totalDue: number;
  status: 'Due' | 'Paid' | 'Waived' | string;
  dueAtUtc: string;
  isOverdue: boolean;
  paidAtUtc?: string | null;
  settledVia?: string | null;
  paymentReference?: string | null;
  waiverReason?: string | null;
  remindersSent: number;
  createdAtUtc: string;
}

/** GET /garage/commission/summary (GarageCommissionSummaryDto). */
export interface GarageCommissionSummary {
  outstandingAmount: number;
  outstandingCount: number;
  overdueAmount: number;
  overdueCount: number;
  paidThisMonth: number;
  oldestDueAtUtc?: string | null;
  newJobsBlocked: boolean;
}

interface InitiatePaymentResult {
  paymentId: string;
  paymentNumber?: string;
  amount: number;
  gatewayProvider: string;
  gatewayOrderId?: string | null;
  checkoutUrl?: string | null;
}

const DEV_GATEWAY = 'DevelopmentFake';

/** Fired on window after a commission payment so the banner and other widgets refresh. */
export const COMMISSION_UPDATED_EVENT = 'broco:commission-updated';

export type PayCommissionResult =
  | { status: 'paid'; amount: number }
  | { status: 'redirected' }
  | { status: 'failed'; message: string };

/**
 * Starts one online payment for the given dues (null = every outstanding due). With the development
 * gateway the payment is verified straight away; a real gateway continues on its checkout page.
 */
export async function payCommissions(commissionIds: string[] | null): Promise<PayCommissionResult> {
  const idempotencyKey = `COMM-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const res = await apiFetch<InitiatePaymentResult>('/garage/commission/pay', {
    method: 'POST',
    body: JSON.stringify({ commissionIds, idempotencyKey }),
  });
  if (!res.success || !res.data) {
    return { status: 'failed', message: res.message || 'Could not start the payment. Please try again.' };
  }

  const payment = res.data;
  if (payment.gatewayProvider === DEV_GATEWAY) {
    const verify = await apiFetch('/garage/commission/verify', {
      method: 'POST',
      body: JSON.stringify({
        paymentId: payment.paymentId,
        gatewayPaymentId: `pay_dev_${Math.random().toString(36).slice(2, 12)}`,
        gatewaySignature: 'sig_fake_valid',
        gatewayOrderId: payment.gatewayOrderId,
      }),
    });
    if (!verify.success) {
      return { status: 'failed', message: verify.message || 'We could not confirm the payment. Please try again.' };
    }
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(COMMISSION_UPDATED_EVENT));
    return { status: 'paid', amount: Number(payment.amount) || 0 };
  }

  if (payment.checkoutUrl) {
    window.location.href = payment.checkoutUrl;
    return { status: 'redirected' };
  }
  return { status: 'failed', message: 'Online payment is not available right now. Please try again later.' };
}

function spanLabel(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  const days = Math.round(hours / 24);
  return `${days} days`;
}

/** "Due in 20 h" / "Overdue by 2 days" / "Paid 12 Oct 2026". */
export function commissionTiming(c: Pick<GarageCommission, 'status' | 'dueAtUtc' | 'isOverdue'>): {
  text: string;
  tone: 'amber' | 'red' | 'green' | 'neutral';
} {
  if (c.status === 'Paid') return { text: 'Paid', tone: 'green' };
  if (c.status === 'Waived') return { text: 'Waived', tone: 'neutral' };
  const diff = new Date(c.dueAtUtc).getTime() - Date.now();
  if (Number.isNaN(diff)) return { text: 'Due', tone: 'amber' };
  if (c.isOverdue || diff <= 0) return { text: `Overdue by ${spanLabel(-diff)}`, tone: 'red' };
  return { text: `Due in ${spanLabel(diff)}`, tone: 'amber' };
}

/** 10 -> "10%", 12.5 -> "12.5%". */
export function pctLabel(value: number | null | undefined): string {
  const v = Number(value ?? 0);
  return `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
}
