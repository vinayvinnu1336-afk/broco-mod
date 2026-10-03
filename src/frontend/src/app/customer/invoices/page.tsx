'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { InvoiceDto } from '@/types/finance';
import { 
  Receipt, 
  CheckCircle2, 
  Search, 
  ArrowRight, 
  Calendar, 
  Building2, 
  FileText,
  CreditCard
} from 'lucide-react';

export default function CustomerInvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadInvoices() {
      setLoading(true);
      const res = await apiFetch<InvoiceDto[]>('/customer/invoices');
      if (res.success && res.data) {
        setInvoices(res.data);
      }
      setLoading(false);
    }
    loadInvoices();
  }, []);

  const filteredInvoices = invoices.filter((inv) =>
    inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.garageName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.totalAmount.toString().includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Receipt className="w-6 h-6 text-emerald-400" />
            Tax Invoices
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Download and view official GST compliant tax invoices for completed services
          </p>
        </div>
        <Link
          href="/customer/payments"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
        >
          <CreditCard className="w-4 h-4 text-blue-400" />
          View Payments
        </Link>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by invoice number, garage name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Invoices List */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 rounded-xl border border-slate-800">
          <Receipt className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-white">No invoices issued</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? 'No invoices match your search query.'
              : 'Once a payment is successfully verified, your official tax invoice will appear here automatically.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredInvoices.map((inv) => (
            <div
              key={inv.id}
              className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-mono font-medium text-emerald-400">
                      {inv.invoiceNumber}
                    </span>
                    <h3 className="font-semibold text-white mt-1 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      {inv.garageName}
                    </h3>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" />
                    {inv.status}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Issued Date:</span>
                    <span className="text-slate-200">
                      {new Date(inv.issuedAtUtc).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="text-slate-200">
                      {inv.currency} {inv.subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST (Tax):</span>
                    <span className="text-slate-200">
                      {inv.currency} {inv.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400">Total Paid</span>
                  <div className="text-lg font-bold text-white">
                    {inv.currency} {inv.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <Link
                  href={`/customer/invoices/${inv.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-colors"
                >
                  View Tax Invoice
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
