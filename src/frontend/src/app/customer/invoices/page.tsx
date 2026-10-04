'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { InvoiceDto } from '@/types/finance';
import { 
  Receipt, 
  Search, 
  ArrowRight, 
  Calendar, 
  Building2, 
  FileText,
  CreditCard,
  Download,
  ShieldCheck
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';

export default function CustomerInvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadInvoices() {
      setLoading(true);
      try {
        const res = await apiFetch<InvoiceDto[]>('/customer/invoices');
        if (res.success && res.data) {
          setInvoices(res.data);
        }
      } catch (err) {
        console.error('Error loading invoices:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInvoices();
  }, []);

  const filteredInvoices = invoices.filter((inv) =>
    inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.garageName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.totalAmount.toString().includes(searchTerm)
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy-900 tracking-tight flex items-center gap-2.5">
            <Receipt className="w-6 h-6 text-emerald-600" />
            <span>Tax Invoices</span>
          </h1>
          <p className="text-xs text-navy-500 mt-1">
            Download and view official GST-compliant tax invoices for your completed automotive services.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link href="/customer/payments">
            <Button variant="outline" size="sm" leftIcon={<CreditCard className="w-4 h-4 text-electric-600" />}>
              View Payments
            </Button>
          </Link>
        </div>
      </div>

      {/* Compliance Guarantee Banner */}
      <div className="p-4 bg-white rounded-2xl border border-surface-200 shadow-card flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-xs text-navy-600 leading-relaxed">
          <strong className="text-navy-900 block font-bold mb-0.5">Statutory GST & Warranty Compliance</strong>
          Every tax invoice includes itemized parts serial numbers, workshop GSTIN, certified labor charges, and applicable warranty terms for insurance and resale validation.
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex justify-end">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search invoice number or workshop..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-navy-400" />}
          />
        </div>
      </div>

      {/* Invoices List */}
      {loading ? (
        <LoadingState message="Loading your tax invoices..." />
      ) : filteredInvoices.length === 0 ? (
        <EmptyState
          icon={<Receipt className="w-7 h-7 text-navy-400" />}
          title="No Invoices Issued Yet"
          description={
            searchTerm
              ? 'No invoices match your search term.'
              : 'Once a service payment is verified and work completed, your official tax invoice will appear here automatically.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredInvoices.map((inv) => (
            <Card key={inv.id} hoverEffect className="p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between border-b border-surface-200 pb-4 mb-4">
                  <div>
                    <span className="text-[11px] font-mono font-bold text-electric-700 bg-electric-50 px-2.5 py-1 rounded-lg border border-electric-200">
                      {inv.invoiceNumber}
                    </span>
                    <h3 className="text-base font-bold text-navy-900 mt-2 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-navy-400" />
                      <span>{inv.garageName}</span>
                    </h3>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-navy-400 uppercase">Total Amount</div>
                    <div className="text-xl font-black text-navy-900">
                      ₹{inv.totalAmount.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-navy-600 mb-6">
                  <div className="flex justify-between">
                    <span className="text-navy-400">Issue Date:</span>
                    <span className="font-semibold text-navy-800">
                      {new Date(inv.issuedAtUtc).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-navy-400">GST Breakdown:</span>
                    <span className="font-semibold text-navy-800">
                      ₹{inv.taxAmount.toLocaleString()} ({((inv.taxAmount / (inv.subTotal || 1)) * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-navy-400">Status:</span>
                    <StatusBadge status={inv.status} />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-surface-200 flex items-center justify-between">
                <Link href={`/customer/invoices/${inv.id}`}>
                  <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                    View Tax Invoice
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => alert(`Downloading PDF copy of ${inv.invoiceNumber}...`)}
                  leftIcon={<Download className="w-3.5 h-3.5" />}
                >
                  Download PDF
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
