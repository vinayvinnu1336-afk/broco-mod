'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PackageIncludes } from '@/components/catalogue/PackageIncludes';
import { formatHours } from '@/lib/catalogue';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  CalendarClock,
  CarFront,
  CheckCircle2,
  Clock,
  Info,
  Layers,
  Package,
  Pencil,
  Search,
  ShieldCheck,
} from 'lucide-react';
import {
  FUELS,
  SEGMENTS,
  SEGMENT_LABELS,
  catalogueApi,
  type CarModel,
  type Manufacturer,
  type ServicePackage,
} from '@/lib/catalogue';
import { formatINRWhole } from '@/lib/format';
import { ActionBar, ActionBarSpacer } from '@/components/ui/ActionBar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterChips } from '@/components/ui/FilterChips';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { BrandLogo } from '@/components/catalogue/BrandLogo';
import { FormError, ToggleField } from '@/components/admin/FormControls';
import { PackageSheet } from '@/components/admin/PackageSheet';
import {
  adminCatalogueApi,
  apiError,
  type ModelPriceSheet,
  type PriceCell,
  type SegmentPriceResult,
} from '@/components/admin/catalogueAdminApi';

type Tab = 'packages' | 'prices' | 'bulk';

/** Share of the package price customers pay online when booking (rest is paid at the garage). */
const DEFAULT_ADVANCE_PERCENT = 10;
const MAX_PRICE = 1_000_000;

const km = (n: number) => `${n.toLocaleString('en-IN')} km`;

export default function AdminPackagesPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading packages…" />}>
      <PackagesAndPrices />
    </Suspense>
  );
}

