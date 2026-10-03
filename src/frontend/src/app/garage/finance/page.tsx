'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { GarageSettlementDto } from '@/types/finance';
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  ArrowRight,
  ShieldCheck,
  Building2,
  Calendar
} from 'lucide-react';

export default function GarageFinancePage() {
  const [settlements, setSettlements] = useState<GarageSettlementDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadSettlements() {
      setLoading(true);
      const res = await apiFetch<GarageSettlementDto[]>('/garage/finance/settlements');
      if (res.success && res.data) {
        setSettlements(res.data);
      }
      setLoading(false);
    }
    loadSettlements();
  }, []);

  const totalGross = settlements.reduce((sum, s) => sum + s.grossAmount, 0);
  const totalPlatformFees = settlements.reduce((sum, s) => sum + s.totalPlatformFee, 0);
  const totalNetPayable = settlements.reduce((sum, s) => sum + s.netPayableToGarage, 0);
  const pendingPayouts = settlements
    .filter((s) => s.status === 'Pending' || s.status === 'Processing')
    .reduce((sum, s) => sum + s.netPayableToGarage, 0);

  const filteredSettlements = settlements.filter(
    (s) =>
      s.settlementNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.payoutReference && s.payoutReference.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Paid Out
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" />
            Escrow / Pending Payout
          </span>
        );
      case 'Processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <TrendingUp className="w-3.5 h-3.5" />
            Processing
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
            <DollarSign className="w-6 h-6 text-amber-400" />
            Workshop Finance & Settlements
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time ledger of customer payments, platform commission deductions, and workshop net payouts
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Total Billed Gross
          </span>
          <div className="text-2xl font-bold text-white mt-1">
            ₹ {totalGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-500 mt-1">Across all verified customer payments</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Platform Fees (incl. GST)
          </span>
          <div className="text-2xl font-bold text-slate-300 mt-1">
            ₹ {totalPlatformFees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-500 mt-1">10% Platform commission + 18% GST</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
            Net Workshop Earnings
          </span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            ₹ {totalNetPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-500 mt-1">Total credited to your account</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">
            Pending Payouts
          </span>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            ₹ {pendingPayouts.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-500 mt-1">Awaiting scheduled disbursement</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search settlements by settlement number, payout ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
      </div>

      {/* Settlements Table */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
        </div>
      ) : filteredSettlements.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 rounded-xl border border-slate-800">
          <DollarSign className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-white">No settlements found</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? 'No settlements match your search query.'
              : 'When customers complete payments for your service jobs, the settlement ledger entries will appear here.'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 font-semibold">Settlement Ref</th>
                  <th className="px-6 py-4 font-semibold">Gross Billed</th>
                  <th className="px-6 py-4 font-semibold">Platform Fee (10%)</th>
                  <th className="px-6 py-4 font-semibold">GST on Fee (18%)</th>
                  <th className="px-6 py-4 font-semibold">Net Payout</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Received Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSettlements.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white font-mono">{s.settlementNumber}</div>
                      {s.payoutReference && (
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          Ref: {s.payoutReference}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-white">
                      ₹ {s.grossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      ₹ {s.platformFeeAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">
                      ₹ {s.platformFeeGstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-emerald-400">
                        ₹ {s.netPayableToGarage.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(s.status)}</td>
                    <td className="px-6 py-4 text-slate-400 text-xs">
                      {new Date(s.paymentReceivedAtUtc).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
