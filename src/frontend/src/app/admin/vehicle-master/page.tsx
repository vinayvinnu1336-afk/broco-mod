'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CarFront, ChevronLeft, ChevronRight, Factory, IndianRupee, Pencil, Plus, Settings2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { SEGMENTS, SEGMENT_LABELS, catalogueApi, type CarModel, type Manufacturer } from '@/lib/catalogue';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterBar } from '@/components/ui/FilterBar';
import { ListItem } from '@/components/ui/ListItem';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { BrandLogo } from '@/components/catalogue/BrandLogo';
import { BrandSheet } from '@/components/admin/BrandSheet';
import { ModelSheet } from '@/components/admin/ModelSheet';
import { matchesSearch, useUrlFilters } from '@/lib/useUrlFilters';

interface VehicleVariant {
  id: string;
  modelId: string;
  modelName: string;
  name: string;
  transmission: string;
  fuelType: string;
  engineDisplacementCc: number | null;
  horsepower: number | null;
  yearFrom: number;
  yearTo: number | null;
  isActive: boolean;
}

type Step = 'makes' | 'models' | 'variants';

const years = (from: number, to: number | null) => (from ? `${from}–${to || 'now'}` : '');
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];
const SEGMENT_OPTIONS = SEGMENTS.map((s) => ({ value: s, label: SEGMENT_LABELS[s] ?? s }));

const FILTER_DEFAULTS = { q: '', status: '', segment: '' };

const matchesStatus = (status: string, isActive: boolean) =>
  !status || (status === 'active' ? isActive : !isActive);

export default function AdminVehicleMasterPage() {
  return (
    <Suspense fallback={<ColumnSkeleton />}>
      <AdminVehicleMaster />
    </Suspense>
  );
}

