'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Ban } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, formatINR, humanize } from '@/lib/format';

/** GET /admin/requests/{id}/cancellation and the result of POST /admin/requests/{id}/cancel. */
export interface AdminBookingCancellation {
  serviceRequestId: string;
  requestNumber: string;
  requestStatus: string;
  isCancelled: boolean;
  canCancel: boolean;
  cannotCancelReason?: string | null;
  cancelledAtUtc?: string | null;
  cancellationReason?: string | null;
  serviceJobId?: string | null;
  jobNumber?: string | null;
  jobStatus?: string | null;
  garageName?: string | null;
  currency: string;
  paidOnline: number;
  refundedSoFar: number;
  refundableNow: number;
  payments: { id: string; paymentNumber: string; purpose: string; status: string; amount: number; refundedAmount: number; paidAtUtc?: string | null }[];
  commissionNumber?: string | null;
  commissionStatus?: string | null;
  commissionTotalDue?: number | null;
  refundLink: string;
}

const REASON_MAX = 500;

/**
 * Danger zone on the admin request page. Only a super admin cancels a booking once anything is paid;
 * cancelling never refunds by itself, so the admin is pointed to Payments to refund per the policy.
 */
export function CancelBookingCard({ requestId, onCancelled }: { requestId: string; onCancelled: () => void }) {
  const toast = useToast();
  const [info, setInfo] = useState<AdminBookingCancellation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch<AdminBookingCancellation>(`/admin/requests/${requestId}/cancellation`);
    if (res.success && res.data) {
      setInfo(res.data);
      setLoadError(null);
    } else {
      setLoadError(res.message || 'Could not load the cancellation details.');
    }
  }, [requestId]);

  useEffect(() => {
    load();
  }, [load]);

  async function cancelBooking() {
    setSaving(true);
    setError(null);
    const res = await apiFetch<AdminBookingCancellation>(`/admin/requests/${requestId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason.trim() }),
    });
    setSaving(false);
    if (res.success && res.data) {
      setInfo(res.data);
      setConfirmOpen(false);
      setReasonOpen(false);
      setReason('');
      toast.success('Booking cancelled', 'The customer, garage and advisor have been told.');
      onCancelled();
    } else {
      // Show the error where the admin can fix it (e.g. the reason).
      setConfirmOpen(false);
      setReasonOpen(true);
      setError(res.message || 'The booking could not be cancelled. Please try again.');
      load();
    }
  }

  if (loadError) {
    return (
      <Card className="p-4 sm:p-5">
        <Alert type="error" title="Cancellation details unavailable">
          {loadError}
        </Alert>
      </Card>
    );
  }

  if (!info) return <Skeleton className="h-28 rounded-2xl" />;

  const paid = info.paidOnline > 0;
  const money = (n: number) => formatINR(n, info.currency);
  const refundLine = paid
    ? `The customer paid ${money(info.paidOnline)} online${info.refundedSoFar > 0 ? `, ${money(info.refundedSoFar)} already refunded` : ''}.`
    : 'The customer has not paid anything online.';

  return (
    <Card className={`p-4 sm:p-5 ${info.isCancelled ? 'border-red-200' : ''}`}>
      <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-navy-900">
        <Ban className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
        {info.isCancelled ? 'Booking cancelled' : 'Cancel booking'}
      </h2>

      {info.isCancelled ? (
        <div className="space-y-2 text-sm text-navy-700">
          <p>
            Cancelled{info.cancelledAtUtc ? ` on ${formatDateTime(info.cancelledAtUtc)}` : ''}
            {info.cancellationReason ? `. Reason: ${info.cancellationReason}` : '.'}
          </p>
          <p>{refundLine}</p>
          {info.refundableNow > 0 && (
            <p>
              <Link href={info.refundLink} className="font-semibold text-electric-700 underline underline-offset-2">
                Refund {money(info.refundableNow)} in Payments
              </Link>{' '}
              as per the Cancellation &amp; Refund Policy.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-navy-600">
            Only BroCo can cancel a booking once the customer has paid. Cancelling stops the request
            {info.jobNumber ? `, job ${info.jobNumber} (${humanize(info.jobStatus)})` : ''} and any open quotation, and tells the
            customer, garage and advisor. It does not refund anything by itself.
          </p>
          {info.canCancel ? (
            <Button
              variant="danger"
              className="w-full sm:w-auto"
              onClick={() => {
                setError(null);
                setReasonOpen(true);
              }}
            >
              Cancel booking
            </Button>
          ) : (
            <Alert type="info">{info.cannotCancelReason || 'This booking can no longer be cancelled.'}</Alert>
          )}
        </div>
      )}

      <Modal
        isOpen={reasonOpen}
        onClose={() => !saving && setReasonOpen(false)}
        title={`Cancel ${info.requestNumber}?`}
        description="The reason is shown to the customer, the garage and the advisor."
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setReasonOpen(false)} disabled={saving}>
              Keep booking
            </Button>
            <Button
              variant="danger"
              className="w-full sm:w-auto"
              disabled={!reason.trim() || saving}
              onClick={() => {
                setReasonOpen(false);
                setConfirmOpen(true);
              }}
            >
              Continue
            </Button>
          </div>
        }
      >
        {error && (
          <Alert type="error" className="mb-4">
            {error}
          </Alert>
        )}
        <Textarea
          id="admin-cancel-reason"
          label="Reason for cancelling"
          rows={3}
          required
          maxLength={REASON_MAX}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Customer called support; garage can't get the part"
        />
        {info.commissionStatus === 'Due' && info.commissionTotalDue != null && (
          <p className="mt-3 text-xs text-navy-500">
            The garage&apos;s commission {info.commissionNumber} ({money(info.commissionTotalDue)}) will be waived.
          </p>
        )}
      </Modal>

      <ConfirmationDialog
        isOpen={confirmOpen}
        onClose={() => {
          if (saving) return;
          setConfirmOpen(false);
          setReasonOpen(true);
        }}
        onConfirm={cancelBooking}
        isLoading={saving}
        variant="danger"
        title={`Cancel ${info.requestNumber} for everyone?`}
        confirmText="Yes, cancel booking"
        cancelText="Go back"
        message={
          <span className="block space-y-2">
            <span className="block">{refundLine}</span>
            {paid ? (
              <span className="block">
                No refund is made automatically. After cancelling, refund {money(info.refundableNow)} or the amount the
                Cancellation &amp; Refund Policy allows from{' '}
                <Link href={info.refundLink} className="font-semibold text-electric-700 underline underline-offset-2">
                  Admin → Payments
                </Link>
                .
              </span>
            ) : (
              <span className="block">There is nothing to refund.</span>
            )}
          </span>
        }
      />
    </Card>
  );
}
