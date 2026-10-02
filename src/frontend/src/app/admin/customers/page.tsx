'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Users, Shield, UserX, UserCheck, Search } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  roles: string[];
  isActive: boolean;
  createdAtUtc: string;
}

export default function AdminCustomersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const loadUsers = async () => {
    const res = await apiFetch<AdminUser[]>('/admin/users');
    if (res.success && res.data) {
      setUsers(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const toggleUserStatus = async (user: AdminUser) => {
    const newStatus = !user.isActive;
    const res = await apiFetch(`/admin/users/${user.id}/status`, {
      method: 'POST',
      body: JSON.stringify({ isActive: newStatus }),
    });
    if (res.success) {
      await loadUsers();
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.fullName.toLowerCase().includes(filter.toLowerCase()) ||
      u.email.toLowerCase().includes(filter.toLowerCase()) ||
      u.roles.some((r) => r.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">User Account Governance</h1>
          <p className="text-xs text-navy-600 mt-1">
            Manage customer, workshop operator, and advisor accounts. Suspend or restore access.
          </p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-navy-600" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9 pr-4 py-2 border border-surface-300 rounded-xl text-xs w-64 bg-white"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-navy-600">Loading user accounts...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-50 border-b border-surface-200 text-navy-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Roles</th>
                <th className="py-3.5 px-4">Contact</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 text-navy-800">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-surface-50/50 transition">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-navy-900">{u.fullName}</div>
                    <div className="text-navy-600 font-mono text-[11px]">{u.email}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <span key={r} className="px-2 py-0.5 rounded bg-surface-100 text-navy-800 font-semibold text-[10px]">
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-navy-600">
                    {u.phoneNumber || 'N/A'}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        u.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {u.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => toggleUserStatus(u)}
                      className={`px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5 ml-auto transition ${
                        u.isActive
                          ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {u.isActive ? (
                        <>
                          <UserX className="w-3.5 h-3.5" />
                          <span>Suspend</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Activate</span>
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
