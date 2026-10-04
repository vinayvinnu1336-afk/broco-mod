'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { 
  FinanceOverviewDto, 
  GarageSettlementDto, 
  FinancialLedgerEntryDto 
} from '@/types/finance';
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw, 
  CreditCard, 
  Building2, 
  Search, 
  Filter, 
  FileText, 
  Check, 
  X,
  ExternalLink
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';

export default function AdminFinanceControlPage() {
  const [overview, setOverview] = useState<FinanceOverviewDto | null>(null);
  const [settlements, setSettlements] = useState<GarageSettlementDto[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<FinancialLedgerEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'settlements' | 'ledger'>('settlements');

  // Complete Payout Modal State
  const [selectedSettlement, setSelectedSettlement] = useState<GarageSettlementDto | null>(null);
  const [payoutRef, setPayoutRef] = useState('');
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // Settlement Search
  const [settlementSearch, setSettlementSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    const [ovRes, setRes, ledRes] = await Promise.all([
      apiFetch<FinanceOverviewDto>('/admin/finance/overview'),
      apiFetch<GarageSettlementDto[]>('/admin/finance/settlements'),
      apiFetch<FinancialLedgerEntryDto[]>('/admin/finance/ledger?limit=100'),
    ]);

    if (ovRes.success && ovRes.data) setOverview(ovRes.data);
    if (setRes.success && setRes.data) setSettlements(setRes.data);
    if (ledRes.success && ledRes.data) setLedgerEntries(ledRes.data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCompletePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSettlement) return;
    if (!payoutRef.trim()) {
      setCompleteError('Bank/IMPS payout transaction reference is required.');
      return;
    }

    setCompleting(true);
    setCompleteError(null);

    const res = await apiFetch<GarageSettlementDto>(
      `/admin/finance/settlements/${selectedSettlement.id}/complete`,
      {
        method: 'POST',
        body: JSON.stringify({ payoutReference: payoutRef.trim() }),
      }
    );

    setCompleting(false);

    if (res.success && res.data) {
      setSelectedSettlement(null);
      setPayoutRef('');
      loadData();
    } else {
      setCompleteError(res.message || 'Failed to complete settlement payout.');
    }
  };

  const filteredSettlements = settlements.filter(
    (s) =>
      s.settlementNumber.toLowerCase().includes(settlementSearch.toLowerCase()) ||
      s.garageName.toLowerCase().includes(settlementSearch.toLowerCase()) ||
      (s.payoutReference && s.payoutReference.toLowerCase().includes(settlementSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-600" />
            Financial Control Center
          </h1>
          <p className="text-sm text-navy-600 mt-1">
            Server-authoritative financial monitoring, commission reconciliations, and workshop payouts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/payments">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<CreditCard className="w-4 h-4 text-electric-600" />}
            >
              Manage Payments & Refunds
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">
            Gross Platform GMV
          </span>
          <div className="text-2xl font-black text-navy-900 mt-1 font-mono">
            ₹{overview?.totalGrossRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </div>
          <p className="text-xs text-navy-500 mt-1">
            <strong className="text-navy-800">{overview?.totalPaymentsCount || 0}</strong> total customer payments
          </p>
        </Card>

        <Card className="p-5">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
            Platform Net Revenue
          </span>
          <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
            ₹{overview?.totalPlatformRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </div>
          <p className="text-xs text-navy-500 mt-1">Commission fee earnings + GST</p>
        </Card>

        <Card className="p-5">
          <span className="text-xs font-bold text-electric-700 uppercase tracking-wider">
            Disbursed Payouts
          </span>
          <div className="text-2xl font-black text-electric-700 mt-1 font-mono">
            ₹{overview?.totalGaragePayouts.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </div>
          <p className="text-xs text-navy-500 mt-1">
            <strong className="text-navy-800">{overview?.completedSettlementsCount || 0}</strong> settled to workshops
          </p>
        </Card>

        <Card className="p-5">
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
            Escrow / Pending Payouts
          </span>
          <div className="text-2xl font-black text-amber-700 mt-1 font-mono">
            ₹{overview?.pendingGarageSettlements.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </div>
          <p className="text-xs text-navy-500 mt-1">Currently held in escrow</p>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-surface-200 flex gap-6">
        <button
          onClick={() => setActiveTab('settlements')}
          className={`pb-3 text-sm font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'settlements'
              ? 'text-emerald-700 border-b-2 border-emerald-600'
              : 'text-navy-500 hover:text-navy-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Workshop Settlements ({settlements.length})
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`pb-3 text-sm font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'ledger'
              ? 'text-emerald-700 border-b-2 border-emerald-600'
              : 'text-navy-500 hover:text-navy-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          Double-Entry Ledger Audit Trail ({ledgerEntries.length})
        </button>
      </div>

      {/* Tab: Settlements */}
      {activeTab === 'settlements' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-surface-200 shadow-sm">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400" />
              <input
                type="text"
                placeholder="Search settlements by ref, workshop name..."
                value={settlementSearch}
                onChange={(e) => setSettlementSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface-50 border border-surface-200 rounded-xl text-sm text-navy-900 placeholder-navy-400 focus:outline-none focus:border-navy-900 transition-colors"
              />
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-50 border-b border-surface-200 text-navy-500 uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4 font-bold">Settlement Ref</th>
                    <th className="px-6 py-4 font-bold">Workshop</th>
                    <th className="px-6 py-4 font-bold">Gross Billed</th>
                    <th className="px-6 py-4 font-bold">Platform Fee + GST</th>
                    <th className="px-6 py-4 font-bold">Net Payout</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {filteredSettlements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-xs text-navy-500">
                        No workshop settlements match the search filter.
                      </td>
                    </tr>
                  ) : (
                    filteredSettlements.map((s) => (
                      <tr key={s.id} className="hover:bg-surface-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-navy-900 font-mono text-xs">{s.settlementNumber}</div>
                          {s.payoutReference && (
                            <div className="text-[11px] text-navy-500 font-mono mt-0.5">
                              Bank Ref: {s.payoutReference}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-navy-900 font-semibold">{s.garageName}</td>
                        <td className="px-6 py-4 text-navy-700 font-mono">
                          ₹{s.grossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-navy-700 text-xs font-mono">
                          ₹{s.totalPlatformFee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          <div className="text-[10px] text-navy-500">
                            (₹{s.platformFeeAmount.toFixed(2)} + ₹{s.platformFeeGstAmount.toFixed(2)} GST)
                          </div>
                        </td>
                        <td className="px-6 py-4 font-bold text-emerald-700 font-mono">
                          ₹{s.netPayableToGarage.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          {s.status !== 'Completed' ? (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => {
                                setSelectedSettlement(s);
                                setPayoutRef(`BANK-PAYOUT-${Date.now()}`);
                                setCompleteError(null);
                              }}
                              leftIcon={<Check className="w-3.5 h-3.5" />}
                            >
                              Disburse Payout
                            </Button>
                          ) : (
                            <span className="text-xs text-navy-400 font-mono">Disbursed</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Ledger Explorer */}
      {activeTab === 'ledger' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-50 border-b border-surface-200 text-navy-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 font-bold">Entry Ref</th>
                  <th className="px-6 py-4 font-bold">Account</th>
                  <th className="px-6 py-4 font-bold">Entry Type</th>
                  <th className="px-6 py-4 font-bold">Direction</th>
                  <th className="px-6 py-4 font-bold">Amount</th>
                  <th className="px-6 py-4 font-bold">Description</th>
                  <th className="px-6 py-4 font-bold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {ledgerEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-xs text-navy-500">
                      No ledger entries recorded yet.
                    </td>
                  </tr>
                ) : (
                  ledgerEntries.map((l) => (
                    <tr key={l.id} className="hover:bg-surface-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-navy-900">{l.entryNumber}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-surface-100 text-navy-800 border border-surface-200">
                          {l.accountType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-navy-700">{l.entryType}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-bold ${
                            l.direction === 'Credit' ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {l.direction.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-navy-900">
                        ₹{l.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-xs text-navy-600 max-w-xs truncate">
                        {l.description}
                      </td>
                      <td className="px-6 py-4 text-xs text-navy-500">
                        {new Date(l.createdAtUtc).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Disburse Payout Modal */}
      {selectedSettlement && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-surface-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-surface-100 pb-3">
              <h3 className="text-lg font-bold text-navy-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Disburse Workshop Settlement
              </h3>
              <button
                onClick={() => setSelectedSettlement(null)}
                className="text-navy-400 hover:text-navy-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-navy-700 space-y-2 bg-surface-50 p-4 rounded-xl border border-surface-200">
              <div className="flex justify-between">
                <span className="text-navy-500">Workshop:</span>
                <span className="font-bold text-navy-900">{selectedSettlement.garageName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy-500">Settlement Ref:</span>
                <span className="font-mono font-bold text-navy-900">{selectedSettlement.settlementNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy-500">Net Payable Amount:</span>
                <span className="font-black text-emerald-700 text-sm font-mono">
                  ₹{selectedSettlement.netPayableToGarage.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <form onSubmit={handleCompletePayout} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-navy-800 mb-1.5">
                  Bank / IMPS / UTR Transfer Reference <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={payoutRef}
                  onChange={(e) => setPayoutRef(e.target.value)}
                  placeholder="e.g. UTR-98234823498"
                  className="w-full px-3.5 py-2.5 bg-white border border-surface-200 rounded-xl text-sm text-navy-900 placeholder-navy-400 focus:outline-none focus:border-navy-900"
                  required
                />
              </div>

              {completeError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                  {completeError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedSettlement(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={completing}
                >
                  Confirm Disbursed
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
