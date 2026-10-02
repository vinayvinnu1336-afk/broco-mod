'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { ShieldAlert, Clock, User, Server } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  userEmail: string;
  entityName: string;
  entityId: string;
  details: string;
  ipAddress: string;
  timestampUtc: string;
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      const res = await apiFetch<AuditLog[]>('/admin/audit?limit=50');
      if (res.success && res.data) {
        setLogs(res.data);
      }
      setLoading(false);
    }
    loadLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Security Audit Trail</h1>
        <p className="text-xs text-navy-600 mt-1">
          Immutable ledger of authentication, authorization, role modifications, and system events.
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-navy-600">Loading audit trail...</div>
      ) : logs.length > 0 ? (
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-50 border-b border-surface-200 text-navy-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Subject</th>
                <th className="py-3.5 px-4">Details</th>
                <th className="py-3.5 px-4">Origin IP</th>
                <th className="py-3.5 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 text-navy-800">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-surface-50/50 transition">
                  <td className="py-3.5 px-4">
                    <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-surface-100 text-navy-900 border border-surface-200">
                      {l.action}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-navy-900">{l.userEmail || 'System'}</div>
                    {l.entityName && (
                      <div className="text-[10px] text-navy-600 font-mono">
                        {l.entityName}:{l.entityId?.slice(0, 6)}...
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-navy-600 max-w-xs truncate">{l.details || '—'}</td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-navy-600">
                    {l.ipAddress || '127.0.0.1'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-[11px] text-navy-600">
                    {new Date(l.timestampUtc).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-12 bg-white rounded-2xl border border-dashed border-surface-300 text-center p-8">
          <ShieldAlert className="w-12 h-12 text-navy-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-900">Audit Trail Ready</h3>
          <p className="text-xs text-navy-600 mt-1">Events will be logged in real-time as users interact with the system.</p>
        </div>
      )}
    </div>
  );
}
