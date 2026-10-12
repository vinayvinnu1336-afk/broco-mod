'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatDate, formatDateTime, formatINR, humanize } from '@/lib/format';
import { AdvisorGarageQuoteDetailDto } from '@/types/garageQuote';
import { MapPin, Phone } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActionBar, ActionBarSpacer } from '@/components/ui/ActionBar';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';

const linkButtonPrimary =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-electric-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-electric-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-600 focus-visible:ring-offset-2';

function durationLabel(days?: number | null, hours?: number | null) {
  const parts: string[] = [];
  if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (hours) parts.push(`${hours} h`);
  return parts.length ? parts.join(' ') : 'Not given';
}

function isPast(value: string) {
  const t = new Date(value).getTime();
  return !Number.isNaN(t) && t < Date.now();
}

function Fact({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-navy-500">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium text-navy-900 ${className}`}>{children}</dd>
    </div>
  );
}

export default function AdvisorQuoteDetailPage() {
  const params = useParams();
  const quoteId = params.id as string;

  const [quote, setQuote] = useState<AdvisorGarageQuoteDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadQuote = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<AdvisorGarageQuoteDetailDto>(`/advisor/garage-quotes/${quoteId}`);
    if (res.success && res.data) {
      setQuote(res.data);
      setErrorMsg(null);
    } else {
      setErrorMsg(res.message || 'Failed to load quotation details.');
    }
    setLoading(false);
  }, [quoteId]);

  useEffect(() => {
    loadQuote();
  }, [loadQuote]);

  if (loading && !quote) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-16 w-2/3 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="space-y-5">
        <PageHeader title="Garage quote" backHref="/advisor/quotes" backLabel="Garage quotes" />
        <ErrorState title="Could not load this quote" error={errorMsg} onRetry={loadQuote} />
      </div>
    );
  }

  const currency = quote.currency || 'INR';
  const money = (n: number) => formatINR(n, currency);
  const expired = isPast(quote.validUntil);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        backHref="/advisor/quotes"
        backLabel="Garage quotes"
        eyebrow={
          <>
            <span className="font-mono text-xs font-semibold text-navy-500">{quote.quoteNumber}</span>
            <StatusBadge status={quote.status} />
          </>
        }
        title={quote.garageName}
        description={
          <>
            <span className="font-mono">{quote.serviceRequestNumber}</span> · {quote.vehicleSummary}
          </>
        }
      />

      {/* Summary */}
      <Card className="p-4 sm:p-5">
        <div className="text-xs text-navy-500">Garage total</div>
        <div className="text-3xl font-bold tabular-nums tracking-tight text-navy-900">{money(quote.totalAmount)}</div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-surface-200 pt-4 sm:grid-cols-4">
          <Fact label="Time needed">{durationLabel(quote.estimatedCompletionDays, quote.estimatedCompletionHours)}</Fact>
          <Fact label="Valid until" className={expired ? 'text-red-600' : ''}>
            {expired ? `Expired ${formatDate(quote.validUntil)}` : formatDate(quote.validUntil)}
          </Fact>
          <Fact label="Submitted">{quote.submittedAtUtc ? formatDateTime(quote.submittedAtUtc) : '—'}</Fact>
          <Fact label="Distance to customer">
            {typeof quote.garageDistanceKm === 'number' ? `${quote.garageDistanceKm.toFixed(1)} km` : '—'}
          </Fact>
        </dl>
      </Card>

      {/* Problem and garage notes */}
      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-navy-900">Customer&apos;s problem</h2>
        <p className="mt-1 whitespace-pre-wrap text-sm text-navy-700">{quote.problemSummary || 'No description given.'}</p>
        {quote.garageRemarks && (
          <>
            <h2 className="mt-4 text-base font-semibold text-navy-900">Garage&apos;s notes</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-navy-700">{quote.garageRemarks}</p>
          </>
        )}
      </Card>

      {/* Line items */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-navy-900">Line items ({quote.lineItems.length})</h2>
          <p className="text-xs text-navy-500">Garage prices. Only advisors and admins see these.</p>
        </div>

        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quote.lineItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="text-navy-900">{item.description}</div>
                    <div className="text-xs text-navy-500">{humanize(String(item.lineType))}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(item.unitPrice)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.discountAmount > 0 ? `− ${money(item.discountAmount)}` : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.taxRate}%</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{money(item.lineTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <ul className="divide-y divide-surface-200 overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-card md:hidden">
          {quote.lineItems.map((item) => (
            <li key={item.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 text-sm font-medium text-navy-900">{item.description}</span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-navy-900">{money(item.lineTotal)}</span>
              </div>
              <div className="mt-0.5 text-xs text-navy-500">
                {humanize(String(item.lineType))} · {item.quantity} × {money(item.unitPrice)}
                {item.discountAmount > 0 && <> · {money(item.discountAmount)} off</>} · {item.taxRate}% GST
              </div>
            </li>
          ))}
        </ul>

        <Card className="p-4 sm:p-5">
          <dl className="ml-auto max-w-sm space-y-2">
            <div className="flex justify-between gap-3 text-sm">
              <dt className="text-navy-500">Subtotal</dt>
              <dd className="tabular-nums text-navy-900">{money(quote.subtotal)}</dd>
            </div>
            {quote.discountAmount > 0 && (
              <div className="flex justify-between gap-3 text-sm">
                <dt className="text-navy-500">Discount</dt>
                <dd className="tabular-nums text-navy-900">− {money(quote.discountAmount)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3 text-sm">
              <dt className="text-navy-500">GST</dt>
              <dd className="tabular-nums text-navy-900">{money(quote.taxAmount)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-surface-200 pt-2">
              <dt className="text-sm font-semibold text-navy-900">Garage total</dt>
              <dd className="text-lg font-bold tabular-nums text-navy-900">{money(quote.totalAmount)}</dd>
            </div>
          </dl>
        </Card>
      </section>

      {/* Garage contact */}
      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-navy-900">Garage</h2>
        <p className="mt-1 text-sm font-medium text-navy-900">{quote.garageName}</p>
        {quote.garageAddress && (
          <p className="mt-1 flex items-start gap-2 text-sm text-navy-700">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" />
            <span>{quote.garageAddress}</span>
          </p>
        )}
        {quote.garagePhone && (
          <a
            href={`tel:${quote.garagePhone}`}
            className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-surface-300 bg-white px-4 text-sm font-semibold text-navy-800 hover:bg-surface-50 sm:w-auto"
          >
            <Phone className="h-4 w-4" />
            Call {quote.garagePhone}
          </a>
        )}
      </Card>

      {/* Earlier versions */}
      {quote.versions && quote.versions.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h2 className="text-base font-semibold text-navy-900">Versions ({quote.versions.length})</h2>
          <ul className="mt-3 divide-y divide-surface-200">
            {quote.versions.map((ver) => (
              <li key={ver.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-navy-900">Version {ver.versionNumber}</div>
                  <div className="text-xs text-navy-500">
                    {formatDateTime(ver.submittedAtUtc)} · {money(ver.subtotal)} + {money(ver.taxAmount)} GST
                    {ver.discountAmount > 0 && <> · {money(ver.discountAmount)} off</>}
                  </div>
                </div>
                <div className="shrink-0 text-sm font-semibold tabular-nums text-navy-900">{money(ver.totalAmount)}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ActionBar
        summary={
          <div className="min-w-0">
            <div className="truncate text-xs text-navy-500">Assign from request {quote.serviceRequestNumber}</div>
            <div className="text-base font-bold tabular-nums text-navy-900">{money(quote.totalAmount)}</div>
          </div>
        }
      >
        <Link href="/advisor/work-queue?stage=pending-quotes" className={linkButtonPrimary}>
          Compare quotes
        </Link>
      </ActionBar>
      <ActionBarSpacer />
    </div>
  );
}
