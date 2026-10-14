'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  CustomerFacingQuotationDto,
  BookingConfirmationDto,
  CustomerQuotationDecisionDto,
} from '@/types/customerQuotation';
import { CalendarClock, CheckCircle2, CreditCard, Receipt, XCircle, Clock } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ActionBar, ActionBarSpacer } from '@/components/ui/ActionBar';
import { formatDate, formatDateTime, formatINR, formatINRWhole, humanize } from '@/lib/format';
import { DetailRow } from '@/app/customer/_lib/customer-ui';
import { PriceSplit } from '@/components/booking/PriceSplit';
import { advanceFor } from '@/components/booking/advancePayment';

/** The API also returns the vehicle on the quote. */
type QuoteDetail = CustomerFacingQuotationDto & {
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehicleLicensePlate?: string;
};

/** Fields read from the pay / verify responses. */
interface PaymentResult {
  id?: string;
  paymentId?: string;
  paymentNumber?: string;
  gatewayPaymentId?: string;
  gatewayOrderId?: string;
  gatewayProvider?: string;
  checkoutUrl?: string | null;
  status?: string;
  customerQuotationId?: string | null;
  amount?: number;
}

// The development gateway has no checkout page; it is confirmed straight away. Only used when the API says so.
const DEV_GATEWAY = 'DevelopmentFake';

