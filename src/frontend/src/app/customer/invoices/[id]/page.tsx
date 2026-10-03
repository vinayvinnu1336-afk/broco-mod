'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { InvoiceDto } from '@/types/finance';
import { 
  Receipt, 
  ArrowLeft, 
  Printer, 
  CheckCircle2, 
  Building2, 
  User, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export default function CustomerInvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvoice() {
      setLoading(true);
      setErrorMsg(null);
      const res = await apiFetch<InvoiceDto>(`/customer/invoices/${invoiceId}`);
      if (res.success && res.data) {
        setInvoice(res.data);
      } else {
        setErrorMsg(res.message || 'Invoice not found or unauthorized.');
      }
      setLoading(false);
    }
    if (invoiceId) {
      loadInvoice();
    }
  }, [invoiceId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (errorMsg || !invoice) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-xl text-rose-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-3" />
          <h2 className="text-lg font-bold">Unable to load invoice</h2>
          <p className="text-sm mt-1">{errorMsg}</p>
          <Link
            href="/customer/invoices"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Invoices
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top action bar (hidden on print) */}
      <div className="print:hidden flex items-center justify-between">
        <Link
          href="/customer/invoices"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Invoices
        </Link>
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <Printer className="w-4 h-4" />
          Print / Save PDF
        </button>
      </div>

      {/* Tax Invoice Document */}
      <div className="bg-white text-slate-900 rounded-2xl p-8 sm:p-12 shadow-2xl border border-slate-200 print:shadow-none print:border-none print:p-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b-2 border-slate-900 pb-8">
          <div>
            <div className="text-3xl font-black tracking-tight text-slate-900">
              BROCO<span className="text-blue-600">MOD</span>
            </div>
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold mt-1">
              Automotive Service Marketplace
            </p>
            <p className="text-xs text-slate-600 mt-2 max-w-xs">
              Platform operated by BroCoMod Technologies Pvt Ltd.<br />
              Bangalore, Karnataka, India
            </p>
          </div>

          <div className="text-left sm:text-right">
            <div className="inline-block px-3 py-1 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded font-bold text-xs uppercase tracking-wider mb-2">
              Tax Invoice
            </div>
            <div className="text-xl font-bold text-slate-900 font-mono">
              {invoice.invoiceNumber}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              Date: {new Date(invoice.issuedAtUtc).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </div>
            <div className="text-xs text-slate-600">
              Status: <span className="font-semibold text-emerald-700">{invoice.status.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Parties (Workshop & Customer) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-8 border-b border-slate-200">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
              Service Workshop (Provider)
            </span>
            <h4 className="font-bold text-slate-900 text-base">{invoice.garageName}</h4>
            <p className="text-xs text-slate-600 mt-1 whitespace-pre-line">
              {invoice.garageAddress}
            </p>
            {invoice.garageGstNumber && (
              <p className="text-xs font-mono text-slate-700 mt-2">
                <span className="font-semibold">GSTIN:</span> {invoice.garageGstNumber}
              </p>
            )}
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
              Billed To (Customer)
            </span>
            <h4 className="font-bold text-slate-900 text-base">{invoice.customerName}</h4>
            <p className="text-xs text-slate-600 mt-1">{invoice.customerEmail}</p>
            <p className="text-xs text-slate-600">{invoice.customerPhone}</p>
            <p className="text-xs text-slate-600 mt-1 whitespace-pre-line">
              {invoice.customerBillingAddress || 'Digital Service Delivery Address'}
            </p>
          </div>
        </div>

        {/* Itemized Line Items Table */}
        <div className="py-8">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b-2 border-slate-900 text-slate-900 uppercase font-bold">
                <th className="py-3 pr-4">#</th>
                <th className="py-3 px-4">Item & Description</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 pl-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoice.lineItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="py-3 pr-4 font-mono text-slate-500">{idx + 1}</td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{item.description}</div>
                    <div className="text-[11px] text-slate-500 capitalize">{item.itemType}</div>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-700">{item.quantity}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700">
                    {invoice.currency} {item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 pl-4 text-right font-mono font-semibold text-slate-900">
                    {invoice.currency} {item.lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary & Totals */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-8 pt-6 border-t-2 border-slate-900">
          <div className="max-w-xs text-xs text-slate-500">
            <p className="font-semibold text-slate-700 mb-1">Notes & Declaration:</p>
            <p>
              This is a computer-generated tax invoice verified under the GST framework of India.
              Payment was completed in full via BroCoMod Escrow Gateway.
            </p>
            {invoice.notes && <p className="mt-2 text-slate-600">{invoice.notes}</p>}
          </div>

          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-600">Subtotal:</span>
              <span className="font-mono text-slate-900 font-medium">
                {invoice.currency} {invoice.subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-600">GST ({invoice.taxRatePercent}%):</span>
              <span className="font-mono text-slate-900 font-medium">
                {invoice.currency} {invoice.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b-2 border-slate-900 text-sm font-bold">
              <span className="text-slate-900">Total (Inclusive of Taxes):</span>
              <span className="font-mono text-slate-900 text-base">
                {invoice.currency} {invoice.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Stamp / Seal Footer */}
        <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Authorized Digital Signature & Verified Escrow Settlement</span>
          </div>
          <div className="font-mono text-[11px]">
            Payment Ref: {invoice.paymentId}
          </div>
        </div>
      </div>
    </div>
  );
}
