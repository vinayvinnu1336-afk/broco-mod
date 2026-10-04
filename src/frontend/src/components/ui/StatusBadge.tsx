import React from 'react';
import { Badge, BadgeVariant } from './Badge';

export interface StatusBadgeProps {
  status: string | number;
  className?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const normalized = String(status).toUpperCase().trim();

  let variant: BadgeVariant = 'neutral';
  let label = String(status);

  switch (normalized) {
    // Blue / Active Lifecycle states
    case 'SUBMITTED':
    case '0':
      variant = 'blue';
      label = 'Submitted';
      break;
    case 'ASSIGNED':
    case 'GARAGE_ASSIGNED':
      variant = 'blue';
      label = 'Assigned';
      break;
    case 'WORK_STARTED':
    case 'IN_PROGRESS':
    case 'WORK_IN_PROGRESS':
    case 'ACTIVE':
    case 'SCHEDULED':
      variant = 'blue';
      label = 'Work In Progress';
      break;
    case 'VEHICLE_RECEIVED':
      variant = 'blue';
      label = 'Vehicle Received';
      break;
    case 'DISPATCHED':
      variant = 'blue';
      label = 'Dispatched';
      break;

    // Amber / Review / Pending states
    case 'PENDING':
    case 'PENDING_APPROVAL':
    case 'PENDING_PAYMENT':
    case 'UNPAID':
      variant = 'amber';
      label = 'Pending';
      break;
    case 'UNDER_REVIEW':
    case 'REVIEWING':
    case 'INSPECTION':
      variant = 'amber';
      label = normalized === 'INSPECTION' ? 'Inspection' : 'Under Review';
      break;
    case 'QUOTE_SUBMITTED':
    case 'AWAITING_CUSTOMER':
      variant = 'amber';
      label = 'Awaiting Decision';
      break;

    // Green / Approved / Completed states
    case 'APPROVED':
    case 'ACCEPTED':
    case 'BOOKING_CONFIRMED':
    case 'CONFIRMED':
    case '3':
      variant = 'green';
      label = normalized === 'BOOKING_CONFIRMED' || normalized === 'CONFIRMED' ? 'Confirmed' : 'Approved';
      break;
    case 'SERVICE_COMPLETED':
    case 'COMPLETED':
    case 'VEHICLE_READY':
    case 'READY':
    case 'HANDED_OVER':
    case 'CLOSED':
    case 'JOB_CLOSED':
    case 'PAID':
    case 'SETTLED':
    case 'VERIFIED':
      variant = 'green';
      if (normalized === 'VEHICLE_READY' || normalized === 'READY') label = 'Vehicle Ready';
      else if (normalized === 'HANDED_OVER') label = 'Handed Over';
      else if (normalized === 'PAID') label = 'Paid';
      else if (normalized === 'SETTLED') label = 'Settled';
      else label = 'Completed';
      break;

    // Red / Rejected / Cancelled states
    case 'REJECTED':
    case 'DECLINED':
      variant = 'red';
      label = 'Rejected';
      break;
    case 'CANCELLED':
    case 'VOID':
    case 'FAILED':
      variant = 'red';
      label = normalized === 'FAILED' ? 'Failed' : 'Cancelled';
      break;

    // Gray / Expired states
    case 'EXPIRED':
    case 'INACTIVE':
    case 'ARCHIVED':
      variant = 'neutral';
      label = 'Expired';
      break;

    default:
      // Format readable string for unexpected or custom states
      label = String(status)
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
      variant = 'neutral';
  }

  return (
    <Badge variant={variant} dot pill className={className}>
      {label}
    </Badge>
  );
};
