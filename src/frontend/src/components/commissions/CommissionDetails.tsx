'use client';

import React from 'react';
import { formatDate, formatDateTime, formatINR, formatRelative } from '@/lib/format';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { DetailRow } from '@/components/admin/FormControls';
import { isOpenDue, type GarageDue } from './garageDuesApi';

export function dueStatus(c: GarageDue): { label: string; variant: BadgeVariant } {
  const s = c.status.toLowerCase();
  if (s === 'paid') return { label: 'Paid', variant: 'green' };
  if (s === 'waived') return { label: 'Waived', variant: 'neutral' };
  if (c.isOverdue) return { label: 'Overdue', variant: 'red' };
  return { label: 'Due', variant: 'amber' };
}

/** "3 days overdue", "Overdue today", "Due in 18 h", "Paid 12 Oct 2026". */
export function dueText(c: GarageDue): string {
  const s = c.status.toLowerCase();
  if (s === 'paid') return c.paidAtUtc ? `Paid ${formatDate(c.paidAtUtc)}` : 'Paid';
  if (s === 'waived') return 'Waived';
  if (!c.isOverdue) {
    const hours = Math.max(1, Math.round((new Date(c.dueAtUtc).getTime() - Date.now()) / 3_600_000));
    if (hours < 24) return `Due in ${hours} h`;
    const days = Math.round(hours / 24);
    return `Due in ${days} day${days === 1 ? '' : 's'}`;
  }
  const days = c.daysOverdue ?? 0;
  return days >= 1 ? `${days} day${days === 1 ? '' : 's'} overdue` : 'Overdue today';
}

export function remindersText(c: GarageDue): string {
  if (!c.remindersSent) return 'No reminders yet';
  return `${c.remindersSent} reminder${c.remindersSent === 1 ? '' : 's'}${c.lastReminderAtUtc ? ` · last ${formatRelative(c.lastReminderAtUtc)}` : ''}`;
}

/** Garage, job, money breakdown and collection history of one commission due. */
export function CommissionDetails({ commission: c }: { commission: GarageDue }) {
  const st = dueStatus(c);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={st.variant}>{st.label}</Badge>
        {c.garageBlocked && isOpenDue(c) && <Badge variant="red">New jobs paused</Badge>}
        <span className="text-sm text-navy-500">{dueText(c)}</span>
      </div>

      <section>
        <h4 className="text-sm font-semibold text-navy-900">Garage &amp; job</h4>
        <div className="mt-1 divide-y divide-surface-200/80">
          <DetailRow label="Garage" value={c.garageName} />
          {c.garagePhone && (
            <DetailRow
              label="Phone"
              value={
                <a href={`tel:${c.garagePhone.replace(/\s+/g, '')}`} className="font-medium text-electric-600 hover:text-electric-700">
                  {c.garagePhone}
                </a>
              }
            />
          )}
          <DetailRow label="Job" value={c.jobNumber || '—'} />
          <DetailRow label="Request" value={c.requestNumber || '—'} />
          <DetailRow label="Car" value={c.vehicleSummary || '—'} />
          {c.createdAtUtc && <DetailRow label="Raised" value={formatDateTime(c.createdAtUtc)} />}
        </div>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-navy-900">Breakdown</h4>
        <div className="mt-1 divide-y divide-surface-200/80">
          <DetailRow label="Service value" value={formatINR(c.serviceValue)} />
          <DetailRow label="Advance collected by BroCo" value={formatINR(c.advanceCollectedByPlatform)} />
          <DetailRow label="Balance collected by garage" value={formatINR(c.balanceCollectedByGarage)} />
          <DetailRow label={`Commission (${Number(c.commissionPercentage)}%)`} value={formatINR(c.totalDue)} strong />
        </div>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-navy-900">Collection</h4>
        <div className="mt-1 divide-y divide-surface-200/80">
          <DetailRow label="Due date" value={formatDateTime(c.dueAtUtc)} />
          <DetailRow label="Reminders sent" value={c.remindersSent > 0 ? remindersText(c) : 'None'} />
          {c.paidAtUtc && <DetailRow label="Paid on" value={formatDateTime(c.paidAtUtc)} />}
          {c.settledVia && <DetailRow label="Settled via" value={c.settledVia} />}
          {c.paymentReference && <DetailRow label="Reference" value={c.paymentReference} />}
          {c.waiverReason && <DetailRow label="Waiver reason" value={c.waiverReason} />}
        </div>
      </section>
    </div>
  );
}
