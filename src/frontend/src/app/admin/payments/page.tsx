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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Paid
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </span>
        );
      case 'Refunded':
      case 'PartiallyRefunded':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <RotateCcw className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3.5 h-3.5" />
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-400" />
            Platform Payments & Refunds
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Global view of all incoming payments, customer gateways, and administrative refunds
          </p>
        </div>
        <Link
          href="/admin/finance"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Finance Overview
        </Link>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search payments by payment number, gateway ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter by payment status"
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
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
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 rounded-xl border border-slate-800">
          <CreditCard className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-white">No payments found</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm || filterStatus !== 'ALL'
              ? 'No payments match your current search and filter settings.'
              : 'No customer payments recorded yet.'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 font-semibold">Payment Ref</th>
                  <th className="px-6 py-4 font-semibold">Gateway Ref</th>
                  <th className="px-6 py-4 font-semibold">Purpose</th>
                  <th className="px-6 py-4 font-semibold">Total Amount</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredPayments.map((p) => {
                  const maxRefundable = p.amount - p.refundedAmount;
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-white">
                        {p.paymentNumber}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">
                        {p.gatewayPaymentId || p.gatewayOrderId || 'N/A'}
                        <div className="text-[11px] text-slate-500">{p.gatewayProvider}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                          {p.purpose}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-white">
                        ₹ {p.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        {p.refundedAmount > 0 && (
                          <div className="text-xs text-purple-400">
                            Refunded: ₹ {p.refundedAmount.toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(p.status)}</td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {new Date(p.createdAtUtc).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {(p.status === 'Paid' || p.status === 'PartiallyRefunded') && maxRefundable > 0 ? (
                          <button
                            onClick={() => {
                              setSelectedPayment(p);
                              setRefundAmount(maxRefundable.toString());
                              setRefundReason('');
                              setRefundError(null);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Refund
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500 font-mono">None</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Process Refund Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-purple-400" />
                Process Payment Refund
              </h3>
              <button
                onClick={() => setSelectedPayment(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Number:</span>
                <span className="font-mono text-white">{selectedPayment.paymentNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Original Amount:</span>
                <span className="font-semibold text-white">₹ {selectedPayment.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Max Refundable:</span>
                <span className="font-bold text-purple-400">
                  ₹ {(selectedPayment.amount - selectedPayment.refundedAmount).toFixed(2)}
                </span>
              </div>
            </div>

            <form onSubmit={handleRefundSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Refund Amount (INR) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Refund Reason / Customer Justification <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Scope cancellation as approved by technical advisor"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              {refundError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs">
                  {refundError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedPayment(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refunding}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-2"
                >
                  {refunding ? 'Processing Refund...' : 'Authorize Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
