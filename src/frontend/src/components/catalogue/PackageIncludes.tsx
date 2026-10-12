'use client';

import React, { useState } from 'react';
import {
  Activity,
  Check,
  ChevronDown,
  CircleDot,
  Disc3,
  Droplets,
  Gauge,
  ShieldCheck,
  Sparkles,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { groupIncludes } from '@/lib/catalogue';

const GROUP_ICONS: { match: RegExp; icon: LucideIcon; tone: string }[] = [
  { match: /fluid|filter|oil/i, icon: Droplets, tone: 'bg-sky-50 text-sky-600' },
  { match: /brake/i, icon: Disc3, tone: 'bg-rose-50 text-rose-600' },
  { match: /safety|inspection/i, icon: ShieldCheck, tone: 'bg-emerald-50 text-emerald-600' },
  { match: /health|report|scan/i, icon: Activity, tone: 'bg-violet-50 text-violet-600' },
  { match: /spa|wash|clean/i, icon: Sparkles, tone: 'bg-amber-50 text-amber-600' },
  { match: /convenience|pick|drop/i, icon: Truck, tone: 'bg-electric-50 text-electric-600' },
  { match: /performance|engine|throttle/i, icon: Gauge, tone: 'bg-orange-50 text-orange-600' },
  { match: /wheel|tyre|tire/i, icon: CircleDot, tone: 'bg-slate-100 text-slate-600' },
];

function iconFor(group: string) {
  return GROUP_ICONS.find((g) => g.match.test(group)) ?? { icon: Check, tone: 'bg-emerald-50 text-emerald-600' };
}

export interface PackageIncludesProps {
  includes: string[];
  /** On phones, show only this many groups until "Show all" is tapped (0 = show everything). */
  collapsedGroups?: number;
  /** Smaller type for dense places like the booking flow. */
  compact?: boolean;
  className?: string;
}

/** A package's checklist, grouped by section ("Fluids & Filters", "Brake Care", …). */
export function PackageIncludes({ includes, collapsedGroups = 2, compact = false, className = '' }: PackageIncludesProps) {
  const [open, setOpen] = useState(false);
  const groups = groupIncludes(includes);
  const hiddenItems = groups.slice(collapsedGroups).reduce((n, g) => n + g.items.length, 0);
  const canCollapse = collapsedGroups > 0 && groups.length > collapsedGroups;

  return (
    <div className={className}>
      <ul className={compact ? 'space-y-2.5' : 'space-y-3'}>
        {groups.map((g, i) => {
          const { icon: Icon, tone } = iconFor(g.group);
          const hiddenOnPhone = canCollapse && !open && i >= collapsedGroups;
          return (
            <li key={g.group} className={hiddenOnPhone ? 'hidden md:block' : 'block'}>
              <div className="flex items-center gap-2">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${tone}`} aria-hidden>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-navy-500">{g.group}</span>
              </div>
              <ul className={`mt-1.5 space-y-1 pl-8 ${compact ? 'text-[13px]' : 'text-sm'} text-navy-700`}>
                {g.items.map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={3} aria-hidden />
                    <span className="min-w-0">{item}</span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      {canCollapse && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          className="mt-2 inline-flex min-h-[40px] items-center gap-1 text-sm font-semibold text-electric-700 md:hidden"
        >
          {open ? 'Show less' : `Show all (+${hiddenItems} more)`}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      )}
    </div>
  );
}
