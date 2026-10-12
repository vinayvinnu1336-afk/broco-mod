'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Inbox, Phone } from 'lucide-react';
import { formatDateTime, formatRelative, humanize } from '@/lib/format';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterChips } from '@/components/ui/FilterChips';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { ChoiceChips, DetailRow, FormError } from '@/components/admin/FormControls';
import { adminCatalogueApi, apiError, type Lead } from '@/components/admin/catalogueAdminApi';

const STATUSES = ['New', 'Contacted', 'Converted', 'Closed'] as const;
type Filter = (typeof STATUSES)[number] | 'All';

const STATUS_STYLE: Record<string, { label: string; variant: BadgeVariant }> = {
  new: { label: 'New', variant: 'blue' },
  contacted: { label: 'Contacted', variant: 'amber' },
  converted: { label: 'Converted', variant: 'green' },
  closed: { label: 'Closed', variant: 'neutral' },
};

const PAGE_SIZE = 20;

function statusStyle(status: string) {
  return STATUS_STYLE[status.toLowerCase()] ?? { label: humanize(status), variant: 'neutral' as BadgeVariant };
}

/** "+91 98765 43210" for display; the tel: link uses digits only. */
function displayMobile(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  if (ten.length !== 10) return raw;
  return `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
}

function telHref(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  return ten.length === 10 ? `tel:+91${ten}` : `tel:${digits}`;
}

function carLine(l: Lead): string {
  return [l.vehicleSummary, l.fuelType].filter(Boolean).join(' · ') || 'Car not given';
}

export default function AdminLeadsPage() {
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('New');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  const [selected, setSelected] = useState<Lead | null>(null);
  const [status, setStatus] = useState<string>('New');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async (f: Filter, p: number) => {
    const requestId = ++request.current;
    setLoading(true);
    const res = await adminCatalogueApi.leads({ status: f === 'All' ? undefined : f, page: p, pageSize: PAGE_SIZE });
    if (requestId !== request.current) return;
    if (res.success && res.data) {
      setItems(res.data.items ?? []);
      setTotalCount(res.data.totalCount ?? 0);
      setError(null);
    } else {
      setError(res.message || 'Could not load enquiries.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(filter, page);
  }, [filter, page, load]);

  const open = (lead: Lead) => {
    setSelected(lead);
    setStatus(statusStyle(lead.status).label);
    setNotes(lead.notes ?? '');
    setSaveError(null);
  };

  const close = () => {
    if (!saving) setSelected(null);
  };

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    const res = await adminCatalogueApi.updateLead(selected.id, { status, notes: notes.trim() || null });
    setSaving(false);
    if (res.success && res.data) {
      toast.success('Enquiry updated', `${displayMobile(res.data.mobileNumber)} · ${statusStyle(res.data.status).label}`);
      setSelected(null);
      load(filter, page);
    } else {
      setSaveError(apiError(res, 'Could not update this enquiry.'));
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Website enquiries"
        description="Visitors who left their mobile number and car on the website to see prices. Call them back and track the outcome."
      />

      <FilterChips
        ariaLabel="Enquiry status"
        value={filter}
        onChange={(v) => {
          setFilter(v as Filter);
          setPage(1);
        }}
        options={[...STATUSES.map((s) => ({ value: s, label: s })), { value: 'All', label: 'All' }]}
      />

      {loading && items.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[72px] rounded-2xl" />
          ))}
        </div>
      ) : error && items.length === 0 ? (
        <ErrorState title="Enquiries unavailable" error={error} onRetry={() => load(filter, page)} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={filter === 'All' ? 'No enquiries yet' : `No ${filter.toLowerCase()} enquiries`}
          description="New enquiries appear here when visitors check prices on the website."
        />
      ) : (
        <div className={`space-y-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-card divide-y divide-surface-200/80">
            {items.map((lead) => {
              const st = statusStyle(lead.status);
              return (
                <div key={lead.id} className="flex items-center gap-1 pr-2">
                  <button
                    type="button"
                    onClick={() => open(lead)}
                    className="flex min-h-[64px] min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left transition-colors hover:bg-surface-50 active:bg-surface-100"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[15px] font-semibold tabular-nums text-navy-900">{displayMobile(lead.mobileNumber)}</span>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-navy-600">{carLine(lead)}</span>
                      <span className="mt-1 block truncate text-xs text-navy-400">
                        {[lead.serviceInterest ? humanize(lead.serviceInterest) : null, lead.city, formatRelative(lead.createdAtUtc)]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      {lead.notes && <span className="mt-1 block truncate text-xs italic text-navy-500">“{lead.notes}”</span>}
                    </span>
                    <ChevronRight className="hidden h-4 w-4 shrink-0 text-surface-400 sm:block" aria-hidden="true" />
                  </button>
                  <a
                    href={telHref(lead.mobileNumber)}
                    aria-label={`Call ${displayMobile(lead.mobileNumber)}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 sm:w-auto sm:gap-1.5 sm:rounded-xl sm:px-3 sm:text-sm sm:font-semibold"
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Call</span>
                  </a>
                </div>
              );
            })}
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalCount} pageSize={PAGE_SIZE} />
        </div>
      )}

      <Modal
        isOpen={Boolean(selected)}
        onClose={close}
        title={selected ? displayMobile(selected.mobileNumber) : ''}
        description={selected ? `Enquired ${formatRelative(selected.createdAtUtc)}` : undefined}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={close} disabled={saving} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" form="lead-form" isLoading={saving} className="w-full sm:w-auto">
              Save
            </Button>
          </div>
        }
      >
        {selected && (
          <form id="lead-form" onSubmit={save} className="space-y-5" noValidate>
            <FormError message={saveError} />
            <a
              href={telHref(selected.mobileNumber)}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              Call {displayMobile(selected.mobileNumber)}
            </a>

            <div className="divide-y divide-surface-200/80">
              <DetailRow label="Car" value={selected.vehicleSummary || '—'} />
              <DetailRow label="Fuel" value={selected.fuelType || '—'} />
              <DetailRow label="Interested in" value={selected.serviceInterest ? humanize(selected.serviceInterest) : '—'} />
              <DetailRow label="City" value={selected.city || '—'} />
              <DetailRow label="Source" value={selected.source ? humanize(selected.source) : '—'} />
              <DetailRow label="Received" value={formatDateTime(selected.createdAtUtc)} />
            </div>

            <ChoiceChips
              label="Status"
              options={STATUSES.map((s) => ({ value: s, label: s }))}
              value={[status]}
              onChange={(v) => setStatus(v[0] ?? status)}
            />
            <Textarea
              label="Notes"
              rows={4}
              maxLength={2000}
              placeholder="e.g. Called, booked Standard service for Saturday"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              helperText={`${notes.length}/2000`}
            />
          </form>
        )}
      </Modal>
    </div>
  );
}
