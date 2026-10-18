'use client';

import React, { useEffect, useState } from 'react';
import { Percent } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { formatINRWhole } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

interface CommissionTerms {
  commissionPercentage: number;
  bookingAdvancePercentage: number;
}

/** Garage commission %, editable by the super admin. Applies to jobs handed over from now on. */
export function CommissionTermsCard() {
  const toast = useToast();
  const [terms, setTerms] = useState<CommissionTerms | null>(null);
  const [commission, setCommission] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<CommissionTerms>('/admin/settings/commission').then((res) => {
      if (res.success && res.data) {
        setTerms(res.data);
        setCommission(String(res.data.commissionPercentage));
      } else {
        setError(res.message || 'Could not load commission terms.');
      }
    });
  }, []);

  const c = Number(commission);
  const valid = commission !== '' && c >= 0 && c <= 50;
  const changed = terms && c !== terms.commissionPercentage;
  const example = 5000;
  const exampleCommission = (example * (valid ? c : 0)) / 100;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    const res = await apiFetch<CommissionTerms>('/admin/settings/commission', {
      method: 'PUT',
      body: JSON.stringify({ commissionPercentage: c }),
    });
    setSaving(false);
    if (res.success && res.data) {
      setTerms(res.data);
      toast.success('Commission terms saved');
    } else {
      toast.error(res.message || 'Could not save');
    }
  };

  return (
    <section className="rounded-2xl border border-surface-200 bg-white p-4 shadow-card sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-electric-50 text-electric-600">
          <Percent className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-navy-900">BroCo commission (charged to garages)</h2>
          <p className="mt-0.5 text-sm text-surface-500">
            Billed to the garage after each handover, on the full service value. New rates apply to jobs handed over from now on.
            {terms ? ` Customers pay ${terms.bookingAdvancePercentage}% online when booking.` : ''}
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg bg-semantic-errorBg px-3 py-2 text-sm text-semantic-error">{error}</p>
      ) : (
        <>
          <div className="mt-4 sm:max-w-xs">
            <Input
              label="Commission %"
              type="number"
              inputMode="decimal"
              min={0}
              max={50}
              step="0.5"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              disabled={!terms}
            />
          </div>
          <p className="mt-3 text-sm text-surface-500">
            Example: a {formatINRWhole(example)} service → garage pays{' '}
            <span className="font-semibold text-navy-900">{formatINRWhole(exampleCommission)}</span>
          </p>
          {!valid && terms && <p className="mt-1 text-sm text-semantic-error">Commission must be 0–50%.</p>}
          <div className="mt-4 flex justify-end">
            <Button onClick={save} disabled={!valid || !changed || saving} isLoading={saving}>
              Save
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