function AdminVehicleMaster() {
  const filters = useUrlFilters(FILTER_DEFAULTS);
  const { values: f } = filters;
  const search = f.q;
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedManufacturer, setSelectedManufacturer] = useState<Manufacturer | null>(null);
  const [models, setModels] = useState<CarModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const [selectedModel, setSelectedModel] = useState<CarModel | null>(null);
  const [variants, setVariants] = useState<VehicleVariant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);

  // Sheets
  const [brandSheet, setBrandSheet] = useState<{ open: boolean; brand: Manufacturer | null }>({ open: false, brand: null });
  const [modelSheet, setModelSheet] = useState<{ open: boolean; model: CarModel | null }>({ open: false, model: null });

  // Phones show one column at a time (drill-down); desktop shows all three.
  const [mobileStep, setMobileStep] = useState<Step>('makes');

  // Ignore responses that arrive after the user picked something else.
  const modelsRequest = useRef(0);
  const variantsRequest = useRef(0);

  const selectModel = useCallback(async (mod: CarModel) => {
    const requestId = ++variantsRequest.current;
    setSelectedModel(mod);
    setVariants([]);
    setLoadingVariants(true);
    const res = await apiFetch<VehicleVariant[]>(`/vehicle-models/${mod.id}/variants`);
    if (requestId !== variantsRequest.current) return;
    setVariants(res.success && res.data ? res.data : []);
    setLoadingVariants(false);
  }, []);

  const selectManufacturer = useCallback(
    async (m: Manufacturer) => {
      const requestId = ++modelsRequest.current;
      variantsRequest.current++;
      setSelectedModel(null);
      setVariants([]);
      setModels([]);
      setSelectedManufacturer(m);
      setLoadingModels(true);
      setModelsError(null);

      const res = await catalogueApi.models(m.id, false);
      if (requestId !== modelsRequest.current) return;
      if (res.success && res.data) {
        setModels(res.data);
        if (res.data.length > 0) selectModel(res.data[0]);
      } else {
        setModelsError(res.message || 'Could not load models.');
      }
      setLoadingModels(false);
    },
    [selectModel]
  );

  /** Reload the models of the current brand after an edit, keeping the current selection. */
  const refreshModels = useCallback(async (m: Manufacturer) => {
    const requestId = ++modelsRequest.current;
    const res = await catalogueApi.models(m.id, false);
    if (requestId !== modelsRequest.current || !res.success || !res.data) return;
    const list = res.data;
    setModels(list);
    setSelectedModel((current) => (current ? list.find((x) => x.id === current.id) ?? current : current));
  }, []);

  const didAutoSelect = useRef(false);

  const loadManufacturers = useCallback(
    async (opts: { quiet?: boolean } = {}) => {
      if (!opts.quiet) setLoading(true);
      const res = await catalogueApi.manufacturers(false);
      if (res.success && res.data) {
        const list = res.data;
        setManufacturers(list);
        setLoadError(null);
        setSelectedManufacturer((current) => (current ? list.find((m) => m.id === current.id) ?? current : current));
        if (!didAutoSelect.current && list.length > 0) {
          didAutoSelect.current = true;
          const first = [...list].sort((x, y) => x.displayOrder - y.displayOrder || x.name.localeCompare(y.name))[0];
          selectManufacturer(first);
        }
      } else if (!opts.quiet) {
        setLoadError(res.message || 'Could not load the vehicle catalogue.');
      }
      setLoading(false);
    },
    [selectManufacturer]
  );

  useEffect(() => {
    loadManufacturers();
  }, [loadManufacturers]);

  // A new search starts from the brand list on phones.
  const lastSearch = useRef(search);
  useEffect(() => {
    if (search !== lastSearch.current) {
      lastSearch.current = search;
      setMobileStep('makes');
    }
  }, [search]);

  // The search box matches brands (name, country) and the selected brand's models (name, body type).
  // When it matches the selected brand itself, all of that brand's models stay listed.
  const brandMatches = useCallback((m: Manufacturer) => matchesSearch(search, m.name, m.country), [search]);
  const selectedBrandMatches = !!selectedManufacturer && brandMatches(selectedManufacturer);

  const filteredModels = useMemo(
    () =>
      models.filter(
        (mod) =>
          matchesStatus(f.status, mod.isActive) &&
          (!f.segment || mod.segment === f.segment) &&
          (selectedBrandMatches || matchesSearch(search, mod.name, mod.bodyType))
      ),
    [models, f.status, f.segment, selectedBrandMatches, search]
  );

  // Keep the variants column in step with the filtered models: never show a model the filters hide.
  useEffect(() => {
    if (loadingModels) return;
    const visible = !!selectedModel && filteredModels.some((m) => m.id === selectedModel.id);
    if (visible) return;
    if (filteredModels.length > 0) selectModel(filteredModels[0]);
    else if (selectedModel) {
      variantsRequest.current++;
      setSelectedModel(null);
      setVariants([]);
      setLoadingVariants(false);
    }
  }, [filteredModels, selectedModel, loadingModels, selectModel]);

  const filteredManufacturers = useMemo(() => {
    const list = [...manufacturers].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
    return list.filter(
      (m) =>
        matchesStatus(f.status, m.isActive) &&
        // Keep the selected brand when the search found some of its models.
        (brandMatches(m) || (m.id === selectedManufacturer?.id && search.trim() !== '' && filteredModels.length > 0))
    );
  }, [manufacturers, f.status, brandMatches, selectedManufacturer, search, filteredModels.length]);

  // Likewise for brands: when the filters hide the selected brand, open the first brand still listed.
  useEffect(() => {
    if (loading || loadingModels || filteredManufacturers.length === 0) return;
    if (selectedManufacturer && filteredManufacturers.some((m) => m.id === selectedManufacturer.id)) return;
    selectManufacturer(filteredManufacturers[0]);
  }, [loading, loadingModels, filteredManufacturers, selectedManufacturer, selectManufacturer]);

  const anyFilter = filters.isActive('q') || filters.isActive('status') || filters.isActive('segment');

  const nextDisplayOrder = useMemo(
    () => manufacturers.reduce((max, m) => Math.max(max, m.displayOrder || 0), 0) + 1,
    [manufacturers]
  );

  const handleBrandSaved = (saved: Manufacturer) => {
    setBrandSheet({ open: false, brand: null });
    setManufacturers((list) => {
      const exists = list.some((m) => m.id === saved.id);
      return exists ? list.map((m) => (m.id === saved.id ? saved : m)) : [...list, saved];
    });
    if (selectedManufacturer?.id === saved.id) setSelectedManufacturer(saved);
    else if (!brandSheet.brand) {
      selectManufacturer(saved);
      setMobileStep('models');
    }
  };

  const handleModelSaved = (saved: CarModel) => {
    const isNew = !modelSheet.model;
    setModelSheet({ open: false, model: null });
    if (selectedManufacturer) refreshModels(selectedManufacturer);
    if (isNew || selectedModel?.id === saved.id) {
      selectModel(saved);
      if (isNew) setMobileStep('variants');
    }
    // Refresh model counts on the brand rows.
    loadManufacturers({ quiet: true });
  };

  const columnClass = (step: Step) => (mobileStep === step ? 'block' : 'hidden md:block');

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Vehicle catalogue"
        description="Brands, models and variants customers pick from. Set each model's pricing segment and fuels here; set prices under Packages & prices."
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setBrandSheet({ open: true, brand: null })}>
            Add brand
          </Button>
        }
      />

      <FilterBar
        filters={filters}
        searchKey="q"
        searchPlaceholder="Brand or model, e.g. Maruti"
        searchLabel="Search brands and models"
        fields={[
          { type: 'select', key: 'status', label: 'Status', allLabel: 'Active and inactive', options: STATUS_OPTIONS },
          { type: 'select', key: 'segment', label: 'Model segment', allLabel: 'All segments', options: SEGMENT_OPTIONS },
        ]}
      />

      {loadError && manufacturers.length === 0 && !loading ? (
        <ErrorState title="Catalogue unavailable" error={loadError} onRetry={() => loadManufacturers()} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {/* Brands */}
          <CatalogColumn className={columnClass('makes')} title="Brands" count={loading ? undefined : filteredManufacturers.length}>
            {loading ? (
              <ColumnSkeleton />
            ) : filteredManufacturers.length === 0 ? (
              <ColumnEmpty icon={Factory} text={anyFilter ? 'No brands match these filters.' : 'No brands yet. Add the first one.'} />
            ) : (
              filteredManufacturers.map((m) => {
                const active = selectedManufacturer?.id === m.id;
                return (
                  <ManageRow
                    key={m.id}
                    active={active}
                    onSelect={() => {
                      if (!active) selectManufacturer(m);
                      setMobileStep('models');
                    }}
                    leading={<BrandLogo name={m.name} logoUrl={m.logoUrl} size={40} className="border border-surface-200" />}
                    title={m.name}
                    badges={
                      <>
                        {m.isPopular && <Badge variant="blue">Popular</Badge>}
                        {!m.isActive && <Badge variant="neutral">Inactive</Badge>}
                      </>
                    }
                    subtitle={[m.country, plural(m.modelsCount, 'model', 'models')].filter(Boolean).join(' · ')}
                    actions={
                      <IconAction label={`Edit ${m.name}`} onClick={() => setBrandSheet({ open: true, brand: m })}>
                        <Pencil className="h-4 w-4" />
                      </IconAction>
                    }
                  />
                );
              })
            )}
          </CatalogColumn>

          {/* Models */}
          <CatalogColumn
            className={columnClass('models')}
            title={selectedManufacturer ? `${selectedManufacturer.name} models` : 'Models'}
            count={selectedManufacturer && !loadingModels ? filteredModels.length : undefined}
            onBack={() => setMobileStep('makes')}
            backLabel="All brands"
            headerAction={
              selectedManufacturer ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-[40px]"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={() => setModelSheet({ open: true, model: null })}
                >
                  Add model
                </Button>
              ) : undefined
            }
          >
            {!selectedManufacturer ? (
              <ColumnEmpty icon={CarFront} text="Pick a brand to see its models." />
            ) : loadingModels && models.length === 0 ? (
              <ColumnSkeleton />
            ) : modelsError ? (
              <div className="p-3">
                <ErrorState title="Models unavailable" error={modelsError} onRetry={() => selectManufacturer(selectedManufacturer)} className="border-0 shadow-none" />
              </div>
            ) : models.length === 0 ? (
              <ColumnEmpty icon={CarFront} text="No models listed for this brand yet." />
            ) : filteredModels.length === 0 ? (
              <ColumnEmpty icon={CarFront} text="No models match these filters." />
            ) : (
              filteredModels.map((mod) => {
                const active = selectedModel?.id === mod.id;
                return (
                  <ManageRow
                    key={mod.id}
                    active={active}
                    onSelect={() => {
                      if (!active) selectModel(mod);
                      setMobileStep('variants');
                    }}
                    title={mod.name}
                    badges={!mod.isActive ? <Badge variant="neutral">Inactive</Badge> : undefined}
                    subtitle={[mod.bodyType, years(mod.yearFrom, mod.yearTo)].filter(Boolean).join(' · ')}
                    meta={
                      <span className="flex flex-wrap items-center gap-1">
                        <span className="rounded-md bg-electric-50 px-1.5 py-0.5 font-medium text-electric-700">
                          {SEGMENT_LABELS[mod.segment] ?? (mod.segment || 'No segment')}
                        </span>
                        {(mod.fuels ?? []).map((f) => (
                          <span key={f} className="rounded-md bg-surface-100 px-1.5 py-0.5 font-medium text-navy-600">
                            {f}
                          </span>
                        ))}
                      </span>
                    }
                    actions={
                      <>
                        <Link
                          href={`/admin/packages?model=${mod.id}`}
                          aria-label={`Prices for ${mod.name}`}
                          title="Service prices"
                          className="flex h-11 w-11 items-center justify-center rounded-xl text-navy-500 transition hover:bg-surface-100 hover:text-navy-900"
                        >
                          <IndianRupee className="h-4 w-4" />
                        </Link>
                        <IconAction label={`Edit ${mod.name}`} onClick={() => setModelSheet({ open: true, model: mod })}>
                          <Pencil className="h-4 w-4" />
                        </IconAction>
                      </>
                    }
                  />
                );
              })
            )}
          </CatalogColumn>

          {/* Variants */}
          <CatalogColumn
            className={columnClass('variants')}
            title={selectedModel ? `${selectedModel.name} variants` : 'Variants'}
            count={selectedModel && !loadingVariants ? variants.length : undefined}
            onBack={() => setMobileStep('models')}
            backLabel={selectedManufacturer ? `${selectedManufacturer.name} models` : 'Models'}
          >
            {selectedModel && (
              <div className="flex flex-col gap-2 border-b border-surface-200 bg-surface-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-navy-500">
                  {SEGMENT_LABELS[selectedModel.segment] ?? selectedModel.segment} · {(selectedModel.fuels ?? []).join(', ') || 'No fuels set'}
                </p>
                <Link
                  href={`/admin/packages?model=${selectedModel.id}`}
                  className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-electric-700 hover:text-electric-800 sm:min-h-0"
                >
                  Service prices <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            )}
            {!selectedModel ? (
              <ColumnEmpty icon={Settings2} text="Pick a model to see its variants." />
            ) : loadingVariants ? (
              <ColumnSkeleton />
            ) : variants.length === 0 ? (
              <ColumnEmpty icon={Settings2} text="No variants listed for this model." />
            ) : (
              variants.map((v) => {
                const specs = [
                  v.horsepower != null ? `${v.horsepower} hp` : null,
                  v.engineDisplacementCc != null ? `${v.engineDisplacementCc} cc` : null,
                  years(v.yearFrom, v.yearTo) || null,
                ].filter(Boolean);
                return (
                  <ListItem
                    key={v.id}
                    title={v.name}
                    subtitle={[v.fuelType, v.transmission].filter(Boolean).join(' · ')}
                    meta={specs.length ? specs.join(' · ') : undefined}
                  />
                );
              })
            )}
          </CatalogColumn>
        </div>
      )}

      <BrandSheet
        isOpen={brandSheet.open}
        brand={brandSheet.brand}
        nextDisplayOrder={nextDisplayOrder}
        onClose={() => setBrandSheet({ open: false, brand: null })}
        onSaved={handleBrandSaved}
      />
      <ModelSheet
        isOpen={modelSheet.open}
        brand={selectedManufacturer}
        model={modelSheet.model}
        onClose={() => setModelSheet({ open: false, model: null })}
        onSaved={handleModelSaved}
      />
    </div>
  );
}

