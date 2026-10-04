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
  ArrowLeft, 
  Receipt,
  ShieldCheck,
  Building,
  Calendar,
  Hash,
  ExternalLink
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';

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
      try {
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
      } catch (err) {
        console.error('Error fetching payment:', err);
        setErrorMsg('Unable to retrieve payment record.');
      } finally {
        setLoading(false);
      }
    }
    if (paymentId) {
      loadData();
    }
  }, [paymentId]);

  if (loading) {
    return <LoadingState message="Loading payment transaction details..." />;
  }

  if (errorMsg || !payment) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <ErrorState
          title="Payment Not Found"
          error={errorMsg}
          action={
            <Link href="/customer/payments">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back to Payments
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 font-sans">
      {/* Back button */}
      <div>
        <Link
          href="/customer/payments"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-navy-500 hover:text-electric-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Payments</span>
        </Link>
      </div>

      {/* Main Payment Card */}
      <Card className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b border-surface-200 pb-6 gap-4">
          <div>
            <div className="text-xs font-mono font-bold text-electric-700 bg-electric-50 px-2.5 py-1 rounded-lg border border-electric-200 inline-block mb-2">
              {payment.paymentNumber}
            </div>
            <h1 className="text-2xl font-black text-navy-900 tracking-tight">Payment Receipt</h1>
            <p className="text-xs text-navy-500 mt-0.5">
              Escrow transaction processed via {payment.gatewayProvider || 'Secure Platform Gateway'}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-xs font-bold text-navy-400 uppercase">Paid Amount</div>
            <div className="text-3xl font-black text-navy-900 mt-0.5">
              ₹{payment.amount.toLocaleString()}
            </div>
            <div className="mt-2">
              <StatusBadge status={payment.status} />
            </div>
          </div>
        </div>

        {/* Transaction Meta Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6 text-xs">
          <div className="bg-surface-50 p-4 rounded-xl border border-surface-200">
            <span className="text-navy-400 block font-semibold">Gateway Order ID:</span>
            <span className="font-mono font-bold text-navy-900 text-sm mt-0.5 block truncate">
              {payment.gatewayOrderId || 'N/A'}
            </span>
          </div>

          <div className="bg-surface-50 p-4 rounded-xl border border-surface-200">
            <span className="text-navy-400 block font-semibold">Gateway Transaction ID:</span>
            <span className="font-mono font-bold text-navy-900 text-sm mt-0.5 block truncate">
              {payment.gatewayPaymentId || 'N/A (Direct Verification)'}
            </span>
          </div>

          <div className="bg-surface-50 p-4 rounded-xl border border-surface-200">
            <span className="text-navy-400 block font-semibold">Payment Method:</span>
            <span className="font-bold text-navy-900 text-sm mt-0.5 block">
              {payment.paymentMethod || 'Online Transfer'}
            </span>
          </div>

          <div className="bg-surface-50 p-4 rounded-xl border border-surface-200">
            <span className="text-navy-400 block font-semibold">Processed At:</span>
            <span className="font-bold text-navy-900 text-sm mt-0.5 block">
              {new Date(payment.createdAtUtc).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Linked Tax Invoice */}
        {invoice ? (
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-900">Official GST Invoice Issued</div>
                <div className="text-xs text-emerald-700 font-mono">{invoice.invoiceNumber}</div>
              </div>
            </div>
            <Link href={`/customer/invoices/${invoice.id}`}>
              <Button size="sm" variant="primary">
                View Tax Invoice
              </Button>
            </Link>
          </div>
        ) : (
          <div className="p-4 bg-surface-50 rounded-xl border border-surface-200 text-xs text-navy-600 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Tax Invoice generating upon service signoff...</span>
            </span>
            <Link href="/customer/invoices" className="font-bold text-electric-600 hover:underline">
              Check Invoices
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
