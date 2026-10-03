'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  CustomerFacingQuotationDto,
  BookingConfirmationDto,
  CustomerQuotationDecisionDto,
} from '@/types/customerQuotation';
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  XCircle,
  Wrench,
  X,
  ChevronRight,
  CreditCard,
  Receipt,
  RotateCcw,
} from 'lucide-react';

export default function CustomerQuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.id as string;

  const [quote, setQuote] = useState<CustomerFacingQuotationDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Milestone 7 Acceptance Modal State
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [acceptRemarks, setAcceptRemarks] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [bookingConfirmation, setBookingConfirmation] = useState<BookingConfirmationDto | null>(null);

  // Milestone 10 Payment State
  const [initiatingPayment, setInitiatingPayment] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState<any>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Milestone 7 Rejection Modal State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionCategory, setRejectionCategory] = useState('PRICE_TOO_HIGH');
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [decisionRecorded, setDecisionRecorded] = useState<CustomerQuotationDecisionDto | null>(null);

  useEffect(() => {
    async function loadQuote() {
      setLoading(true);
      setErrorMsg(null);
      const res = await apiFetch<CustomerFacingQuotationDto>(`/customer/quotes/${quoteId}`);
      if (res.success && res.data) {
        setQuote(res.data);
      } else {
        setErrorMsg(res.message || 'Quotation not found or not yet approved for viewing.');
      }
      setLoading(false);
    }
    if (quoteId) {
      loadQuote();
    }
  }, [quoteId]);

  // Handle Acceptance
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
    } else {
      setAcceptError(res.message || 'Failed to accept quotation. Please try again.');
    }
  };

  // Milestone 10 Payment Initiation
  const handlePayNow = async () => {
    if (!quote) return;
    setInitiatingPayment(true);
    setPaymentError(null);

    const idempotencyKey = `PAY-${quote.id}-${Date.now()}`;
    const res = await apiFetch<any>(`/customer/quotes/${quote.id}/pay`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
    });

    if (res.success && res.data) {
      // In development / test environment, verify immediately with fake gateway signature
      const verifyRes = await apiFetch<any>('/customer/payments/verify', {
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
        setPaymentComplete(res.data);
      }
    } else {
      setPaymentError(res.message || 'Payment initiation failed. Please try again.');
    }
    setInitiatingPayment(false);
  };

  // Handle Rejection
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote) return;

    if (!rejectionReason.trim()) {
      setRejectError('Please provide a mandatory explanation for declining.');
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
    } else {
      setRejectError(res.message || 'Failed to decline quotation. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-sm text-navy-500">
        Loading commercial proposal...
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-navy-900">Quotation Unavailable</h2>
        <p className="text-xs text-navy-600">
          {errorMsg || 'This quotation is either not found or has not yet been sent by your technical advisor.'}
        </p>
        <Link
          href="/customer/quotes"
          className="inline-flex items-center gap-2 px-4 py-2 bg-navy-900 text-white rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Quotations
        </Link>
      </div>
    );
  }

  const isSent = quote.status === 'Sent';
  const isAccepted = quote.status === 'Accepted';
  const isRejected = quote.status === 'Rejected';
  const isExpired = quote.status === 'Expired';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Back button & Header */}
      <div className="space-y-1">
        <Link
          href="/customer/quotes"
          className="inline-flex items-center gap-1.5 text-xs text-navy-500 hover:text-navy-900 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to All Quotations
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-navy-900 tracking-tight">
              Quotation Proposal {quote.quotationNumber}
            </h1>
            <span
              className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                isAccepted
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : isRejected
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : isExpired
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              {quote.status}
            </span>
          </div>
          <div className="text-xs text-navy-500">
            Linked to Request <span className="font-mono font-bold text-navy-900">#{quote.requestNumber}</span>
          </div>
        </div>
      </div>

      {/* CONFIRMED BOOKING BANNER (If Accepted) */}
      {isAccepted && (
        <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-md">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h2 className="text-lg font-black text-emerald-950 uppercase tracking-wide">
                  Booking Confirmed
                </h2>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 px-3 py-1 rounded-full border border-emerald-200">
                  Intake Preparation Active
                </span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                {bookingConfirmation?.message ||
                  'Your service booking is officially confirmed. Our certified partner workshop has been notified and scheduled for vehicle intake.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-emerald-200/80 text-xs">
            <div className="bg-white/80 p-3 rounded-xl border border-emerald-200">
              <span className="text-[10px] font-bold uppercase text-emerald-700 block">Service Reference</span>
              <span className="font-mono font-bold text-navy-900 text-sm">{quote.requestNumber}</span>
            </div>
            <div className="bg-white/80 p-3 rounded-xl border border-emerald-200">
              <span className="text-[10px] font-bold uppercase text-emerald-700 block">Partner Workshop</span>
              <span className="font-bold text-navy-900 text-sm">
                {bookingConfirmation?.garageName || quote.assignedGarageName || 'Central Metro Motors'}
              </span>
            </div>
            <div className="bg-white/80 p-3 rounded-xl border border-emerald-200">
              <span className="text-[10px] font-bold uppercase text-emerald-700 block">Confirmed Amount</span>
              <span className="font-black text-emerald-700 text-sm">
                ₹{quote.customerTotal.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Milestone 10 Payment Section */}
          <div className="mt-4 pt-4 border-t border-emerald-200/80">
            {paymentComplete ? (
              <div className="bg-white p-4 rounded-xl border border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-900 block">Payment Verified & Settled in Escrow</span>
                    <span className="text-[11px] text-emerald-700 font-mono">
                      Ref: {paymentComplete.paymentNumber || paymentComplete.gatewayPaymentId || 'Verified'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/customer/payments/${paymentComplete.id || paymentComplete.paymentId}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Receipt
                  </Link>
                  <Link
                    href="/customer/invoices"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    Tax Invoice
                  </Link>
                </div>
              </div>
            ) : (
              <div className="bg-white p-4 rounded-xl border border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div>
                  <span className="text-xs font-bold text-navy-900 block">Ready to complete payment?</span>
                  <span className="text-[11px] text-navy-600">
                    Pay ₹{quote.customerTotal.toLocaleString()} into BroCoMod secure escrow. Workshop begins work upon escrow verification.
                  </span>
                  {paymentError && (
                    <span className="text-xs text-rose-600 block mt-1">{paymentError}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handlePayNow}
                  disabled={initiatingPayment}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition whitespace-nowrap"
                >
                  <CreditCard className="w-4 h-4" />
                  {initiatingPayment ? 'Processing...' : `Pay ₹${quote.customerTotal.toLocaleString()}`}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-[11px] text-emerald-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Confirmed on{' '}
                {quote.acceptedAtUtc ? new Date(quote.acceptedAtUtc).toLocaleString() : 'Today'}
              </span>
            </div>
            <Link
              href="/customer/requests"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <span>View In Service Requests</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* DECLINED BANNER (If Rejected) */}
      {isRejected && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 shadow-sm flex items-start gap-4">
          <XCircle className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-rose-900">
            <strong className="block text-sm font-bold text-rose-950">
              Quotation Proposal Declined
            </strong>
            <p className="leading-relaxed text-rose-800">
              You declined this quotation proposal. Your dedicated technical advisor has been notified and can assist you with alternative workshop quotes or scope adjustments.
            </p>
            {decisionRecorded?.reason && (
              <div className="mt-2 p-2.5 bg-white/70 rounded-lg border border-rose-200 text-rose-900">
                <span className="font-bold text-[11px] block">Recorded Reason:</span>
                <span className="italic">{decisionRecorded.reason}</span>
              </div>
            )}
            <div className="pt-2">
              <Link
                href="/customer/requests"
                className="inline-flex items-center gap-1 font-bold text-rose-700 hover:underline"
              >
                <span>Return to Service Requests</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* EXPIRED BANNER (If Expired) */}
      {isExpired && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm flex items-start gap-4">
          <Clock className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-amber-900">
            <strong className="block text-sm font-bold text-amber-950">
              Quotation Validity Expired
            </strong>
            <p className="leading-relaxed text-amber-800">
              This quotation proposal expired on {new Date(quote.validUntilUtc).toLocaleDateString()} and is no longer valid for direct confirmation. Please reach out to your technical advisor to issue an updated proposal.
            </p>
          </div>
        </div>
      )}

      {/* Trust & Guarantee Banner */}
      <div className="p-4 bg-navy-900 rounded-2xl text-white flex items-start gap-3 border border-navy-800 shadow-sm">
        <ShieldCheck className="w-5 h-5 text-electric-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-surface-200">
          <strong className="text-white block text-sm mb-0.5">BroCo Mod Certified Warranty Guarantee</strong>
          This quotation has been reviewed and verified by a BroCo Mod Technical Advisor. All OEM parts, labour rates, and statutory taxes are fixed and guaranteed against surprise additional charges.
        </div>
      </div>

      {/* Scope & Details Card */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
          Scope of Work
        </h2>
        <p className="text-xs text-navy-700 bg-surface-50 p-4 rounded-xl border border-surface-200 leading-relaxed font-medium">
          {quote.scopeSummary}
        </p>

        {quote.advisorRemarks && (
          <div className="space-y-1">
            <div className="text-xs font-bold text-navy-800">Advisor Remarks & Coverage</div>
            <p className="text-xs text-navy-600 bg-surface-50 p-3 rounded-xl border border-surface-200">
              {quote.advisorRemarks}
            </p>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-navy-500 pt-1">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-navy-400" />
            <span>Valid until {new Date(quote.validUntilUtc).toLocaleDateString()}</span>
          </span>
          {quote.sentAtUtc && (
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-navy-400" />
              <span>Received {new Date(quote.sentAtUtc).toLocaleDateString()}</span>
            </span>
          )}
        </div>
      </div>

      {/* Commercial Line Items Table */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
          Approved Items & Service Breakdown
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-surface-50 text-navy-600 border-b border-surface-200">
              <tr>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-3 text-right">Discount</th>
                <th className="py-2.5 px-3 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 text-navy-800 font-medium">
              {quote.lineItems.map((li) => (
                <tr key={li.id}>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 bg-surface-100 border border-surface-200 rounded text-[10px] font-bold text-navy-700">
                      {li.lineType}
                    </span>
                  </td>
                  <td className="py-3 px-3">{li.description}</td>
                  <td className="py-3 px-3 text-right">{li.quantity}</td>
                  <td className="py-3 px-3 text-right">₹{li.unitPrice.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right text-rose-600">
                    {li.discountAmount > 0 ? `-₹${li.discountAmount.toLocaleString()}` : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-bold">₹{li.lineTotal.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1 max-w-sm">
          <div className="text-xs font-bold text-navy-900 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-navy-400" />
            <span>Transparent Pricing Policy</span>
          </div>
          <p className="text-[11px] text-navy-500 leading-relaxed">
            All prices include certified partner workshop labor, genuine OEM parts, and statutory GST. No hidden fees or unauthorized additions upon delivery.
          </p>
        </div>

        <div className="w-full sm:w-72 space-y-2 text-right">
          <div className="flex justify-between text-xs text-navy-600">
            <span>Items Subtotal:</span>
            <span className="font-semibold text-navy-900">₹{quote.customerSubtotal.toLocaleString()}</span>
          </div>
          {quote.customerDiscount > 0 && (
            <div className="flex justify-between text-xs text-rose-600 font-semibold">
              <span>Promotional Discount:</span>
              <span>-₹{quote.customerDiscount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-xs text-navy-600">
            <span>Taxes & GST:</span>
            <span className="font-semibold text-navy-900">₹{quote.customerTax.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-navy-900 border-t border-surface-200 pt-2">
            <span>Total Payable:</span>
            <span className="text-electric-600 text-xl font-black">₹{quote.customerTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Milestone 7 CUSTOMER DECISION ACTIONS (When status is Sent) */}
      {isSent && (
        <div className="p-6 bg-white border-2 border-electric-200 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-bold text-navy-900 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-electric-600" />
              <span>Ready for Booking Confirmation</span>
            </div>
            <p className="text-xs text-navy-600 max-w-md">
              Accept this proposal to lock in fixed rates and schedule workshop intake, or decline if the scope or budget does not meet your needs.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                setRejectError(null);
                setShowRejectModal(true);
              }}
              className="px-4 py-2.5 bg-surface-100 hover:bg-surface-200 text-rose-700 hover:text-rose-800 rounded-xl text-xs font-bold transition border border-surface-300"
            >
              Decline Proposal
            </button>
            <button
              type="button"
              onClick={() => {
                setAcceptError(null);
                setShowAcceptModal(true);
              }}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold tracking-wide transition shadow-sm flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Accept & Book Service</span>
            </button>
          </div>
        </div>
      )}

      {/* ACCEPTANCE MODAL */}
      {showAcceptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-surface-200">
            <div className="flex items-center justify-between pb-3 border-b border-surface-200">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-navy-900">Confirm Service Booking</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAcceptModal(false)}
                className="text-navy-400 hover:text-navy-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {acceptError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{acceptError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="bg-surface-50 p-4 rounded-xl border border-surface-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-navy-500">Quotation Reference:</span>
                  <span className="font-mono font-bold text-navy-900">{quote.quotationNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-navy-500">Service Request:</span>
                  <span className="font-mono font-bold text-navy-900">#{quote.requestNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-navy-500">Partner Workshop:</span>
                  <span className="font-bold text-navy-900">{quote.assignedGarageName || 'Central Metro Motors'}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-surface-200 text-sm font-bold">
                  <span className="text-navy-900">Fixed Confirmed Total:</span>
                  <span className="text-emerald-600 text-base font-black">₹{quote.customerTotal.toLocaleString()}</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-[11px] flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>
                  Price guarantee activated. You will receive an official booking confirmation and the workshop will initiate parts staging.
                </span>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-navy-800 block">
                  Optional Remarks / Preferred Handover Notes
                </label>
                <textarea
                  rows={3}
                  value={acceptRemarks}
                  onChange={(e) => setAcceptRemarks(e.target.value)}
                  placeholder="e.g., Preferred morning drop-off, key handover at reception, or specific vehicle note..."
                  className="w-full text-xs p-3 rounded-xl border border-surface-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-200">
              <button
                type="button"
                onClick={() => setShowAcceptModal(false)}
                disabled={accepting}
                className="px-4 py-2 text-xs font-bold text-navy-600 hover:text-navy-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAcceptSubmit}
                disabled={accepting}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {accepting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Confirming Booking...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirm Acceptance</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-surface-200">
            <div className="flex items-center justify-between pb-3 border-b border-surface-200">
              <div className="flex items-center gap-2 text-rose-700">
                <XCircle className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-base text-navy-900">Decline Quotation Proposal</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="text-navy-400 hover:text-navy-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {rejectError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{rejectError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <p className="text-navy-600 leading-relaxed">
                Please help us understand why this proposal was not suitable. Your feedback is sent directly to your technical advisor to explore alternative solutions.
              </p>

              <div className="space-y-2">
                <label className="font-bold text-navy-800 block">Primary Reason Category</label>
                <div className="space-y-2">
                  {[
                    { key: 'PRICE_TOO_HIGH', label: 'Quoted price exceeds my budget / too high' },
                    { key: 'TIMING_NOT_SUITABLE', label: 'Estimated turnaround time is too long' },
                    { key: 'SERVICE_NOT_REQUIRED', label: 'Service or repair no longer required' },
                    { key: 'CHANGED_MIND', label: 'Decided to service elsewhere or postpone' },
                    { key: 'OTHER', label: 'Other reason' },
                  ].map((cat) => (
                    <label
                      key={cat.key}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                        rejectionCategory === cat.key
                          ? 'bg-rose-50 border-rose-300 text-rose-950 font-bold'
                          : 'bg-surface-50 border-surface-200 text-navy-700 hover:bg-surface-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="rejectionCategory"
                        value={cat.key}
                        checked={rejectionCategory === cat.key}
                        onChange={(e) => setRejectionCategory(e.target.value)}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span>{cat.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-navy-800 block">
                  Explanation / Remarks <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide details (mandatory so advisor can adjust proposal)..."
                  className="w-full text-xs p-3 rounded-xl border border-surface-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-200">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                disabled={rejecting}
                className="px-4 py-2 text-xs font-bold text-navy-600 hover:text-navy-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={rejecting}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {rejecting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Declining Proposal...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    <span>Decline Quotation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
