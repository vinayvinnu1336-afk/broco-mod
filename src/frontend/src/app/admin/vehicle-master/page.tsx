'use client';

import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { CarFront, ChevronLeft, Factory, Search, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { IconTile, ListItem } from '@/components/ui/ListItem';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';

interface Manufacturer {
  id: string;
  name: string;
  country: string;
  logoUrl: string;
  isActive: boolean;
  displayOrder: number;
  modelsCount: number;
}

interface VehicleModel {
  id: string;
  manufacturerId: string;
  manufacturerName: string;
  name: string;
  bodyType: string;
  yearFrom: number;
  yearTo: number | null;
  isActive: boolean;
  variantsCount: number;
}

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

export default function AdminVehicleMasterPage() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [selectedManufacturer, setSelectedManufacturer] = useState<Manufacturer | null>(null);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [variants, setVariants] = useState<VehicleVariant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);

  // Phones show one column at a time (drill-down); desktop shows all three.
  const [mobileStep, setMobileStep] = useState<Step>('makes');

  // Ignore responses that arrive after the user picked something else.
  const modelsRequest = useRef(0);
  const variantsRequest = useRef(0);

  const loadManufacturers = async (searchTerm = '') => {
    setLoading(true);
    const url = searchTerm
      ? `/vehicle-manufacturers?search=${encodeURIComponent(searchTerm)}`
      : '/vehicle-manufacturers';
    const res = await apiFetch<Manufacturer[]>(url);
    if (res.success && res.data) {
      setManufacturers(res.data);
      setLoadError(null);
      if (!selectedManufacturer && res.data.length > 0) {
        handleSelectManufacturer(res.data[0]);
      }
    } else {
      setLoadError(res.message || 'Could not load the vehicle catalogue.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadManufacturers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectManufacturer = async (m: Manufacturer) => {
    const requestId = ++modelsRequest.current;
    variantsRequest.current++;
    setSelectedManufacturer(m);
    setSelectedModel(null);
    setModels([]);
    setVariants([]);
    setLoadingModels(true);

    const res = await apiFetch<VehicleModel[]>(`/vehicle-manufacturers/${m.id}/models`);
    if (requestId !== modelsRequest.current) return;
    if (res.success && res.data) {
      setModels(res.data);
      if (res.data.length > 0) {
        handleSelectModel(res.data[0]);
      }
    }
    setLoadingModels(false);
  };

  const handleSelectModel = async (mod: VehicleModel) => {
    const requestId = ++variantsRequest.current;
    setSelectedModel(mod);
    setVariants([]);
    setLoadingVariants(true);

    const res = await apiFetch<VehicleVariant[]>(`/vehicle-models/${mod.id}/variants`);
    if (requestId !== variantsRequest.current) return;
    if (res.success && res.data) {
      setVariants(res.data);
    }
    setLoadingVariants(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMobileStep('makes');
    loadManufacturers(search);
  };

  const columnClass = (step: Step) => (mobileStep === step ? 'block' : 'hidden md:block');

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Vehicle catalogue"
        description="Makes, models and variants customers can choose from when they add a car. This list is read-only."
      />

      <form onSubmit={handleSearchSubmit} role="search" className="flex gap-2 md:max-w-md">
        <div className="flex-1">
          <Input
            type="search"
            enterKeyHint="search"
            aria-label="Search makes"
            placeholder="Search makes, e.g. Maruti"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <Button type="submit" variant="outline" className="shrink-0">
          Search
        </Button>
      </form>

      {loadError && manufacturers.length === 0 && !loading ? (
        <ErrorState title="Catalogue unavailable" error={loadError} onRetry={() => loadManufacturers(search)} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {/* Makes */}
          <CatalogColumn className={columnClass('makes')} title="Makes" count={loading ? undefined : manufacturers.length}>
            {loading ? (
              <ColumnSkeleton />
            ) : manufacturers.length === 0 ? (
              <ColumnEmpty icon={Factory} text={search ? 'No makes match your search.' : 'No makes in the catalogue.'} />
            ) : (
              manufacturers.map((m) => (
                <ListItem
                  key={m.id}
                  onClick={() => {
                    if (selectedManufacturer?.id !== m.id) handleSelectManufacturer(m);
                    setMobileStep('models');
                  }}
                  className={selectedManufacturer?.id === m.id ? 'md:bg-electric-50' : ''}
                  leading={<IconTile icon={Factory} tone={selectedManufacturer?.id === m.id ? 'blue' : 'neutral'} />}
                  title={m.name}
                  subtitle={[m.country, plural(m.modelsCount, 'model', 'models')].filter(Boolean).join(' · ')}
                />
              ))
            )}
          </CatalogColumn>

          {/* Models */}
          <CatalogColumn
            className={columnClass('models')}
            title={selectedManufacturer ? `${selectedManufacturer.name} models` : 'Models'}
            count={selectedManufacturer && !loadingModels ? models.length : undefined}
            onBack={() => setMobileStep('makes')}
            backLabel="All makes"
          >
            {!selectedManufacturer ? (
              <ColumnEmpty icon={CarFront} text="Pick a make to see its models." />
            ) : loadingModels ? (
              <ColumnSkeleton />
            ) : models.length === 0 ? (
              <ColumnEmpty icon={CarFront} text="No models listed for this make." />
            ) : (
              models.map((mod) => (
                <ListItem
                  key={mod.id}
                  onClick={() => {
                    if (selectedModel?.id !== mod.id) handleSelectModel(mod);
                    setMobileStep('variants');
                  }}
                  className={selectedModel?.id === mod.id ? 'md:bg-electric-50' : ''}
                  leading={<IconTile icon={CarFront} tone={selectedModel?.id === mod.id ? 'blue' : 'neutral'} />}
                  title={mod.name}
                  subtitle={[mod.bodyType, years(mod.yearFrom, mod.yearTo)].filter(Boolean).join(' · ')}
                  meta={plural(mod.variantsCount, 'variant', 'variants')}
                />
              ))
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
    </div>
  );
}

function CatalogColumn({
  title,
  count,
  onBack,
  backLabel,
  className = '',
  children,
}: {
  title: string;
  count?: number;
  onBack?: () => void;
  backLabel?: string;
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
      <Card className="flex flex-col overflow-hidden md:h-[560px]">
        <div className="flex items-center justify-between gap-2 border-b border-surface-200 px-4 py-3">
          <h2 className="truncate text-base font-semibold text-navy-900">{title}</h2>
          {count !== undefined && <span className="shrink-0 text-xs font-medium text-navy-500">{count}</span>}
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
