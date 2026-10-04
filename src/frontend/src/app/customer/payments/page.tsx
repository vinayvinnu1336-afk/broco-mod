'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { PaymentDto } from '@/types/finance';
import { 
  CreditCard, 
  Receipt,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs } from '@/components/ui/Tabs';

export default function CustomerPaymentsPage() {
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadPayments() {
      setLoading(true);
      try {
        const res = await apiFetch<PaymentDto[]>('/customer/payments');
        if (res.success && res.data) {
          setPayments(res.data);
        }
      } catch (err) {
        console.error('Error loading payments:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPayments();
  }, []);

  const filteredPayments = payments.filter((p) => {
    const matchesStatus = filterStatus === 'ALL' || p.status.toUpperCase() === filterStatus.toUpperCase();
    const matchesSearch = 
      p.paymentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.gatewayPaymentId && p.gatewayPaymentId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      p.amount.toString().includes(searchTerm);
    return matchesStatus && matchesSearch;
  });

  const tabs = [
    { id: 'ALL', label: 'All Payments', badge: payments.length },
    { id: 'PAID', label: 'Verified / Paid', badge: payments.filter(p => p.status.toUpperCase() === 'PAID').length },
    { id: 'PENDING', label: 'Pending', badge: payments.filter(p => p.status.toUpperCase() === 'PENDING').length },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy-900 tracking-tight flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-electric-600" />
            <span>Payments & Transactions</span>
          </h1>
          <p className="text-xs text-navy-500 mt-1">
            Track and verify all quotation payments, additional work authorizations, and receipts.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link href="/customer/invoices">
            <Button variant="outline" size="sm" leftIcon={<Receipt className="w-4 h-4 text-emerald-600" />}>
              View Tax Invoices
            </Button>
          </Link>
        </div>
      </div>

      {/* Trust Notice */}
      <div className="p-4 bg-white rounded-2xl border border-surface-200 shadow-card flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-xs text-navy-600 leading-relaxed">
          <strong className="text-navy-900 block font-bold mb-0.5">Escrow-Protected Automotive Payments</strong>
          All transactions are held in secure escrow and released to accredited garages only upon verified service milestone completion and vehicle handover.
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <Tabs tabs={tabs} activeTab={filterStatus} onChange={setFilterStatus} />
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search payment number or amount..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-navy-400" />}
          />
        </div>
      </div>

      {/* Payments Content */}
      {loading ? (
        <LoadingState message="Loading your payment records..." />
      ) : filteredPayments.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="w-7 h-7 text-navy-400" />}
          title="No Payment Records Found"
          description={
            searchTerm || filterStatus !== 'ALL'
              ? 'No payments match your active filter criteria.'
              : 'When you accept an approved quotation or authorize work, your payment history will be displayed here.'
          }
          action={
            <Link href="/customer/quotes">
              <Button size="sm" variant="outline">
                Review Quotations
              </Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment Reference</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Method & Gateway</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-mono font-bold text-navy-900">{p.paymentNumber}</div>
                    <div className="text-[11px] text-navy-500 font-mono mt-0.5 truncate max-w-[200px]">
                      {p.gatewayPaymentId || p.gatewayOrderId || 'Gateway Ref Pending'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-semibold text-navy-800">
                      {new Date(p.createdAtUtc).toLocaleDateString()}
                    </div>
                    <div className="text-[11px] text-navy-400">
                      {new Date(p.createdAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-bold text-navy-900">{p.paymentMethod || 'Online Transfer'}</div>
                    <div className="text-[11px] text-navy-500 font-mono">{p.gatewayProvider || 'Razorpay / Escrow'}</div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-base font-black text-navy-900">
                      ₹{p.amount.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/customer/payments/${p.id}`}>
                      <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                        Details
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
