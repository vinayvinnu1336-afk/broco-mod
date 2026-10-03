'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { PaymentDto, InvoiceDto } from '@/types/finance';
import { 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RotateCcw, 
  ArrowLeft, 
  Receipt,
  ShieldCheck,
  Building,
  Calendar,
  Hash,
  ExternalLink
} from 'lucide-react';

export default function CustomerPaymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const paymentId = params.id as string;

  const [payment, setPayment] = useState<PaymentDto | null>(null);
  const [invoice, setInvoice] = useState<InvoiceDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setErrorMsg(null);
      const res = await apiFetch<PaymentDto>(`/customer/payments/${paymentId}`);
      if (res.success && res.data) {
        setPayment(res.data);
        if (res.data.status === 'Paid') {
          const invRes = await apiFetch<InvoiceDto>(`/customer/invoices/by-payment/${paymentId}`);
          if (invRes.success && invRes.data) {
            setInvoice(invRes.data);
          }
        }
      } else {
        setErrorMsg(res.message || 'Payment not found or unauthorized.');
      }
      setLoading(false);
    }
    if (paymentId) {
      loadData();
    }
  }, [paymentId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (errorMsg || !payment) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-xl text-rose-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-3" />
          <h2 className="text-lg font-bold">Unable to load payment details</h2>
          <p className="text-sm mt-1">{errorMsg}</p>
          <Link
            href="/customer/payments"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Payments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/customer/payments"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Payments
        </Link>
      </div>

      {/* Main Payment Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        {/* Status watermark */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-6">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Official Payment Receipt
            </span>
            <h1 className="text-2xl font-bold text-white mt-1 flex items-center gap-3">
              {payment.paymentNumber}
              {payment.status === 'Paid' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Paid Successfully
                </span>
              ) : payment.status === 'Pending' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Clock className="w-3.5 h-3.5" />
                  Pending
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {payment.status}
                </span>
              )}
            </h1>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400">Total Amount</span>
            <div className="text-2xl font-black text-emerald-400">
              {payment.currency} {payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-slate-800">
          <div>
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              Transaction Timestamp
            </span>
            <p className="text-sm font-medium text-white">
              {payment.paidAtUtc
                ? new Date(payment.paidAtUtc).toLocaleString('en-IN')
                : new Date(payment.createdAtUtc).toLocaleString('en-IN')}
            </p>
          </div>

          <div>
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Gateway Reference
            </span>
            <p className="text-sm font-mono text-slate-300">
              {payment.gatewayPaymentId || 'N/A'}
            </p>
          </div>

          <div>
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1">
              <Hash className="w-3.5 h-3.5 text-amber-400" />
              Gateway Order ID
            </span>
            <p className="text-sm font-mono text-slate-300">
              {payment.gatewayOrderId || 'N/A'}
            </p>
          </div>

          <div>
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1">
              <Building className="w-3.5 h-3.5 text-purple-400" />
              Payment Gateway Provider
            </span>
            <p className="text-sm font-medium text-white">
              {payment.gatewayProvider} (Secured Escrow)
            </p>
          </div>
        </div>

        {/* Linked Invoice CTA */}
        {invoice && (
          <div className="mt-6 bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Tax Invoice Available</h4>
                <p className="text-xs text-slate-400">
                  Tax invoice {invoice.invoiceNumber} has been issued and stored securely.
                </p>
              </div>
            </div>
            <Link
              href={`/customer/invoices/${invoice.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg transition-colors"
            >
              View Invoice
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