/** List row with a tappable main area plus separate icon actions (no nested buttons). */
function ManageRow({
  active,
  onSelect,
  leading,
  title,
  badges,
  subtitle,
  meta,
  actions,
}: {
  active: boolean;
  onSelect: () => void;
  leading?: React.ReactNode;
  title: string;
  badges?: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className={`flex items-center gap-1 pr-2 transition-colors ${active ? 'md:bg-electric-50' : ''}`}>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? 'true' : undefined}
        className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left transition-colors hover:bg-surface-50 active:bg-surface-100 md:hover:bg-transparent"
      >
        {leading && <span className="shrink-0">{leading}</span>}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="break-words text-[15px] font-semibold leading-snug text-navy-900">{title}</span>
            {badges}
          </span>
          {subtitle && <span className="mt-0.5 block truncate text-sm text-navy-500">{subtitle}</span>}
          {meta && <span className="mt-1 block text-xs text-navy-400">{meta}</span>}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-surface-400 md:hidden" aria-hidden="true" />
      </button>
      {actions && <div className="flex shrink-0 items-center">{actions}</div>}
    </div>
  );
}

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 items-center justify-center rounded-xl text-navy-500 transition hover:bg-surface-100 hover:text-navy-900"
    >
      {children}
    </button>
  );
}

function CatalogColumn({
  title,
  count,
  onBack,
  backLabel,
  headerAction,
  className = '',
  children,
}: {
  title: string;
  count?: number;
  onBack?: () => void;
  backLabel?: string;
  headerAction?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="-ml-1.5 mb-2 inline-flex min-h-[44px] items-center gap-1 rounded-lg px-1.5 text-sm font-medium text-navy-500 hover:text-navy-900 md:hidden"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </button>
      )}
      <Card className="flex flex-col overflow-hidden md:h-[600px]">
        <div className="flex min-h-[56px] items-center justify-between gap-2 border-b border-surface-200 px-4 py-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <h2 className="truncate text-base font-semibold text-navy-900">{title}</h2>
            {count !== undefined && <span className="shrink-0 text-xs font-medium text-navy-500">{count}</span>}
          </div>
          {headerAction}
        </div>
        <div className="divide-y divide-surface-200/80 md:flex-1 md:overflow-y-auto">{children}</div>
      </Card>
    </div>
  );
}

function ColumnSkeleton() {
  return (
    <div className="space-y-2 p-3" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  );
}

function ColumnEmpty({ icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="p-3">
      <EmptyState icon={icon} title={text} className="border-0 p-6 sm:p-8" />
    </div>
  );
}
