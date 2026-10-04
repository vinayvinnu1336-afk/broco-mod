'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { PaymentDto } from '@/types/finance';
import { 
  CreditCard, 
  RotateCcw, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search, 
  Filter, 
  DollarSign, 
  X, 
  ArrowLeft,
  Building2,
  Calendar,
  Receipt
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Refund Modal State
  const [selectedPayment, setSelectedPayment] = useState<PaymentDto | null>(null);
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundReason, setRefundReason] = useState<string>('');
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  const loadPayments = async () => {
    setLoading(true);
    const res = await apiFetch<PaymentDto[]>('/admin/finance/payments');
    if (res.success && res.data) {
      setPayments(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;

    const amt = parseFloat(refundAmount);
    if (isNaN(amt) || amt <= 0) {
      setRefundError('Please provide a valid refund amount greater than 0.');
      return;
    }

    const maxRefundable = selectedPayment.amount - selectedPayment.refundedAmount;
    if (amt > maxRefundable) {
      setRefundError(`Amount exceeds maximum refundable amount of ₹${maxRefundable.toFixed(2)}.`);
      return;
    }

    if (!refundReason.trim()) {
      setRefundError('Mandatory refund justification reason is required.');
      return;
    }

    setRefunding(true);
    setRefundError(null);

    const res = await apiFetch<PaymentDto>(
      `/admin/finance/payments/${selectedPayment.id}/refund`,
      {
        method: 'POST',
        body: JSON.stringify({
          refundAmount: amt,
          reason: refundReason.trim(),
        }),
      }
    );

    setRefunding(false);

    if (res.success && res.data) {
      setSelectedPayment(null);
      setRefundAmount('');
      setRefundReason('');
      loadPayments();
    } else {
      setRefundError(res.message || 'Refund processing failed.');
    }
  };

  const filteredPayments = payments.filter((p) => {
    const matchesStatus = filterStatus === 'ALL' || p.status.toUpperCase() === filterStatus.toUpperCase();
    const matchesSearch =
      p.paymentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.gatewayPaymentId && p.gatewayPaymentId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.gatewayOrderId && p.gatewayOrderId.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-electric-600" />
            Platform Payments & Refunds
          </h1>
          <p className="text-sm text-navy-600 mt-1">
            Global view of all incoming payments, customer gateways, and administrative refunds
          </p>
        </div>
        <Link href="/admin/finance">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Finance Overview
          </Button>
        </Link>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-2xl border border-surface-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400" />
          <input
            type="text"
            placeholder="Search payments by payment number, gateway ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-50 border border-surface-200 rounded-xl text-sm text-navy-900 placeholder-navy-400 focus:outline-none focus:border-navy-900 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-navy-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter by payment status"
            className="px-3 py-2 bg-surface-50 border border-surface-200 rounded-xl text-sm text-navy-900 focus:outline-none focus:border-navy-900"
          >
            <option value="ALL">All Statuses</option>
            <option value="PAID">Paid</option>
            <option value="PENDING">Pending</option>
            <option value="REFUNDED">Refunded</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingState message="Loading platform payments..." />
      ) : filteredPayments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payments found"
          description={
            searchTerm || filterStatus !== 'ALL'
              ? 'No payments match your current search and filter settings.'
              : 'No customer payments recorded yet.'
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-50 border-b border-surface-200 text-navy-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 font-bold">Payment Ref</th>
                  <th className="px-6 py-4 font-bold">Gateway Ref</th>
                  <th className="px-6 py-4 font-bold">Purpose</th>
                  <th className="px-6 py-4 font-bold">Total Amount</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold">Date</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {filteredPayments.map((p) => {
                  const maxRefundable = p.amount - p.refundedAmount;
                  return (
                    <tr key={p.id} className="hover:bg-surface-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-xs text-navy-900">
                        {p.paymentNumber}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-navy-600">
                        {p.gatewayPaymentId || p.gatewayOrderId || 'N/A'}
                        <div className="text-[10px] text-navy-400">{p.gatewayProvider}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold text-navy-800 bg-surface-100 px-2 py-0.5 rounded-lg border border-surface-200">
                          {p.purpose}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-navy-900">
                        ₹{p.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        {p.refundedAmount > 0 && (
                          <div className="text-[11px] font-normal text-purple-700">
                            Refunded: ₹{p.refundedAmount.toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-6 py-4 text-xs text-navy-500">
                        {new Date(p.createdAtUtc).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {(p.status === 'Paid' || p.status === 'PartiallyRefunded') && maxRefundable > 0 ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedPayment(p);
                              setRefundAmount(maxRefundable.toString());
                              setRefundReason('');
                              setRefundError(null);
                            }}
                            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                          >
                            Refund
                          </Button>
                        ) : (
                          <span className="text-xs text-navy-400 font-mono">None</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Process Refund Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-surface-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-surface-100 pb-3">
              <h3 className="text-lg font-bold text-navy-900 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-purple-600" />
                Process Payment Refund
              </h3>
              <button
                onClick={() => setSelectedPayment(null)}
                className="text-navy-400 hover:text-navy-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-navy-700 space-y-2 bg-surface-50 p-4 rounded-xl border border-surface-200">
              <div className="flex justify-between">
                <span className="text-navy-500">Payment Number:</span>
                <span className="font-mono font-bold text-navy-900">{selectedPayment.paymentNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy-500">Original Amount:</span>
                <span className="font-mono font-bold text-navy-900">₹{selectedPayment.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy-500">Max Refundable:</span>
                <span className="font-bold text-purple-700 font-mono">
                  ₹{(selectedPayment.amount - selectedPayment.refundedAmount).toFixed(2)}
                </span>
              </div>
            </div>

            <form onSubmit={handleRefundSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-navy-800 mb-1.5">
                  Refund Amount (INR) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-surface-200 rounded-xl text-sm text-navy-900 placeholder-navy-400 focus:outline-none focus:border-navy-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-800 mb-1.5">
                  Refund Reason / Customer Justification <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Scope cancellation as approved by technical advisor"
                  className="w-full px-3.5 py-2 bg-white border border-surface-200 rounded-xl text-sm text-navy-900 placeholder-navy-400 focus:outline-none focus:border-navy-900"
                  required
                />
              </div>

              {refundError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                  {refundError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedPayment(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={refunding}
                >
                  Authorize Refund
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
