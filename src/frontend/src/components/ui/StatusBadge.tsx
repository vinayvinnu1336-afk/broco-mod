import React from 'react';
import { Badge, BadgeVariant } from './Badge';

export interface StatusBadgeProps {
  status: string | number;
  className?: string;
  size?: 'sm' | 'md';
}

type StatusStyle = [BadgeVariant, string];

// Keys are UPPER_SNAKE. Covers every status enum the API returns (service requests, garage requests,
// quotes, customer quotations, assignments, jobs, payments, invoices, settlements, garages).
const STATUS_MAP: Record<string, StatusStyle> = {
  // Service request lifecycle
  NEW: ['blue', 'Submitted'],
  SUBMITTED: ['blue', 'Submitted'],
  ASSIGNED_TO_ADVISOR: ['blue', 'With advisor'],
  ADVISOR_REVIEW: ['amber', 'Advisor review'],
  UNDER_REVIEW: ['amber', 'Under review'],
  REVIEWING: ['amber', 'Under review'],
  GARAGE_MATCHING: ['blue', 'Finding garages'],
  GARAGES_NOTIFIED: ['blue', 'Garages notified'],
  DISPATCHED: ['blue', 'Garages notified'],
  QUOTES_RECEIVED: ['amber', 'Quotes received'],
  GARAGE_SELECTED: ['blue', 'Garage selected'],
  CUSTOMER_QUOTATION_SENT: ['amber', 'Quote ready'],
  AWAITING_CUSTOMER: ['amber', 'Awaiting customer'],
  QUOTATION_ACCEPTED: ['green', 'Quote accepted'],
  QUOTATION_REJECTED: ['red', 'Quote declined'],
  CUSTOMER_ACCEPTED: ['green', 'Accepted'],
  CUSTOMER_REJECTED: ['red', 'Declined'],
  BOOKING_CONFIRMED: ['green', 'Booking confirmed'],
  CONFIRMED: ['green', 'Confirmed'],
  IN_PROGRESS: ['blue', 'In progress'],
  COMPLETED: ['green', 'Completed'],
  CANCELLED: ['red', 'Cancelled'],

  // Garage request (dispatch)
  PENDING: ['amber', 'Pending'],
  NOTIFIED: ['blue', 'New'],
  VIEWED: ['neutral', 'Viewed'],
  ACCEPTED: ['green', 'Accepted'],
  DECLINED: ['red', 'Declined'],
  EXPIRED: ['neutral', 'Expired'],

  // Garage quotes
  DRAFT: ['neutral', 'Draft'],
  QUOTE_SUBMITTED: ['amber', 'Submitted'],
  SELECTED_BY_ADVISOR: ['green', 'Selected'],
  REJECTED_BY_ADVISOR: ['red', 'Not selected'],
  ACCEPTED_BY_CUSTOMER: ['green', 'Won'],
  REJECTED_BY_CUSTOMER: ['red', 'Customer declined'],
  WITHDRAWN: ['neutral', 'Withdrawn'],

  // Customer quotations
  READY_TO_SEND: ['amber', 'Ready to send'],
  SENT: ['blue', 'Sent'],
  REJECTED: ['red', 'Declined'],

  // Assignments
  ASSIGNED: ['blue', 'Assigned'],
  GARAGE_ASSIGNED: ['blue', 'Assigned'],
  REASSIGNED: ['neutral', 'Reassigned'],

  // Service jobs
  SCHEDULED: ['blue', 'Scheduled'],
  VEHICLE_RECEIVED: ['blue', 'Car received'],
  INSPECTION: ['amber', 'Inspection'],
  WORK_STARTED: ['blue', 'Work started'],
  WORK_IN_PROGRESS: ['blue', 'Work in progress'],
  WORK_COMPLETED: ['green', 'Work completed'],
  VEHICLE_READY: ['green', 'Ready for handover'],
  READY: ['green', 'Ready for handover'],
  HANDED_OVER: ['green', 'Handed over'],
  PAYMENT_RECEIVED: ['green', 'Payment received'],
  CLOSED: ['neutral', 'Closed'],
  JOB_CLOSED: ['neutral', 'Closed'],
  SERVICE_COMPLETED: ['green', 'Completed'],
  ACTIVE: ['blue', 'Active'],

  // Payments, invoices, settlements
  CREATED: ['neutral', 'Created'],
  PROCESSING: ['amber', 'Processing'],
  PENDING_PAYMENT: ['amber', 'Payment due'],
  UNPAID: ['amber', 'Unpaid'],
  PAID: ['green', 'Paid'],
  FAILED: ['red', 'Failed'],
  REFUND_PENDING: ['amber', 'Refund pending'],
  PARTIALLY_REFUNDED: ['amber', 'Part refunded'],
  REFUNDED: ['neutral', 'Refunded'],
  ISSUED: ['blue', 'Issued'],
  VOID: ['neutral', 'Void'],
  ON_HOLD: ['amber', 'On hold'],
  SETTLED: ['green', 'Settled'],

  // Additional work
  PENDING_ADVISOR_REVIEW: ['amber', 'Awaiting advisor'],
  APPROVED: ['green', 'Approved'],
  PENDING_APPROVAL: ['amber', 'Awaiting approval'],

  // Garages / accounts
  PENDING_VERIFICATION: ['amber', 'Pending verification'],
  VERIFIED: ['green', 'Verified'],
  SUSPENDED: ['red', 'Suspended'],
  INACTIVE: ['neutral', 'Inactive'],
  ARCHIVED: ['neutral', 'Archived'],
};

function normalise(status: string | number): string {
  // API enums arrive as PascalCase ("GaragesNotified"); legacy values as UPPER_SNAKE. Normalise both.
  return String(status)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toUpperCase();
}

export function statusLabel(status: string | number): string {
  const key = normalise(status);
  if (STATUS_MAP[key]) return STATUS_MAP[key][1];
  const words = key.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const key = normalise(status);
  const [variant, label] = STATUS_MAP[key] ?? ['neutral', statusLabel(status)];

  return (
    <Badge variant={variant} dot pill className={`whitespace-nowrap ${className}`}>
      {label}
    </Badge>
  );
};
