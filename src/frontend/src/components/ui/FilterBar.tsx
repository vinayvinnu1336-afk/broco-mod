'use client';

import React, { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from './Button';
import { FilterChipOption, FilterChips } from './FilterChips';
import { Input } from './Input';
import { Modal } from './Modal';
import { Select } from './Select';
import { DATE_RANGE_OPTIONS, dateRangeError, UrlFilters } from '@/lib/useUrlFilters';

export interface FilterSelectField<K extends string> {
  type: 'select';
  key: K;
  /** Visible label in the phone sheet, and the accessible name inline. */
  label: string;
  options: { value: string; label: string }[];
  /** First option meaning "no filter" (value ''), e.g. "All garages". Defaults to "All". */
  allLabel?: string;
}

export interface FilterDateRangeField<K extends string> {
  type: 'dateRange';
  /** e.g. "Created", "Paid on". Defaults to "Date". */
  label?: string;
  /** URL keys; default `range`, `from`, `to`. */
  keys?: { range: K; from: K; to: K };
}

export type FilterField<K extends string> = FilterSelectField<K> | FilterDateRangeField<K>;

export interface FilterBarProps<K extends string> {
  filters: UrlFilters<K>;
  /** URL key of the search box (always visible). */
  searchKey?: K;
  searchPlaceholder?: string;
  searchLabel?: string;
  /** Status chips, always visible (use a select field instead when there are many statuses). */
  status?: { key: K; options: FilterChipOption[]; ariaLabel?: string };
  /** Secondary filters: inline from `md` up, in a "Filters" sheet on phones. */
  fields?: FilterField<K>[];
  /** Left of the results line, e.g. "24 requests". */
  summary?: ReactNode;
  /** Right of the results line, before "Clear filters", e.g. a per-page select. */
  trailing?: ReactNode;
  className?: string;
}

const SEARCH_DELAY_MS = 400;
// Inline selects that hold a filter get a blue outline so it is clear what is narrowing the list.
const ACTIVE_SELECT = '!border-electric-600 !bg-electric-50/40 font-medium';

function rangeKeys<K extends string>(field: FilterDateRangeField<K>) {
  return field.keys ?? ({ range: 'range', from: 'from', to: 'to' } as { range: K; from: K; to: K });
}

function fieldKeys<K extends string>(field: FilterField<K>): K[] {
  if (field.type === 'select') return [field.key];
  const k = rangeKeys(field);
  return [k.range, k.from, k.to];
}

/**
 * The one filter bar for staff list screens: search box, optional status chips, and secondary filters
 * (selects and a date range). Values live in the URL through `useUrlFilters`.
 */
export function FilterBar<K extends string>({
  filters,
  searchKey,
  searchPlaceholder = 'Search',
  searchLabel,
  status,
  fields = [],
  summary,
  trailing,
  className = '',
}: FilterBarProps<K>) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { values, set, reset, isActive } = filters;

  const fieldActive = (field: FilterField<K>) => (field.type === 'select' ? isActive(field.key) : isActive(rangeKeys(field).range));
  const sheetCount = fields.filter(fieldActive).length;
  const activeCount =
    sheetCount + (searchKey && values[searchKey].trim() ? 1 : 0) + (status && isActive(status.key) ? 1 : 0);

  const clearAll = () => {
    const keys: K[] = [];
    if (searchKey) keys.push(searchKey);
    if (status) keys.push(status.key);
    fields.forEach((f) => keys.push(...fieldKeys(f)));
    reset(keys);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap items-start gap-2">
        {searchKey && (
          <SearchBox
            value={values[searchKey]}
            onCommit={(v) => set({ [searchKey]: v } as Partial<Record<K, string>>)}
            placeholder={searchPlaceholder}
            label={searchLabel ?? searchPlaceholder}
          />
        )}

        {fields.length > 0 && (
          <>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 md:hidden"
              onClick={() => setSheetOpen(true)}
              leftIcon={<SlidersHorizontal className="h-4 w-4" />}
              aria-label={sheetCount ? `Filters, ${sheetCount} on` : 'Filters'}
            >
              Filters
              {sheetCount > 0 && (
                <span className="ml-0.5 rounded-full bg-electric-600 px-1.5 text-xs font-semibold text-white">{sheetCount}</span>
              )}
            </Button>
            <div className="hidden min-w-0 flex-wrap items-start gap-2 md:flex">
              {fields.map((field, i) => (
                <FieldControl key={i} field={field} filters={filters} inline />
              ))}
            </div>
          </>
        )}
      </div>

      {status && (
        <FilterChips
          options={status.options}
          value={values[status.key]}
          onChange={(v) => set({ [status.key]: v } as Partial<Record<K, string>>)}
          ariaLabel={status.ariaLabel ?? 'Filter by status'}
        />
      )}

      {(summary || trailing || activeCount > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-navy-500">
          <span className="min-w-0">{summary}</span>
          <div className="flex items-center gap-3">
            {trailing}
            {activeCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex min-h-[32px] items-center gap-1 rounded-lg px-1.5 font-semibold text-electric-700 hover:bg-electric-50"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Clear filters ({activeCount})
              </button>
            )}
          </div>
        </div>
      )}

      {fields.length > 0 && (
        <Modal
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Filters"
          size="sm"
          footer={
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={sheetCount === 0}
                onClick={() => reset(fields.flatMap(fieldKeys))}
              >
                Clear
              </Button>
              <Button type="button" className="flex-1" onClick={() => setSheetOpen(false)}>
                Show results
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {fields.map((field, i) => (
              <FieldControl key={i} field={field} filters={filters} />
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function SearchBox({
  value,
  onCommit,
  placeholder,
  label,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  const [text, setText] = useState(value);
  const committed = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  // The URL changed from outside (Clear filters, back button): show it.
  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setText(value);
    }
  }, [value]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const commit = (v: string) => {
    clearTimeout(timer.current);
    const next = v.trim();
    if (next === committed.current.trim()) return;
    committed.current = next;
    onCommitRef.current(next);
  };

  return (
    <form
      role="search"
      className="min-w-0 flex-1 basis-40 md:max-w-xs"
      onSubmit={(e) => {
        e.preventDefault();
        commit(text);
      }}
    >
      <Input
        type="search"
        aria-label={label}
        enterKeyHint="search"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => commit(v), SEARCH_DELAY_MS);
        }}
        leftIcon={<Search className="h-4 w-4" />}
      />
    </form>
  );
}

function FieldControl<K extends string>({ field, filters, inline = false }: { field: FilterField<K>; filters: UrlFilters<K>; inline?: boolean }) {
  const id = useId();
  const { values, set } = filters;

  if (field.type === 'select') {
    return (
      <div className={inline ? 'w-48 shrink-0' : ''}>
        <Select
          id={`${id}-select`}
          label={inline ? undefined : field.label}
          aria-label={inline ? field.label : undefined}
          value={values[field.key]}
          onChange={(e) => set({ [field.key]: e.target.value } as Partial<Record<K, string>>)}
          className={inline && values[field.key] ? ACTIVE_SELECT : ''}
        >
          <option value="">{field.allLabel ?? 'All'}</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
    );
  }

  const keys = rangeKeys(field);
  const label = field.label ?? 'Date';
  const range = values[keys.range];
  const error = dateRangeError({ range, from: values[keys.from], to: values[keys.to] });

  return (
    <div className={inline ? 'flex flex-wrap items-start gap-2' : 'space-y-3'}>
      <div className={inline ? 'w-52 shrink-0' : ''}>
        <Select
          id={`${id}-range`}
          label={inline ? undefined : label}
          aria-label={inline ? label : undefined}
          value={range}
          onChange={(e) => {
            const next = e.target.value;
            set({ [keys.range]: next, ...(next === 'custom' ? {} : { [keys.from]: '', [keys.to]: '' }) } as Partial<Record<K, string>>);
          }}
          className={inline && range ? ACTIVE_SELECT : ''}
        >
          {DATE_RANGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.value === '' ? `${label}: any time` : o.label}
            </option>
          ))}
        </Select>
      </div>
      {range === 'custom' && (
        <>
          <div className={inline ? 'flex items-start gap-2' : 'grid grid-cols-2 gap-3'}>
            <div className={inline ? 'w-40' : ''}>
              <Input
                id={`${id}-from`}
                type="date"
                label={inline ? undefined : 'From'}
                aria-label={inline ? `${label} from` : undefined}
                value={values[keys.from]}
                max={values[keys.to] || undefined}
                onChange={(e) => set({ [keys.from]: e.target.value } as Partial<Record<K, string>>)}
              />
            </div>
            <div className={inline ? 'w-40' : ''}>
              <Input
                id={`${id}-to`}
                type="date"
                label={inline ? undefined : 'To'}
                aria-label={inline ? `${label} to` : undefined}
                value={values[keys.to]}
                min={values[keys.from] || undefined}
                onChange={(e) => set({ [keys.to]: e.target.value } as Partial<Record<K, string>>)}
              />
            </div>
          </div>
          {error && (
            <p role="alert" className={`text-xs font-medium text-semantic-error ${inline ? 'basis-full' : ''}`}>
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