const REJECTION_CATEGORIES = [
  { key: 'PRICE_TOO_HIGH', label: 'The price is too high' },
  { key: 'TIMING_NOT_SUITABLE', label: 'It would take too long' },
  { key: 'SERVICE_NOT_REQUIRED', label: 'I no longer need this service' },
  { key: 'CHANGED_MIND', label: 'I will service it elsewhere or later' },
  { key: 'OTHER', label: 'Something else' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export default function CustomerQuotationDetailPage() {
  const params = useParams();
  const quoteId = params.id as string;

  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Acceptance
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [acceptRemarks, setAcceptRemarks] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [bookingConfirmation, setBookingConfirmation] = useState<BookingConfirmationDto | null>(null);

  // Payment
  const [initiatingPayment, setInitiatingPayment] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState<PaymentResult | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  // Amount the server asked for when the checkout was created: the source of truth once known.
  const [initiatedAmount, setInitiatedAmount] = useState<number | null>(null);

  // Rejection
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionCategory, setRejectionCategory] = useState('PRICE_TOO_HIGH');
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [decisionRecorded, setDecisionRecorded] = useState<CustomerQuotationDecisionDto | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    async function loadQuote() {
      setLoading(true);
      setErrorMsg(null);
      const [res, paymentsRes] = await Promise.all([
        apiFetch<QuoteDetail>(`/customer/quotes/${quoteId}`),
        apiFetch<PaymentResult[] | { items?: PaymentResult[] }>('/customer/payments'),
      ]);
      if (res.success && res.data) {
        setQuote(res.data);
        // Already paid? Show the receipt instead of offering "Pay now" again.
        const list = Array.isArray(paymentsRes.data) ? paymentsRes.data : paymentsRes.data?.items ?? [];
        const paid = list.find(
          (p) => p.customerQuotationId === quoteId && ['paid', 'partiallyrefunded', 'refunded'].includes((p.status ?? '').toLowerCase())
        );
        setPaymentComplete(paid ? { ...paid, paymentId: paid.id } : null);
      } else {
        setErrorMsg(res.message || 'Quotation not found or not yet approved for viewing.');
      }
      setLoading(false);
    }
    if (quoteId) {
      loadQuote();
    }
  }, [quoteId, reloadKey]);

  const handleAcceptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote) return;

    setAccepting(true);
    setAcceptError(null);

    const idempotencyKey = `ACCEPT-${quote.id}-${Date.now()}`;
    const res = await apiFetch<BookingConfirmationDto>(`/customer/quotes/${quote.id}/accept`, {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        idempotencyKey,
        customerRemarks: acceptRemarks.trim() || undefined,
      }),
    });

    setAccepting(false);

    if (res.success && res.data) {
      setBookingConfirmation(res.data);
      setQuote({
        ...quote,
        status: 'Accepted',
        acceptedAtUtc: res.data.confirmedAtUtc,
      });
      setShowAcceptModal(false);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setAcceptError(res.message || 'Failed to accept quotation. Please try again.');
    }
  };

  const handlePayNow = async () => {
    if (!quote) return;
    setInitiatingPayment(true);
    setPaymentError(null);

    const idempotencyKey = `PAY-${quote.id}-${Date.now()}`;
    const res = await apiFetch<PaymentResult>(`/customer/quotes/${quote.id}/pay`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
    });

    if (res.success && res.data) {
      if (typeof res.data.amount === 'number') setInitiatedAmount(res.data.amount);
      if (res.data.gatewayProvider === DEV_GATEWAY) {
        const verifyRes = await apiFetch<PaymentResult>('/customer/payments/verify', {
          method: 'POST',
          body: JSON.stringify({
            paymentId: res.data.paymentId,
            gatewayPaymentId: `pay_direct_${Date.now()}`,
            gatewaySignature: 'sig_fake_valid',
            gatewayOrderId: res.data.gatewayOrderId,
          }),
        });

        if (verifyRes.success && verifyRes.data) {
          setPaymentComplete(verifyRes.data);
        } else {
          setPaymentError(verifyRes.message || 'We could not confirm the payment. Please try again.');
        }
      } else if (res.data.checkoutUrl) {
        // Real payment provider: continue on its secure checkout page.
        window.location.href = res.data.checkoutUrl;
        return;
      } else {
        setPaymentError('Online payment is not available right now. Please try again later.');
      }
    } else {
      setPaymentError(res.message || 'Payment initiation failed. Please try again.');
    }
    setInitiatingPayment(false);
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote) return;

    if (!rejectionReason.trim()) {
      setRejectError('Please tell us briefly why you are declining.');
      return;
    }

    setRejecting(true);
    setRejectError(null);

    const idempotencyKey = `REJECT-${quote.id}-${Date.now()}`;
    const res = await apiFetch<CustomerQuotationDecisionDto>(`/customer/quotes/${quote.id}/reject`, {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        reason: rejectionReason.trim(),
        category: rejectionCategory,
        idempotencyKey,
      }),
    });

    setRejecting(false);

    if (res.success && res.data) {
      setDecisionRecorded(res.data);
      setQuote({
        ...quote,
        status: 'Rejected',
        rejectedAtUtc: res.data.decidedAtUtc,
      });
      setShowRejectModal(false);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setRejectError(res.message || 'Failed to decline quotation. Please try again.');
    }
  };

  const lineItems = useMemo(
    () => [...(quote?.lineItems ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [quote]
  );

  if (loading && !quote) {
    return (
      <div className="mx-auto max-w-3xl space-y-5" aria-busy="true" aria-label="Loading quote">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-36" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Quote" backHref="/customer/quotes" backLabel="Quotes" />
        <ErrorState
          title="This quote is not available"
          error={errorMsg || 'This quote was not found or has not been sent to you yet.'}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </div>
    );
  }

  const currency = quote.currency || 'INR';
  const money = (amount: number | null | undefined) => formatINR(amount, currency);

  const isSent = quote.status === 'Sent';
  const isAccepted = quote.status === 'Accepted';
  const isRejected = quote.status === 'Rejected';
  const isExpired = quote.status === 'Expired';

  const vehicle = [quote.vehicleYear, quote.vehicleMake, quote.vehicleModel].filter(Boolean).join(' ');
  const garageName = bookingConfirmation?.garageName || quote.assignedGarageName;

  const validUntil = quote.validUntilUtc ? new Date(quote.validUntilUtc) : null;
  const msLeft = validUntil ? validUntil.getTime() - Date.now() : null;
  const daysLeft = msLeft !== null ? Math.ceil(msLeft / DAY_MS) : null;
  const pastValidity = msLeft !== null && msLeft < 0;

  let validityText: string | null = null;
  if (validUntil) {
    if (isSent && pastValidity) validityText = `Validity ended on ${formatDate(validUntil)}`;
    else if (isSent && daysLeft !== null && daysLeft <= 1) validityText = `Valid until ${formatDateTime(validUntil)}`;
    else if (isSent && daysLeft !== null) validityText = `Valid until ${formatDate(validUntil)} · ${daysLeft} days left`;
    else validityText = `Valid until ${formatDate(validUntil)}`;
  }

  const showPayBar = isAccepted && !paymentComplete;

  // Only the 10% booking advance is paid online; the rest is paid at the garage after the service.
  const total = Number(quote.customerTotal ?? 0);
  const advance = paymentComplete?.amount ?? initiatedAmount ?? advanceFor(total);
  const atGarage = Math.max(0, total - advance);
  const splitText = `After you accept: 10% online (${money(advance)}) to confirm · ${money(atGarage)} at the garage`;
  const showDecisionBar = isSent;

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <PageHeader
        backHref="/customer/quotes"
        backLabel="Quotes"
        eyebrow={
          <>
            <StatusBadge status={quote.status} />
            <span className="font-mono text-xs text-navy-500">{quote.quotationNumber}</span>
          </>
        }
        title={vehicle || 'Your quote'}
        description={[garageName, `Request ${quote.requestNumber}`].filter(Boolean).join(' · ')}
      />

      {/* Decision outcome banners */}
      {isAccepted && (
        <Card className="border-emerald-200 bg-emerald-50 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-emerald-900">Booking confirmed</h2>
              <p className="mt-0.5 text-sm text-emerald-800">
                {bookingConfirmation?.message || 'You accepted this quote. The garage has been told about your booking.'}
              </p>
            </div>
          </div>
          <dl className="mt-3 divide-y divide-emerald-200/80 rounded-xl bg-white/70 px-3">
            {garageName && <DetailRow label="Garage">{garageName}</DetailRow>}
            {bookingConfirmation?.garageAddress && (
              <DetailRow label="Address">{bookingConfirmation.garageAddress}</DetailRow>
            )}
            {bookingConfirmation?.garagePhone && (
              <DetailRow label="Phone">
                <a href={`tel:${bookingConfirmation.garagePhone}`} className="text-electric-600 underline">
                  {bookingConfirmation.garagePhone}
                </a>
              </DetailRow>
            )}
            <DetailRow label="Confirmed amount" strong>
              {money(bookingConfirmation?.confirmedTotal ?? quote.customerTotal)}
            </DetailRow>
            {quote.acceptedAtUtc && <DetailRow label="Accepted">{formatDateTime(quote.acceptedAtUtc)}</DetailRow>}
          </dl>
          <Link
            href="/customer/requests"
            className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-emerald-800 underline"
          >
            Track it in My requests
          </Link>
        </Card>
      )}

      {isAccepted && paymentComplete && (
        <Card className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-navy-900">Booking advance received</h2>
              <p className="mt-0.5 text-sm text-navy-600">
                {money(advance)} paid online. Pay the remaining {money(atGarage)} directly at the garage after the service.
              </p>
              {(paymentComplete.paymentNumber || paymentComplete.gatewayPaymentId) && (
                <p className="mt-0.5 break-all font-mono text-xs text-navy-500">
                  Ref {paymentComplete.paymentNumber || paymentComplete.gatewayPaymentId}
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href={`/customer/payments/${paymentComplete.id || paymentComplete.paymentId}`}>
              <Button variant="outline" className="w-full" leftIcon={<CreditCard className="h-4 w-4" />}>
                Receipt
              </Button>
            </Link>
            <Link href="/customer/invoices">
              <Button variant="outline" className="w-full" leftIcon={<Receipt className="h-4 w-4" />}>
                Invoices
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {isRejected && (
        <Alert type="error" title="You declined this quote">
          Your advisor has been told and may get back to you with another option.
          {decisionRecorded?.reason && (
            <span className="mt-1 block">Your reason: {decisionRecorded.reason}</span>
          )}
        </Alert>
      )}

      {isExpired && (
        <Alert type="warning" title="This quote has expired">
          It was valid until {formatDate(quote.validUntilUtc)}. Ask your advisor for an updated quote.
        </Alert>
      )}

      {/* Total */}
      <Card className="p-4 sm:p-5">
        <div className="text-sm text-navy-500">{isAccepted ? 'Total' : 'Quoted total'}</div>
        <div className="mt-0.5 text-3xl font-bold tracking-tight tabular-nums text-navy-900">
          {money(quote.customerTotal)}
        </div>
        <p className="mt-1 text-xs text-navy-500">
          Includes {money(quote.customerTax)} tax
          {quote.customerDiscount > 0 && ` and a ${money(quote.customerDiscount)} discount`}
        </p>
        {isAccepted && (
          <PriceSplit
            className="mt-3"
            total={total}
            advance={advance}
            atGarage={atGarage}
            totalLabel="Quote total"
            advancePaid={!!paymentComplete}
          />
        )}
        {isSent && (
          <>
            {/* Not accepted yet: nothing is payable, so no "pay now" wording. */}
            <dl className="mt-3 divide-y divide-surface-200 rounded-xl border border-surface-200 bg-white px-3.5 text-sm">
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-navy-500">Quote total</dt>
                <dd className="font-semibold tabular-nums text-navy-900">{formatINRWhole(total)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-navy-800">Online after you accept (10%)</dt>
                <dd className="font-semibold tabular-nums text-navy-900">{formatINRWhole(advance)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-navy-800">Pay at garage after service</dt>
                <dd className="font-semibold tabular-nums text-navy-900">{formatINRWhole(atGarage)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs leading-relaxed text-navy-500">
              Nothing to pay until you accept. After you accept, you pay 10% online to BroCo to confirm the booking and the
              remaining 90% directly at the garage after the service.
            </p>
          </>
        )}
        {validityText && (
          <div
            className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
              isSent && pastValidity ? 'bg-amber-50 text-amber-800' : 'bg-surface-50 text-navy-700'
            }`}
          >
            {isSent && pastValidity ? (
              <Clock className="h-4 w-4 shrink-0" />
            ) : (
              <CalendarClock className="h-4 w-4 shrink-0 text-navy-400" />
            )}
            <span>{validityText}</span>
          </div>
        )}
      </Card>

      {/* Scope */}
      {(quote.scopeSummary || quote.advisorRemarks) && (
        <Card className="p-4 sm:p-5">
          <h2 className="text-base font-semibold text-navy-900">What will be done</h2>
          {quote.scopeSummary && (
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-navy-700">{quote.scopeSummary}</p>
          )}
          {quote.advisorRemarks && (
            <div className="mt-3 rounded-xl bg-surface-50 p-3">
              <div className="text-xs font-medium text-navy-500">Note from your advisor</div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-navy-800">{quote.advisorRemarks}</p>
            </div>
          )}
        </Card>
      )}

      {/* Line items + price breakdown */}
      <section aria-labelledby="items-heading">
        <h2 id="items-heading" className="mb-2 px-1 text-base font-semibold text-navy-900">
          Price breakdown
        </h2>
        <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-card">
          {lineItems.length > 0 ? (
            <ul className="divide-y divide-surface-200/80">
              {lineItems.map((li) => (
                <li key={li.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="break-words text-sm font-medium text-navy-900">{li.description}</div>
                    <div className="mt-0.5 text-xs text-navy-500">
                      {humanize(li.lineType)} · {li.quantity} × {money(li.unitPrice)}
                      {li.discountAmount > 0 && (
                        <span className="text-emerald-700"> · {money(li.discountAmount)} off</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold tabular-nums text-navy-900">{money(li.lineTotal)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-navy-500">No itemised breakdown was included with this quote.</p>
          )}
          <dl className="divide-y divide-surface-200/80 border-t border-surface-200 bg-surface-50 px-4">
            <DetailRow label="Subtotal">{money(quote.customerSubtotal)}</DetailRow>
            {quote.customerDiscount > 0 && (
              <DetailRow label="Discount">
                <span className="text-emerald-700">−{money(quote.customerDiscount)}</span>
              </DetailRow>
            )}
            <DetailRow label="Tax">{money(quote.customerTax)}</DetailRow>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-base font-semibold text-navy-900">Total</dt>
              <dd className="text-lg font-bold tabular-nums text-navy-900">{money(quote.customerTotal)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {paymentError && (
        <Alert type="error" onClose={() => setPaymentError(null)}>
          {paymentError}
        </Alert>
      )}

      {/* Primary actions */}
      {showDecisionBar && (
        <>
          <ActionBar
            summary={
              <div>
                <div className="text-xs text-navy-500">Total</div>
                <div className="truncate text-base font-bold tabular-nums text-navy-900">{money(quote.customerTotal)}</div>
              </div>
            }
          >
            <Button
              variant="outline"
              onClick={() => {
                setRejectError(null);
                setShowRejectModal(true);
              }}
            >
              Decline
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setAcceptError(null);
                setShowAcceptModal(true);
              }}
            >
              Accept
            </Button>
          </ActionBar>
          <ActionBarSpacer />
        </>
      )}

      {showPayBar && (
        <>
          <ActionBar
            summary={
              <div>
                <div className="text-xs text-navy-500">Pay now (10%)</div>
                <div className="truncate text-base font-bold tabular-nums text-navy-900">{money(advance)}</div>
                <div className="truncate text-[11px] text-navy-500">{money(atGarage)} at the garage</div>
              </div>
            }
          >
            <Button
              variant="primary"
              onClick={handlePayNow}
              isLoading={initiatingPayment}
              leftIcon={<CreditCard className="h-4 w-4" />}
            >
              {initiatingPayment ? 'Processing…' : `Pay ${money(advance)}`}
            </Button>
          </ActionBar>
          <ActionBarSpacer />
        </>
      )}

      {/* Accept */}
      <Modal
        isOpen={showAcceptModal}
        onClose={() => !accepting && setShowAcceptModal(false)}
        title="Accept this quote?"
        description={splitText}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setShowAcceptModal(false)}
              disabled={accepting}
              className="w-full sm:w-auto"
            >
              Not yet
            </Button>
            <Button type="submit" form="accept-quote-form" variant="primary" isLoading={accepting} className="w-full sm:w-auto">
              Accept and book
            </Button>
          </div>
        }
      >
        <form id="accept-quote-form" onSubmit={handleAcceptSubmit} className="space-y-4">
          {acceptError && <Alert type="error">{acceptError}</Alert>}
          <dl className="divide-y divide-surface-200 rounded-xl border border-surface-200 px-3">
            {garageName && <DetailRow label="Garage">{garageName}</DetailRow>}
            <DetailRow label="Quote" mono>
              {quote.quotationNumber}
            </DetailRow>
            <DetailRow label="Total" strong>
              {money(quote.customerTotal)}
            </DetailRow>
            <DetailRow label="Then pay online (10%)" strong>
              {money(advance)}
            </DetailRow>
            <DetailRow label="Pay at the garage">{money(atGarage)}</DetailRow>
          </dl>
          <p className="text-xs leading-relaxed text-navy-500">
            After accepting you pay {money(advance)} online to BroCo to confirm the booking. The remaining {money(atGarage)} is
            paid directly at the garage after the service.
          </p>
          <Textarea
            id="acceptRemarks"
            label="Anything the garage should know? (optional)"
            rows={3}
            value={acceptRemarks}
            onChange={(e) => setAcceptRemarks(e.target.value)}
            placeholder="e.g. Morning drop-off works best for me."
          />
        </form>
      </Modal>

      {/* Decline */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => !rejecting && setShowRejectModal(false)}
        title="Decline this quote?"
        description="Your advisor will see your reason and can suggest another option."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setShowRejectModal(false)}
              disabled={rejecting}
              className="w-full sm:w-auto"
            >
              Keep quote
            </Button>
            <Button
              type="submit"
              form="reject-quote-form"
              variant="danger"
              isLoading={rejecting}
              leftIcon={<XCircle className="h-4 w-4" />}
              className="w-full sm:w-auto"
            >
              Decline quote
            </Button>
          </div>
        }
      >
        <form id="reject-quote-form" onSubmit={handleRejectSubmit} noValidate className="space-y-4">
          {rejectError && <Alert type="error">{rejectError}</Alert>}
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-navy-800">Main reason</legend>
            <div className="space-y-2">
              {REJECTION_CATEGORIES.map((cat) => {
                const selected = rejectionCategory === cat.key;
                return (
                  <label
                    key={cat.key}
                    className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition ${
                      selected
                        ? 'border-electric-600 bg-electric-50 font-medium text-navy-900 ring-1 ring-electric-600'
                        : 'border-surface-200 bg-white text-navy-700 hover:border-surface-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="rejectionCategory"
                      value={cat.key}
                      checked={selected}
                      onChange={(e) => setRejectionCategory(e.target.value)}
                      className="h-4 w-4 accent-electric-600"
                    />
                    <span>{cat.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <Textarea
            id="rejectionReason"
            label="Tell us a bit more"
            rows={3}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="This helps your advisor adjust the quote."
            required
          />
        </form>
      </Modal>
    </div>
  );
}