function PackagesAndPrices() {
  const searchParams = useSearchParams();
  const modelParam = searchParams.get('model');
  const tabParam = searchParams.get('tab') as Tab | null;
  const router = useRouter();
  const pathname = usePathname();

  const [tab, setTab] = useState<Tab>(modelParam ? 'prices' : tabParam && ['packages', 'prices', 'bulk'].includes(tabParam) ? tabParam : 'packages');
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPackages = useCallback(async () => {
    setLoading(true);
    const res = await adminCatalogueApi.packages();
    if (res.success && res.data) {
      setPackages([...res.data].sort((a, b) => a.displayOrder - b.displayOrder));
      setLoadError(null);
    } else {
      setLoadError(res.message || 'Could not load service packages.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  const changeTab = (next: Tab) => {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'packages') params.delete('tab');
    else params.set('tab', next);
    if (next !== 'prices') params.delete('model');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Packages & prices"
        description="What each service package includes, and what it costs for every car and fuel."
      />

      <FilterChips
        ariaLabel="Section"
        value={tab}
        onChange={(v) => changeTab(v as Tab)}
        options={[
          { value: 'packages', label: 'Packages', count: loading ? undefined : packages.length },
          { value: 'prices', label: 'Prices by car' },
          { value: 'bulk', label: 'Bulk by segment' },
        ]}
      />

      {loading && packages.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : loadError && packages.length === 0 ? (
        <ErrorState title="Packages unavailable" error={loadError} onRetry={loadPackages} />
      ) : tab === 'packages' ? (
        <PackagesTab
          packages={packages}
          onSaved={(p) => setPackages((list) => list.map((x) => (x.id === p.id ? p : x)).sort((a, b) => a.displayOrder - b.displayOrder))}
        />
      ) : tab === 'prices' ? (
        <PricesTab packages={packages} initialModelId={modelParam} />
      ) : (
        <BulkTab packages={packages} />
      )}
    </div>
  );
}

// =============================================================================================
// Packages
// =============================================================================================

function PackagesTab({ packages, onSaved }: { packages: ServicePackage[]; onSaved: (p: ServicePackage) => void }) {
  const [editing, setEditing] = useState<ServicePackage | null>(null);

  if (packages.length === 0) {
    return <EmptyState icon={Package} title="No service packages" description="Packages are created by the server seed. None were found." />;
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {packages.map((p) => {
          return (
            <Card key={p.id} className={`flex flex-col p-4 sm:p-5 ${p.isRecommended ? 'border-electric-300 ring-1 ring-electric-200' : ''}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="mr-1 text-base font-semibold text-navy-900">{p.name}</h2>
                {p.isRecommended && <Badge variant="blue">Recommended</Badge>}
                {!p.isActive && <Badge variant="neutral">Inactive</Badge>}
              </div>
              <p className="mt-0.5 text-xs font-medium text-navy-400">{p.code}</p>
              {p.tagline && <p className="mt-2 text-sm text-navy-600">{p.tagline}</p>}

              <dl className="mt-4 space-y-2 text-sm">
                <Fact icon={CalendarClock} label="Interval">
                  Every {km(p.intervalKm)}
                  {p.intervalMonths ? ` or ${p.intervalMonths} months` : ''}
                </Fact>
                <Fact icon={Clock} label="Duration">
                  About {formatHours(p.durationHours)}
                </Fact>
                <Fact icon={ShieldCheck} label="Warranty">
                  Warranty {km(p.warrantyKm)} or {p.warrantyDays} days
                </Fact>
              </dl>

              <div className="mt-4 flex-1 border-t border-surface-200 pt-3">
                <p className="text-xs font-medium text-navy-500">Includes {(p.includes ?? []).length} items</p>
                <PackageIncludes includes={p.includes ?? []} compact collapsedGroups={2} className="mt-2" />
              </div>

              <Button variant="outline" className="mt-4 w-full" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(p)}>
                Edit package
              </Button>
            </Card>
          );
        })}
      </div>

      <PackageSheet
        pkg={editing}
        onClose={() => setEditing(null)}
        onSaved={(p) => {
          setEditing(null);
          onSaved(p);
        }}
      />
    </>
  );
}

function Fact({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" aria-hidden="true" />
      <dt className="sr-only">{label}</dt>
      <dd className="text-navy-700">{children}</dd>
    </div>
  );
}

// =============================================================================================
// Prices by car
// =============================================================================================

const cellKey = (fuel: string, code: string) => `${fuel}|${code}`;

function toCells(sheet: ModelPriceSheet): Record<string, string> {
  const cells: Record<string, string> = {};
  sheet.prices.forEach((p) => {
    cells[cellKey(p.fuelType, p.packageCode)] = p.price != null && p.price > 0 ? String(Number(p.price)) : '';
  });
  return cells;
}

function PricesTab({ packages, initialModelId }: { packages: ServicePackage[]; initialModelId: string | null }) {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const [brands, setBrands] = useState<Manufacturer[]>([]);
  const [brandsError, setBrandsError] = useState<string | null>(null);
  const [brandId, setBrandId] = useState('');
  const [models, setModels] = useState<CarModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [modelId, setModelId] = useState<string | null>(null);
  const [picking, setPicking] = useState(true);

  const [sheet, setSheet] = useState<ModelPriceSheet | null>(null);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [cells, setCells] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [advancePercent, setAdvancePercent] = useState(DEFAULT_ADVANCE_PERCENT);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const sheetRequest = useRef(0);
  const modelsRequest = useRef(0);

  const loadModels = useCallback(async (id: string) => {
    const requestId = ++modelsRequest.current;
    setLoadingModels(true);
    setModels([]);
    const res = await catalogueApi.models(id, false);
    if (requestId !== modelsRequest.current) return;
    setModels(res.success && res.data ? res.data : []);
    setLoadingModels(false);
  }, []);

  const loadSheet = useCallback(async (id: string) => {
    const requestId = ++sheetRequest.current;
    setLoadingSheet(true);
    setSheetError(null);
    setSaveError(null);
    const res = await adminCatalogueApi.modelPrices(id);
    if (requestId !== sheetRequest.current) return;
    if (res.success && res.data) {
      const data = res.data;
      setSheet(data);
      const c = toCells(data);
      setCells(c);
      setOriginal(c);
      // The advance share is configured on the server; read it from the public offers endpoint.
      const fuel = data.fuels?.[0];
      if (fuel) {
        catalogueApi.offers(id, fuel).then((o) => {
          if (requestId === sheetRequest.current && o.success && o.data && typeof o.data.advancePercentage === 'number') {
            setAdvancePercent(o.data.advancePercentage);
          }
        });
      }
    } else {
      setSheet(null);
      setSheetError(res.message || 'Could not load prices for this car.');
    }
    setLoadingSheet(false);
  }, []);

  // Brands
  useEffect(() => {
    catalogueApi.manufacturers(false).then((res) => {
      if (res.success && res.data) setBrands([...res.data].sort((a, b) => a.name.localeCompare(b.name)));
      else setBrandsError(res.message || 'Could not load brands.');
    });
  }, []);

  // Deep link: /admin/packages?model=<id>
  useEffect(() => {
    if (!initialModelId || initialModelId === modelId) return;
    let cancelled = false;
    catalogueApi.model(initialModelId).then((res) => {
      if (cancelled || !res.success || !res.data) {
        if (!cancelled && !res.success) setSheetError(res.message || 'That car was not found.');
        return;
      }
      setBrandId(res.data.manufacturerId);
      loadModels(res.data.manufacturerId);
      setModelId(res.data.id);
      setPicking(false);
      loadSheet(res.data.id);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialModelId]);

  const dirtyCount = useMemo(
    () => Object.keys({ ...cells, ...original }).filter((k) => (cells[k] ?? '') !== (original[k] ?? '')).length,
    [cells, original]
  );

  const guard = (action: () => void) => {
    if (dirtyCount > 0) setPendingAction(() => action);
    else action();
  };

  const setUrlModel = (id: string | null) => {
    const params = new URLSearchParams();
    params.set('tab', 'prices');
    if (id) params.set('model', id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const chooseBrand = (id: string) =>
    guard(() => {
      setBrandId(id);
      setModelId(null);
      setSheet(null);
      setCells({});
      setOriginal({});
      setPicking(true);
      setModelSearch('');
      if (id) loadModels(id);
      else setModels([]);
    });

  const chooseModel = (m: CarModel) =>
    guard(() => {
      setModelId(m.id);
      setPicking(false);
      setUrlModel(m.id);
      loadSheet(m.id);
    });

  const filteredModels = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    return q ? models.filter((m) => m.name.toLowerCase().includes(q)) : models;
  }, [models, modelSearch]);

  const brand = brands.find((b) => b.id === brandId) ?? null;
  const model = models.find((m) => m.id === modelId) ?? null;

  const fuels = useMemo(() => {
    if (!sheet) return [];
    const set = new Set<string>(sheet.fuels ?? []);
    sheet.prices.forEach((p) => {
      if (p.price != null && p.price > 0) set.add(p.fuelType);
    });
    const order = FUELS as readonly string[];
    const rank = (f: string) => (order.includes(f) ? order.indexOf(f) : order.length);
    return Array.from(set).sort((a, b) => rank(a) - rank(b));
  }, [sheet]);

  const columns = useMemo(() => {
    const list = packages.map((p) => ({ code: p.code, name: p.name, isActive: p.isActive }));
    sheet?.prices.forEach((p) => {
      if (!list.some((c) => c.code === p.packageCode)) list.push({ code: p.packageCode, name: p.packageCode, isActive: true });
    });
    return list;
  }, [packages, sheet]);

  const invalidCells = useMemo(() => {
    const bad = new Set<string>();
    Object.entries(cells).forEach(([k, v]) => {
      if (v.trim() === '') return;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > MAX_PRICE) bad.add(k);
    });
    return bad;
  }, [cells]);

  const handleSave = async () => {
    if (!modelId) return;
    if (invalidCells.size > 0) {
      setSaveError(`Fix ${invalidCells.size} price${invalidCells.size === 1 ? '' : 's'}: enter an amount up to ${formatINRWhole(MAX_PRICE)}, or leave empty.`);
      return;
    }
    const prices: PriceCell[] = [];
    fuels.forEach((fuel) =>
      columns.forEach((c) => {
        const raw = (cells[cellKey(fuel, c.code)] ?? '').trim();
        const n = raw === '' ? null : Math.round(Number(raw) * 100) / 100;
        prices.push({ packageCode: c.code, fuelType: fuel, price: n && n > 0 ? n : null });
      })
    );
    setSaving(true);
    setSaveError(null);
    const res = await adminCatalogueApi.saveModelPrices(modelId, prices);
    setSaving(false);
    if (res.success && res.data) {
      setSheet(res.data);
      const c = toCells(res.data);
      setCells(c);
      setOriginal(c);
      toast.success('Prices saved', `${res.data.manufacturerName} ${res.data.modelName}`);
    } else {
      setSaveError(apiError(res, 'Could not save prices. Please try again.'));
    }
  };

  const split = (raw: string | undefined) => {
    const n = Number((raw ?? '').trim());
    if (!raw || !raw.trim() || !Number.isFinite(n) || n <= 0) return null;
    const advance = Math.round((n * advancePercent) / 100);
    return { advance, rest: n - advance };
  };

  const priceInput = (fuel: string, c: { code: string; name: string }) => {
    const key = cellKey(fuel, c.code);
    const parts = split(cells[key]);
    return (
      <div>
        <Input
          aria-label={`${c.name} price for ${fuel}`}
          type="number"
          inputMode="decimal"
          min={0}
          max={MAX_PRICE}
          step="1"
          placeholder="Not offered"
          value={cells[key] ?? ''}
          onChange={(e) => setCells((x) => ({ ...x, [key]: e.target.value }))}
          leftIcon={<span className="text-sm font-medium">₹</span>}
          error={invalidCells.has(key) ? 'Invalid amount' : undefined}
          className="tabular-nums"
        />
        <p className="mt-1 min-h-[16px] text-[11px] leading-4 text-navy-400">
          {parts ? `${formatINRWhole(parts.advance)} online · ${formatINRWhole(parts.rest)} at garage` : (cells[key] ?? '') === '' ? 'Not offered' : ''}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Car picker */}
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-navy-900">Car</h2>
        </div>
        {brandsError && <FormError message={brandsError} />}
        {!picking && (model || sheet) ? (
          <div className="flex items-center gap-3">
            <BrandLogo name={brand?.name ?? sheet?.manufacturerName ?? '?'} logoUrl={brand?.logoUrl} size={44} className="border border-surface-200" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-navy-900">
                {brand?.name ?? sheet?.manufacturerName} {model?.name ?? sheet?.modelName}
              </p>
              <p className="truncate text-xs text-navy-500">
                {(() => {
                  const seg = model?.segment ?? sheet?.segment ?? '';
                  const f = model?.fuels ?? sheet?.fuels ?? [];
                  return `${SEGMENT_LABELS[seg] ?? seg} · ${f.join(', ') || 'No fuels set'}`;
                })()}
              </p>
            </div>
            <Button variant="outline" size="sm" className="min-h-[44px] shrink-0 sm:min-h-[36px]" onClick={() => setPicking(true)}>
              Change
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Select
              label="Brand"
              value={brandId}
              onChange={(e) => chooseBrand(e.target.value)}
              placeholder={brands.length ? 'Choose a brand' : 'Loading brands…'}
              options={brands.map((b) => ({ value: b.id, label: b.isActive ? b.name : `${b.name} (inactive)` }))}
            />
            <Input
              label="Model"
              type="search"
              placeholder={brandId ? 'Search models' : 'Choose a brand first'}
              disabled={!brandId}
              value={modelSearch}
              onChange={(e) => setModelSearch(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
            {brandId && (
              <div className="md:col-span-2">
                <div className="max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-surface-200 divide-y divide-surface-200/80">
                  {loadingModels ? (
                    <div className="space-y-2 p-3">
                      {[0, 1, 2].map((i) => (
                        <Skeleton key={i} className="h-10" />
                      ))}
                    </div>
                  ) : filteredModels.length === 0 ? (
                    <p className="p-4 text-sm text-navy-500">{models.length ? 'No models match your search.' : 'This brand has no models yet.'}</p>
                  ) : (
                    filteredModels.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => chooseModel(m)}
                        className={`flex min-h-[52px] w-full items-center gap-3 px-3.5 py-2 text-left transition hover:bg-surface-50 ${
                          m.id === modelId ? 'bg-electric-50' : ''
                        }`}
                      >
                        <CarFront className="h-4 w-4 shrink-0 text-navy-400" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-navy-900">
                            {m.name}
                            {!m.isActive && <span className="ml-1.5 text-xs font-normal text-navy-400">(inactive)</span>}
                          </span>
                          <span className="block truncate text-xs text-navy-500">
                            {SEGMENT_LABELS[m.segment] ?? m.segment} · {(m.fuels ?? []).join(', ')}
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="flex items-start gap-2 rounded-xl border border-electric-200 bg-electric-50 px-3.5 py-3 text-sm text-electric-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          Customer pays {advancePercent}% online when booking and the rest at the garage. Leave a price empty if the package isn&apos;t offered for
          that fuel.
        </p>
      </div>

      {/* Price grid */}
      {!modelId ? (
        <EmptyState icon={CarFront} title="Pick a car to see its prices" description="Choose a brand and model above." />
      ) : loadingSheet && !sheet ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : sheetError && !sheet ? (
        <ErrorState title="Prices unavailable" error={sheetError} onRetry={() => modelId && loadSheet(modelId)} />
      ) : sheet && fuels.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No fuels set for this model"
          description="Add at least one fuel to this model in the vehicle catalogue before setting prices."
        />
      ) : sheet ? (
        <>
          <FormError message={saveError} />

          {/* Desktop grid: fuels x packages */}
          <div className="hidden overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-card lg:block">
            <table className="w-full table-fixed text-sm">
              <thead className="border-b border-surface-200 bg-surface-50">
                <tr>
                  <th scope="col" className="w-32 px-4 py-3 text-left text-xs font-semibold text-navy-600">
                    Fuel
                  </th>
                  {columns.map((c) => (
                    <th key={c.code} scope="col" className="px-3 py-3 text-left text-xs font-semibold text-navy-600">
                      {c.name}
                      {!c.isActive && <span className="ml-1 font-normal text-navy-400">(inactive)</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200/80">
                {fuels.map((fuel) => (
                  <tr key={fuel}>
                    <th scope="row" className="px-4 py-3 text-left align-top">
                      <span className="block pt-2.5 text-sm font-semibold text-navy-900">{fuel}</span>
                      {!(sheet.fuels ?? []).includes(fuel) && <span className="text-[11px] text-amber-600">Not a listed fuel</span>}
                    </th>
                    {columns.map((c) => (
                      <td key={c.code} className="px-3 py-3 align-top">
                        {priceInput(fuel, c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones and tablets: one card per fuel */}
          <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:hidden">
            {fuels.map((fuel) => (
              <Card key={fuel} className="p-4">
                <h3 className="text-base font-semibold text-navy-900">
                  {fuel}
                  {!(sheet.fuels ?? []).includes(fuel) && <span className="ml-2 text-xs font-normal text-amber-600">Not a listed fuel</span>}
                </h3>
                <div className="mt-3 space-y-3">
                  {columns.map((c) => (
                    <div key={c.code} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start gap-3">
                      <div className="pt-3 text-sm font-medium text-navy-700">
                        {c.name}
                        {!c.isActive && <span className="block text-[11px] font-normal text-navy-400">Inactive</span>}
                      </div>
                      {priceInput(fuel, c)}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <ActionBar
            summary={
              <span className="text-sm text-navy-500">
                {dirtyCount > 0 ? `${dirtyCount} unsaved change${dirtyCount === 1 ? '' : 's'}` : 'All prices saved'}
              </span>
            }
          >
            <Button onClick={handleSave} isLoading={saving} disabled={dirtyCount === 0}>
              Save prices
            </Button>
          </ActionBar>
          <ActionBarSpacer />
        </>
      ) : null}

      <ConfirmationDialog
        isOpen={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        onConfirm={() => {
          const action = pendingAction;
          setPendingAction(null);
          setOriginal(cells);
          action?.();
        }}
        variant="warning"
        title="Discard unsaved prices?"
        message="You have changed prices for this car without saving. Switching car will discard those changes."
        confirmText="Discard changes"
        cancelText="Keep editing"
      />
    </div>
  );
}

// =============================================================================================
// Bulk by segment
// =============================================================================================

function BulkTab({ packages }: { packages: ServicePackage[] }) {
  const toast = useToast();
  const [segment, setSegment] = useState<string>(SEGMENTS[0]);
  const [fuelType, setFuelType] = useState<string>(FUELS[0]);
  const [packageCode, setPackageCode] = useState<string>(packages[0]?.code ?? '');
  const [price, setPrice] = useState('');
  const [overwrite, setOverwrite] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<(SegmentPriceResult & { label: string }) | null>(null);

  const pkgName = packages.find((p) => p.code === packageCode)?.name ?? packageCode;
  const label = `${pkgName} · ${fuelType} · ${SEGMENT_LABELS[segment] ?? segment}`;

  const validate = () => {
    const n = Number(price);
    if (!price.trim() || !Number.isFinite(n) || n < 1 || n > MAX_PRICE) {
      setPriceError(`Enter a price from ₹1 to ${formatINRWhole(MAX_PRICE)}.`);
      return null;
    }
    setPriceError(null);
    return Math.round(n * 100) / 100;
  };

  const submit = async () => {
    const n = validate();
    if (n == null || !packageCode) return;
    setSubmitting(true);
    setFormError(null);
    const res = await adminCatalogueApi.applySegmentPrice({ segment, fuelType, packageCode, price: n, overwriteExisting: overwrite });
    setSubmitting(false);
    setConfirming(false);
    if (res.success && res.data) {
      setResult({ ...res.data, label: `${label} at ${formatINRWhole(n)}` });
      toast.success('Segment price applied', `${res.data.created} added · ${res.data.updated} updated · ${res.data.skipped} skipped`);
    } else {
      setFormError(apiError(res, 'Could not apply the price. Please try again.'));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate() == null) return;
    if (overwrite) setConfirming(true);
    else submit();
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-6">
      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-navy-900">Set one price for a whole segment</h2>
        <p className="mt-1 text-sm text-navy-500">
          For example, Standard service for every petrol hatchback. Models keep their own prices unless you choose to overwrite them.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
          <FormError message={formError} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Segment"
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              options={SEGMENTS.map((s) => ({ value: s, label: SEGMENT_LABELS[s] ?? s }))}
            />
            <Select label="Fuel" value={fuelType} onChange={(e) => setFuelType(e.target.value)} options={FUELS.map((f) => ({ value: f, label: f }))} />
            <Select
              label="Package"
              value={packageCode}
              onChange={(e) => setPackageCode(e.target.value)}
              options={packages.map((p) => ({ value: p.code, label: p.isActive ? p.name : `${p.name} (inactive)` }))}
            />
            <Input
              label="Price"
              required
              type="number"
              inputMode="decimal"
              min={1}
              max={MAX_PRICE}
              placeholder="e.g. 3499"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              leftIcon={<span className="text-sm font-medium">₹</span>}
              error={priceError ?? undefined}
            />
          </div>
          <ToggleField
            label="Overwrite existing prices"
            description="Off: only models without a price for this package and fuel get it. On: every model in the segment gets this price."
            checked={overwrite}
            onChange={setOverwrite}
          />
          <Button type="submit" isLoading={submitting && !confirming} className="w-full sm:w-auto">
            Apply to segment
          </Button>
        </form>
      </Card>

      <div className="space-y-3">
        {result ? (
          <Card className="p-4 sm:p-5">
            <h2 className="text-base font-semibold text-navy-900">Last result</h2>
            <p className="mt-1 text-sm text-navy-500">{result.label}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <ResultTile label="Added" value={result.created} tone="text-emerald-700 bg-emerald-50" />
              <ResultTile label="Updated" value={result.updated} tone="text-electric-700 bg-electric-50" />
              <ResultTile label="Skipped" value={result.skipped} tone="text-navy-700 bg-surface-100" />
            </div>
            <p className="mt-3 text-xs text-navy-500">
              Skipped models already had a price{result.skipped && !overwrite ? '; turn on “Overwrite existing prices” to replace them' : ''}.
            </p>
          </Card>
        ) : (
          <EmptyState icon={Layers} title="No changes yet" description="The number of models added, updated and skipped will show here." />
        )}
      </div>

      <ConfirmationDialog
        isOpen={confirming}
        onClose={() => !submitting && setConfirming(false)}
        onConfirm={submit}
        isLoading={submitting}
        variant="warning"
        title="Overwrite prices for the whole segment?"
        message={`Every ${fuelType.toLowerCase()} ${SEGMENT_LABELS[segment] ?? segment} model will be set to ${
          price ? formatINRWhole(Number(price)) : ''
        } for ${pkgName}, replacing prices set per model.`}
        confirmText="Overwrite prices"
      />
    </div>
  );
}

function ResultTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-xl px-3 py-3 text-center ${tone}`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  );
}
