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
  Calendar,
  Receipt
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';

export default function GarageFinancePage() {
  const [settlements, setSettlements] = useState<GarageSettlementDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadSettlements() {
      setLoading(true);
      try {
        const res = await apiFetch<GarageSettlementDto[]>('/garage/finance/settlements');
        if (res.success && res.data) {
          setSettlements(res.data);
        }
      } catch (err) {
        console.error('Error fetching settlements:', err);
      } finally {
        setLoading(false);
      }
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy-900 tracking-tight flex items-center gap-2.5">
            <DollarSign className="w-6 h-6 text-amber-500" />
            <span>Workshop Finance & Settlement Ledger</span>
          </h1>
          <p className="text-xs text-navy-500 mt-1">
            Real-time ledger of completed jobs, platform commission deductions, and workshop net payouts.
          </p>
        </div>
      </div>

      {/* Escrow Guarantee Banner */}
      <div className="p-4 bg-white rounded-2xl border border-surface-200 shadow-card flex items-start gap-3.5">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-xs text-navy-600 leading-relaxed">
          <strong className="text-navy-900 block font-bold mb-0.5">Automated Bi-Weekly Settlement Policy</strong>
          Net payouts are calculated strictly based on agreed internal quotation rates minus contracted platform fee. Funds are disbursed automatically to your registered workshop bank account upon vehicle handover verification.
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="text-xs font-bold text-navy-400 uppercase tracking-wider">Total Gross Revenue</div>
          <div className="text-2xl font-black text-navy-900 mt-1.5">
            ₹{totalGross.toLocaleString()}
          </div>
          <span className="text-[11px] text-navy-500 font-medium">Billed to platform</span>
        </Card>

        <Card className="p-5">
          <div className="text-xs font-bold text-navy-400 uppercase tracking-wider">Platform Commission</div>
          <div className="text-2xl font-black text-navy-900 mt-1.5">
            ₹{totalPlatformFees.toLocaleString()}
          </div>
          <span className="text-[11px] text-navy-500 font-medium">Contracted platform fee</span>
        </Card>

        <Card className="p-5">
          <div className="text-xs font-bold text-navy-400 uppercase tracking-wider">Total Net Settled</div>
          <div className="text-2xl font-black text-emerald-600 mt-1.5">
            ₹{totalNetPayable.toLocaleString()}
          </div>
          <span className="text-[11px] text-emerald-700 font-medium">Disbursed to workshop</span>
        </Card>

        <Card className="p-5">
          <div className="text-xs font-bold text-navy-400 uppercase tracking-wider">In Escrow / Pending</div>
          <div className="text-2xl font-black text-amber-600 mt-1.5">
            ₹{pendingPayouts.toLocaleString()}
          </div>
          <span className="text-[11px] text-amber-700 font-medium">Pending vehicle delivery</span>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="flex justify-end">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search settlement reference..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-navy-400" />}
          />
        </div>
      </div>

      {/* Ledger Table */}
      {loading ? (
        <LoadingState message="Loading workshop financial ledger..." />
      ) : filteredSettlements.length === 0 ? (
        <EmptyState
          icon={<DollarSign className="w-7 h-7 text-navy-400" />}
          title="No Settlement Records Found"
          description={
            searchTerm
              ? 'No settlements match your search term.'
              : 'Once jobs are completed and customer payments clear escrow, itemized settlement lines will appear here.'
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Settlement Ref</TableHead>
                <TableHead>Job Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Platform Fee</TableHead>
                <TableHead className="text-right">Net Payable</TableHead>
                <TableHead className="text-right">Disbursed Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSettlements.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-mono font-bold text-navy-900 text-xs">
                      {s.settlementNumber}
                    </div>
                    {s.payoutReference && (
                      <div className="text-[11px] text-navy-400 font-mono">
                        UTR: {s.payoutReference}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-navy-600 font-semibold">
                      {s.serviceJobId ? `${s.serviceJobId.substring(0, 8)}...` : 'N/A'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={s.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-xs font-bold text-navy-700">
                      ₹{s.grossAmount.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-xs text-navy-400">
                      -₹{s.totalPlatformFee.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-black text-emerald-600">
                      ₹{s.netPayableToGarage.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-xs text-navy-500">
                      {s.payoutProcessedAtUtc ? new Date(s.payoutProcessedAtUtc).toLocaleDateString() : 'In Escrow'}
                    </span>
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
