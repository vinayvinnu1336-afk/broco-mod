'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Fuel, Search } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { BrandLogo } from '@/components/catalogue/BrandLogo';
import { CarModel, Manufacturer, catalogueApi } from '@/lib/catalogue';

export interface CarSelection {
  manufacturer: Manufacturer;
  model: CarModel;
  fuelType: string;
}

type Step = 'brand' | 'model' | 'fuel';

export interface CarPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selection: CarSelection) => void;
}

let manufacturersCache: Manufacturer[] | null = null;
const modelsCache = new Map<string, CarModel[]>();

/**
 * Three-step car chooser: brand (with logos) → model → fuel. Bottom sheet on phones.
 */
export const CarPicker: React.FC<CarPickerProps> = ({ isOpen, onClose, onSelect }) => {
  const [step, setStep] = useState<Step>('brand');
  const [manufacturers, setManufacturers] = useState<Manufacturer[] | null>(manufacturersCache);
  const [models, setModels] = useState<CarModel[] | null>(null);
  const [brand, setBrand] = useState<Manufacturer | null>(null);
  const [model, setModel] = useState<CarModel | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep('brand');
    setBrand(null);
    setModel(null);
    setQuery('');
    if (!manufacturersCache) {
      catalogueApi.manufacturers().then((res) => {
        if (res.success && res.data) {
          manufacturersCache = res.data;
          setManufacturers(res.data);
        } else {
          setError(res.message || 'Could not load car brands.');
        }
      });
    }
  }, [isOpen]);

  const pickBrand = async (m: Manufacturer) => {
    setBrand(m);
    setQuery('');
    setStep('model');
    const cached = modelsCache.get(m.id);
    if (cached) {
      setModels(cached);
      return;
    }
    setModels(null);
    const res = await catalogueApi.models(m.id);
    if (res.success && res.data) {
      modelsCache.set(m.id, res.data);
      setModels(res.data);
    } else {
      setError(res.message || 'Could not load models.');
    }
  };

  const pickModel = (m: CarModel) => {
    setModel(m);
    const fuels = m.fuels?.length ? m.fuels : ['Petrol', 'Diesel'];
    if (fuels.length === 1 && brand) {
      onSelect({ manufacturer: brand, model: m, fuelType: fuels[0] });
      onClose();
      return;
    }
    setStep('fuel');
  };

  const pickFuel = (fuel: string) => {
    if (!brand || !model) return;
    onSelect({ manufacturer: brand, model, fuelType: fuel });
    onClose();
  };

  const back = () => {
    setQuery('');
    setStep(step === 'fuel' ? 'model' : 'brand');
  };

  const term = query.trim().toLowerCase();
  const popular = useMemo(() => (manufacturers || []).filter((m) => m.isPopular), [manufacturers]);
  const filteredBrands = useMemo(
    () => (manufacturers || []).filter((m) => !term || m.name.toLowerCase().includes(term)).sort((a, b) => a.name.localeCompare(b.name)),
    [manufacturers, term]
  );
  const filteredModels = useMemo(
    () => (models || []).filter((m) => !term || m.name.toLowerCase().includes(term)),
    [models, term]
  );

  const title =
    step === 'brand' ? 'Select your car brand' : step === 'model' ? `Select your ${brand?.name ?? ''} model` : `Fuel type of your ${model?.name ?? 'car'}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div className="space-y-4">
        {step !== 'brand' && (
          <button
            type="button"
            onClick={back}
            className="-mt-1 inline-flex min-h-[36px] items-center gap-1 text-sm font-semibold text-electric-700"
          >
            <ChevronLeft className="h-4 w-4" /> {step === 'model' ? 'All brands' : `${brand?.name} models`}
          </button>
        )}

        {step !== 'fuel' && (
          <label className="relative block">
            <span className="sr-only">{step === 'brand' ? 'Search brands' : 'Search models'}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={step === 'brand' ? 'Search brand, e.g. Hyundai' : 'Search model, e.g. Swift'}
              className="h-11 w-full rounded-xl border border-surface-200 bg-surface-50 pl-9 pr-3 text-base text-navy-900 outline-none focus:border-electric-500 focus:bg-white focus:ring-2 focus:ring-electric-100"
            />
          </label>
        )}

        {error && <p className="rounded-lg bg-semantic-errorBg px-3 py-2 text-sm text-semantic-error">{error}</p>}

        {step === 'brand' && (
          <>
            {!manufacturers ? (
              <div className="grid grid-cols-3 gap-2 xs:grid-cols-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="h-[84px] rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                {!term && popular.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">Popular brands</h3>
                    <div className="grid grid-cols-3 gap-2 xs:grid-cols-4">
                      {popular.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => pickBrand(m)}
                          className="flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-xl border border-surface-200 bg-white p-2 text-center transition hover:border-electric-300 hover:shadow-card active:scale-[0.98]"
                        >
                          <BrandLogo name={m.name} logoUrl={m.logoUrl} size={36} />
                          <span className="line-clamp-2 text-[12px] font-medium leading-tight text-navy-800">{m.name}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                <section>
                  {!term && <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-surface-400">All brands</h3>}
                  {filteredBrands.length === 0 ? (
                    <p className="py-6 text-center text-sm text-surface-400">No brand matches “{query}”.</p>
                  ) : (
                    <ul className="divide-y divide-surface-100">
                      {filteredBrands.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => pickBrand(m)}
                            className="flex min-h-[52px] w-full items-center gap-3 py-1.5 text-left"
                          >
                            <BrandLogo name={m.name} logoUrl={m.logoUrl} size={32} />
                            <span className="flex-1 text-[15px] font-medium text-navy-900">{m.name}</span>
                            <ChevronRight className="h-4 w-4 text-surface-300" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </>
        )}

        {step === 'model' && (
          <>
            {!models ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-xl" />
                ))}
              </div>
            ) : filteredModels.length === 0 ? (
              <p className="py-6 text-center text-sm text-surface-400">No model matches “{query}”.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {filteredModels.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => pickModel(m)}
                    className="flex min-h-[56px] flex-col items-start justify-center rounded-xl border border-surface-200 bg-white px-3 py-2 text-left transition hover:border-electric-300 hover:shadow-card active:scale-[0.98]"
                  >
                    <span className="text-[15px] font-semibold leading-tight text-navy-900">{m.name}</span>
                    <span className="text-xs text-surface-400">
                      {m.bodyType}
                      {m.yearTo ? ` · till ${m.yearTo}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {step === 'fuel' && model && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(model.fuels?.length ? model.fuels : ['Petrol', 'Diesel']).map((fuel) => (
              <button
                key={fuel}
                type="button"
                onClick={() => pickFuel(fuel)}
                className="flex min-h-[64px] items-center gap-3 rounded-xl border border-surface-200 bg-white px-3 text-left transition hover:border-electric-300 hover:shadow-card active:scale-[0.98]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-electric-50 text-electric-600">
                  <Fuel className="h-4 w-4" />
                </span>
                <span className="text-[15px] font-semibold text-navy-900">{fuel}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

export interface CarSelectFieldProps {
  value: { manufacturerName?: string; modelName?: string; fuelType?: string; logoUrl?: string | null } | null;
  onChange: (selection: CarSelection) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  error?: string;
}

/** A form field that looks like a select ("HYUNDAI I10, PETROL") and opens the CarPicker. */
export const CarSelectField: React.FC<CarSelectFieldProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Select your car',
  className = '',
  error,
}) => {
  const [open, setOpen] = useState(false);
  const hasValue = !!value?.modelName;
  return (
    <div className={className}>
      {label && <span className="mb-1.5 block text-sm font-medium text-navy-800">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl border bg-white px-3 text-left transition focus:outline-none focus:ring-2 focus:ring-electric-100 ${
          error ? 'border-semantic-error' : 'border-surface-300 hover:border-electric-400'
        }`}
      >
        {hasValue && value?.manufacturerName ? (
          <BrandLogo name={value.manufacturerName} logoUrl={value.logoUrl} size={32} />
        ) : null}
        <span className={`min-w-0 flex-1 truncate text-[15px] font-semibold uppercase tracking-wide ${hasValue ? 'text-navy-900' : 'text-surface-400'}`}>
          {hasValue ? `${value?.manufacturerName ?? ''} ${value?.modelName ?? ''}${value?.fuelType ? `, ${value.fuelType}` : ''}` : placeholder}
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 text-navy-700" />
      </button>
      {error && <p className="mt-1 text-sm text-semantic-error">{error}</p>}
      <CarPicker isOpen={open} onClose={() => setOpen(false)} onSelect={onChange} />
    </div>
  );
};
