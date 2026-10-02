'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { GarageAssignmentDto } from '@/types/customerQuotation';
import {
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  Search,
  AlertCircle,
} from 'lucide-react';

export default function AdminAssignmentsPage() {
  const [assignments, setAssignments] = useState<GarageAssignmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadAssignments() {
      setLoading(true);
      const res = await apiFetch<GarageAssignmentDto[]>('/admin/assignments');
      if (res.success && res.data) {
        setAssignments(res.data);
      }
      setLoading(false);
    }
    loadAssignments();
  }, []);

  const filtered = assignments.filter((a) => {
    const term = search.toLowerCase();
    return (
      a.requestNumber.toLowerCase().includes(term) ||
      a.garageName.toLowerCase().includes(term) ||
      a.quoteNumber.toLowerCase().includes(term) ||
      a.assignedByAdvisorName.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight">
            Workshop Assignments Audit
          </h1>
          <p className="text-xs text-navy-600 mt-1">
            Global operational audit log of all technical advisor workshop assignments across the BroCo Mod platform.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-navy-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search request, garage, advisor..."
            className="w-full text-xs pl-9 pr-3 py-2.5 bg-white border border-surface-200 rounded-xl outline-none focus:ring-2 focus:ring-navy-900"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-navy-500">Loading assignments audit...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 bg-white rounded-2xl border border-dashed border-surface-300 text-center p-8">
          <Building2 className="w-12 h-12 text-navy-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-900">No Workshop Assignments Found</h3>
          <p className="text-xs text-navy-600 mt-1">
            No active or archived workshop assignments match your search query.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-50 text-navy-600 border-b border-surface-200">
                <tr>
                  <th className="py-3 px-4">Request #</th>
                  <th className="py-3 px-4">Partner Workshop</th>
                  <th className="py-3 px-4">Winning Quote</th>
                  <th className="py-3 px-4 text-right">Quoted Amount</th>
                  <th className="py-3 px-4">Advisor</th>
                  <th className="py-3 px-4">Assigned At</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-navy-800 font-medium">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-electric-600">{a.requestNumber}</td>
                    <td className="py-3 px-4 font-bold">{a.garageName}</td>
                    <td className="py-3 px-4 font-mono">{a.quoteNumber}</td>
                    <td className="py-3 px-4 text-right font-bold text-navy-900">
                      ₹{a.quotedAmount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-navy-600">{a.assignedByAdvisorName}</td>
                    <td className="py-3 px-4 text-navy-500">
                      {new Date(a.assignedAtUtc).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          a.status === 'Assigned'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {a.status}
                      </span>
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
