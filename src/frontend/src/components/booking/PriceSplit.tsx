import React from 'react';
import { ShieldCheck, Store } from 'lucide-react';
import { formatINRWhole } from '@/lib/format';

export interface PriceSplitProps {
  /** Package price or accepted quote total. */
  total: number;
  /** Paid online to BroCo to confirm the booking. */
  advance: number;
  /** Paid directly at the garage after the service. */
  atGarage: number;
  percent?: number;
  totalLabel?: string;
  /** Marks the online part as already paid. */
  advancePaid?: boolean;
  className?: string;
}

/** "Package price ₹X · Pay now (10%) ₹A · Pay at garage ₹B" as a small receipt. */
export const PriceSplit: React.FC<PriceSplitProps> = ({
  total,
  advance,
  atGarage,
  percent = 10,
  totalLabel = 'Package price',
  advancePaid = false,
  className = '',
}) => (
  <dl className={`divide-y divide-surface-200 rounded-xl border border-surface-200 bg-white px-3.5 text-sm ${className}`}>
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-navy-500">{totalLabel}</dt>
      <dd className="font-semibold tabular-nums text-navy-900">{formatINRWhole(total)}</dd>
    </div>
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-navy-800">
        <ShieldCheck className="h-4 w-4 shrink-0 text-electric-600" />
        {advancePaid ? `Paid online (${percent}%)` : `Pay now (${percent}%)`}
      </dt>
      <dd className={`font-bold tabular-nums ${advancePaid ? 'text-emerald-700' : 'text-electric-700'}`}>
        {formatINRWhole(advance)}
      </dd>
    </div>
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-navy-800">
        <Store className="h-4 w-4 shrink-0 text-navy-400" />
        Pay at garage after service
      </dt>
      <dd className="font-semibold tabular-nums text-navy-900">{formatINRWhole(atGarage)}</dd>
    </div>
  </dl>
);

/** One-paragraph explanation of how paying works on BroCo. */
export const PaymentModelNote: React.FC<{ className?: string; quoteBased?: boolean }> = ({ className = '', quoteBased = false }) => (
  <p className={`text-xs leading-relaxed text-navy-500 ${className}`}>
    {quoteBased
      ? 'Verified garages near you send quotes. You accept the one you like, pay 10% online to BroCo to confirm the booking, and pay the remaining 90% directly at the garage after the service.'
      : 'You pay 10% online to BroCo to confirm the booking. The remaining 90% is paid directly at the garage after the service — no surprises, the package price is fixed.'}
  </p>
);
