'use client';

import React, { useState } from 'react';
import { BellRing, CheckCircle2, Clock } from 'lucide-react';
import { formatINR } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { FormError } from '@/components/admin/FormControls';
import { adminCatalogueApi, apiError, type Commission } from '@/components/admin/catalogueAdminApi';
import { CommissionDetails, dueText } from '@/components/commissions/CommissionDetails';
import { GarageDuesBoard } from '@/components/commissions/GarageDuesBoard';
import { announceGarageDuesChanged, garageDuesApi, isOpenDue, type GarageDue } from '@/components/commissions/garageDuesApi';

type Mode = 'view' | 'receive' | 'waive';

const METHODS = ['UPI', 'Bank transfer', 'Cash', 'Cheque'];

export default function AdminCommissionsPage() {
  const toast = useToast();
  const [reloadToken, setReloadToken] = useState(0);

  const [selected, setSelected] = useState<GarageDue | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  const [reference, setReference] = useState('');
  const [method, setMethod] = useState(METHODS[0]);
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmWaive, setConfirmWaive] = useState(false);
  const [working, setWorking] = useState(false);
  const [reminding, setReminding] = useState(false);

  const open = (c: GarageDue) => {
    setSelected(c);
    setMode('view');
    setReference('');
    setMethod(METHODS[0]);
    setReason('');
    setFieldError(null);
    setActionError(null);
  };

  const close = () => {
    if (working) return;
    setSelected(null);
  };

  const afterAction = (updated: Commission, title: string) => {
    toast.success(title, `${updated.garageName} · ${formatINR(updated.totalDue)}`);
    setSelected(null);
    setReloadToken((n) => n + 1);
    announceGarageDuesChanged();
  };

  const submitReceived = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selected) return;
    if (reference.trim().length < 2) {
      setFieldError('Enter the payment reference (UTR, UPI transaction ID or receipt number).');
      return;
    }
    setFieldError(null);
    setWorking(true);
    setActionError(null);
    const res = await adminCatalogueApi.markCommissionReceived(selected.id, { reference: reference.trim(), method });
    setWorking(false);
    if (res.success && res.data) afterAction(res.data, 'Marked as received');
    else setActionError(apiError(res, 'Could not mark this commission as received.'));
  };

  const requestWaive = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (reason.trim().length < 3) {
      setFieldError('Explain why this commission is being waived.');
      return;
    }
    setFieldError(null);
    setConfirmWaive(true);
  };

  const submitWaive = async () => {
    if (!selected) return;
    setWorking(true);
    setActionError(null);
    const res = await adminCatalogueApi.waiveCommission(selected.id, reason.trim());
    setWorking(false);
    setConfirmWaive(false);
    if (res.success && res.data) afterAction(res.data, 'Commission waived');
    else setActionError(apiError(res, 'Could not waive this commission.'));
  };

  const remindSelected = async () => {
    if (!selected) return;
    setReminding(true);
    setActionError(null);
    const res = await garageDuesApi.remind('admin', selected.id);
    setReminding(false);
    if (res.success && res.data) {
      toast.success('Reminder sent', `${selected.garageName} · ${formatINR(selected.totalDue)}`);
      setSelected(res.data.commission);
      setReloadToken((n) => n + 1);
      announceGarageDuesChanged();
    } else {
      setActionError(res.message || 'Could not send the reminder.');
    }
  };

  const remindCooldown =
    selected?.nextManualReminderAtUtc && new Date(selected.nextManualReminderAtUtc).getTime() > Date.now();

  const sheetFooter = !selected ? null : mode === 'receive' ? (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="outline" onClick={() => setMode('view')} disabled={working} className="w-full sm:w-auto">
        Back
      </Button>
      <Button type="submit" form="receive-form" isLoading={working} className="w-full sm:w-auto">
        Confirm received
      </Button>
    </div>
  ) : mode === 'waive' ? (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="outline" onClick={() => setMode('view')} disabled={working} className="w-full sm:w-auto">
        Back
      </Button>
      <Button type="submit" form="waive-form" variant="danger" className="w-full sm:w-auto">
        Waive commission
      </Button>
    </div>
  ) : isOpenDue(selected) ? (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        variant="ghost"
        onClick={() => {
          setMode('waive');
          setFieldError(null);
        }}
        className="w-full sm:w-auto"
      >
        Waive
      </Button>
      <Button
        variant="outline"
        onClick={remindSelected}
        isLoading={reminding}
        disabled={Boolean(remindCooldown)}
        leftIcon={<BellRing className="h-4 w-4" />}
        className="w-full sm:w-auto"
      >
        {remindCooldown ? 'Reminded' : 'Send reminder'}
      </Button>
      <Button
        onClick={() => {
          setMode('receive');
          setFieldError(null);
        }}
        leftIcon={<CheckCircle2 className="h-4 w-4" />}
        className="w-full sm:w-auto"
      >
        Mark received
      </Button>
    </div>
  ) : (
    <Button variant="outline" onClick={close} className="w-full sm:ml-auto sm:flex sm:w-auto">
      Close
    </Button>
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Commissions"
        description="Garages owe BroCo a commission on each job's service value after handing the car back. Chase unpaid dues and record payments."
      />

      <GarageDuesBoard portal="admin" onSelect={open} reloadToken={reloadToken} />

      {/* Detail sheet */}
      <Modal
        isOpen={Boolean(selected)}
        onClose={close}
        title={selected ? selected.garageName : ''}
        description={selected ? `${selected.commissionNumber} · Job ${selected.jobNumber}` : undefined}
        footer={sheetFooter}
      >
        {selected && (
          <div className="space-y-5">
            <FormError message={actionError} />

            {mode === 'view' && <CommissionDetails commission={selected} />}

            {mode === 'receive' && (
              <form id="receive-form" onSubmit={submitReceived} className="space-y-4" noValidate>
                <p className="text-sm text-navy-500">{dueText(selected)}</p>
                <div className="rounded-xl bg-surface-50 px-3.5 py-3 text-sm text-navy-700">
                  Record that {selected.garageName} paid <span className="font-semibold text-navy-900">{formatINR(selected.totalDue)}</span> outside
                  the app.
                </div>
                <Select label="Payment method" value={method} onChange={(e) => setMethod(e.target.value)} options={METHODS.map((m) => ({ value: m, label: m }))} />
                <Input
                  label="Payment reference"
                  required
                  autoFocus
                  placeholder="UTR, UPI transaction ID or receipt no."
                  value={reference}
                  maxLength={200}
                  onChange={(e) => setReference(e.target.value)}
                  error={fieldError ?? undefined}
                />
              </form>
            )}

            {mode === 'waive' && (
              <form id="waive-form" onSubmit={requestWaive} className="space-y-4" noValidate>
                <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Waiving cancels the {formatINR(selected.totalDue)} due. The garage will not be asked to pay it.</span>
                </div>
                <Textarea
                  label="Reason"
                  required
                  rows={3}
                  maxLength={1000}
                  placeholder="e.g. Job cancelled after inspection, goodwill for a new partner garage"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  error={fieldError ?? undefined}
                />
              </form>
            )}
          </div>
        )}
      </Modal>

      <ConfirmationDialog
        isOpen={confirmWaive}
        onClose={() => !working && setConfirmWaive(false)}
        onConfirm={submitWaive}
        isLoading={working}
        variant="danger"
        title="Waive this commission?"
        message={selected ? `${selected.garageName} will no longer owe ${formatINR(selected.totalDue)} for job ${selected.jobNumber}. This can't be undone.` : ''}
        confirmText="Waive commission"
      />
    </div>
  );
}
