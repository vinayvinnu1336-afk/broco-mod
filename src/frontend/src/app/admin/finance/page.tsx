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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-400" />
            Financial Control Center
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Server-authoritative financial monitoring, commission reconciliations, and workshop payouts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/payments"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
          >
            <CreditCard className="w-4 h-4 text-blue-400" />
            Manage Payments & Refunds
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Gross Platform GMV
          </span>
          <div className="text-2xl font-bold text-white mt-1">
            ₹ {overview?.totalGrossRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {overview?.totalPaymentsCount || 0} Total customer payments
          </p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            Platform Net Revenue
          </span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            ₹ {overview?.totalPlatformRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </div>
          <p className="text-xs text-slate-500 mt-1">Commission fee earnings + GST</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
            Disbursed Payouts
          </span>
          <div className="text-2xl font-bold text-blue-400 mt-1">
            ₹ {overview?.totalGaragePayouts.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {overview?.completedSettlementsCount || 0} Settled to workshops
          </p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
            Escrow / Pending Payouts
          </span>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            ₹ {overview?.pendingGarageSettlements.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </div>
          <p className="text-xs text-slate-500 mt-1">Currently held in escrow</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-800 flex gap-6">
        <button
          onClick={() => setActiveTab('settlements')}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'settlements'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Workshop Settlements ({settlements.length})
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'ledger'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Double-Entry Ledger Audit Trail ({ledgerEntries.length})
        </button>
      </div>

      {/* Tab: Settlements */}
      {activeTab === 'settlements' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search settlements by ref, workshop name..."
                value={settlementSearch}
                onChange={(e) => setSettlementSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Settlement Ref</th>
                    <th className="px-6 py-4 font-semibold">Workshop</th>
                    <th className="px-6 py-4 font-semibold">Gross Billed</th>
                    <th className="px-6 py-4 font-semibold">Platform Fee + GST</th>
                    <th className="px-6 py-4 font-semibold">Net Payout</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredSettlements.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white font-mono">{s.settlementNumber}</div>
                        {s.payoutReference && (
                          <div className="text-xs text-slate-400 font-mono mt-0.5">
                            Bank Ref: {s.payoutReference}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-white font-medium">{s.garageName}</td>
                      <td className="px-6 py-4 text-slate-200">
                        ₹ {s.grossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-slate-300 text-xs">
                        ₹ {s.totalPlatformFee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        <div className="text-[11px] text-slate-500">
                          (₹{s.platformFeeAmount.toFixed(2)} + ₹{s.platformFeeGstAmount.toFixed(2)} GST)
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-emerald-400">
                        ₹ {s.netPayableToGarage.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4">
                        {s.status === 'Completed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="w-3.5 h-3.5" />
                            {s.status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {s.status !== 'Completed' ? (
                          <button
                            onClick={() => {
                              setSelectedSettlement(s);
                              setPayoutRef(`BANK-PAYOUT-${Date.now()}`);
                              setCompleteError(null);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Disburse Payout
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500 font-mono">Disbursed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Ledger Explorer */}
      {activeTab === 'ledger' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 font-semibold">Entry Ref</th>
                  <th className="px-6 py-4 font-semibold">Account</th>
                  <th className="px-6 py-4 font-semibold">Entry Type</th>
                  <th className="px-6 py-4 font-semibold">Direction</th>
                  <th className="px-6 py-4 font-semibold">Amount</th>
                  <th className="px-6 py-4 font-semibold">Description</th>
                  <th className="px-6 py-4 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {ledgerEntries.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-white">{l.entryNumber}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-slate-800 text-slate-300">
                        {l.accountType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-300">{l.entryType}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-bold ${
                          l.direction === 'Credit' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {l.direction.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-semibold text-white">
                      ₹ {l.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400 max-w-xs truncate">
                      {l.description}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(l.createdAtUtc).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Disburse Payout Modal */}
      {selectedSettlement && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Disburse Workshop Settlement
              </h3>
              <button
                onClick={() => setSelectedSettlement(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-500">Workshop:</span>
                <span className="font-semibold text-white">{selectedSettlement.garageName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Settlement Ref:</span>
                <span className="font-mono text-white">{selectedSettlement.settlementNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Net Payable Amount:</span>
                <span className="font-bold text-emerald-400 text-sm">
                  ₹ {selectedSettlement.netPayableToGarage.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <form onSubmit={handleCompletePayout} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Bank / IMPS / UTR Transfer Reference <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={payoutRef}
                  onChange={(e) => setPayoutRef(e.target.value)}
                  placeholder="e.g. UTR-98234823498"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              {completeError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs">
                  {completeError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedSettlement(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={completing}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-2"
                >
                  {completing ? 'Confirming...' : 'Confirm Disbursed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
