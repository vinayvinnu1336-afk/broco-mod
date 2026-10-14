'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Cylinder, Droplet, Flame, Fuel, Leaf, LucideIcon, Search, Zap } from 'lucide-react';
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

const FUEL_ICONS: Record<string, LucideIcon> = {
  petrol: Fuel,
  diesel: Droplet,
  cng: Cylinder,
  lpg: Flame,
  electric: Zap,
  hybrid: Leaf,
};

const fuelsOf = (m: CarModel) => (m.fuels?.length ? m.fuels : ['Petrol', 'Diesel']);

/**
 * Three-step car chooser: brand (with logos) → model → fuel. A near full-height bottom sheet on phones and
 * a fixed-size card on bigger screens, so it doesn't jump between steps.
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
  const backRef = useRef<HTMLButtonElement>(null);
  const firstFuelRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      // Start from the brand step next time.
      setStep('brand');
      setBrand(null);
      setModel(null);
      setQuery('');
      setError(null);
      return;
    }
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

  // Each step starts at the top, with focus where the next action is (the search box only with a
  // mouse, so phones don't pop the keyboard over the list).
  useEffect(() => {
    if (!isOpen) return;
    contentRef.current?.closest('[data-modal-body]')?.scrollTo({ top: 0 });
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const target = step === 'fuel' ? firstFuelRef.current : finePointer ? searchRef.current : step === 'model' ? backRef.current : null;
    target?.focus({ preventScroll: true });
  }, [isOpen, step]);

  const pickBrand = async (m: Manufacturer) => {
    setBrand(m);
    setQuery('');
    setError(null);
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
    const fuels = fuelsOf(m);
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

  // Enter in the search box picks the exact match, else the first one.
  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !term) return;
    e.preventDefault();
    const best = <T extends { name: string }>(list: T[]) => list.find((x) => x.name.toLowerCase() === term) ?? list[0];
    if (step === 'brand' && filteredBrands.length) pickBrand(best(filteredBrands));
    else if (step === 'model' && filteredModels.length) pickModel(best(filteredModels));
  };

  const title =
    step === 'brand' ? 'Select your car brand' : step === 'model' ? `Select your ${brand?.name ?? ''} model` : `Fuel type of your ${model?.name ?? 'car'}`;

  const subheader = (
    <div className="space-y-2">
      {step !== 'brand' && (
        <button
          ref={backRef}
          type="button"
          onClick={back}
          className="-ml-1 -mt-2 inline-flex min-h-[36px] max-w-full items-center sm:-mt-3 gap-1 rounded-lg px-1 text-sm font-semibold text-electric-700 hover:text-electric-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-600/40"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{step === 'model' ? 'All brands' : `${brand?.name} models`}</span>
        </button>
      )}

      {step !== 'fuel' && (
        <label className="relative block">
          <span className="sr-only">{step === 'brand' ? 'Search brands' : 'Search models'}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" aria-hidden />
          <input
            ref={searchRef}
            type="search"
            enterKeyHint="go"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder={step === 'brand' ? 'Search brand, e.g. Hyundai' : 'Search model, e.g. Swift'}
            className="h-11 w-full rounded-xl border border-surface-200 bg-surface-50 pl-9 pr-3 text-base text-navy-900 outline-none focus:border-electric-500 focus:bg-white focus:ring-2 focus:ring-electric-100"
          />
        </label>
      )}
    </div>
  );

  const fuels = model ? fuelsOf(model) : [];
  // Equal columns that fill the row: 2 on phones (an odd last option spans both), up to 3 from `sm`; 4 make a 2 × 2.
  const fuelCols =
    fuels.length <= 1 ? 'grid-cols-1' : fuels.length === 2 || fuels.length === 4 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg" fixedHeight subheader={subheader}>
      <div ref={contentRef} className="space-y-5">
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
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">Popular brands</h4>
                    <div className="grid grid-cols-3 gap-2 xs:grid-cols-4">
                      {popular.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => pickBrand(m)}
                          className="flex min-h-[84px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-surface-200 bg-white p-2 text-center transition hover:border-electric-300 hover:shadow-card focus:outline-none focus-visible:border-electric-500 focus-visible:ring-2 focus-visible:ring-electric-600/30 active:scale-[0.98]"
                        >
                          <BrandLogo name={m.name} logoUrl={m.logoUrl} size={36} />
                          <span className="line-clamp-2 max-w-full break-words text-[12px] font-medium leading-tight text-navy-800">{m.name}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                <section>
                  {!term && <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-surface-400">All brands</h4>}
                  {filteredBrands.length === 0 ? (
                    <p className="py-6 text-center text-sm text-surface-400">No brand matches “{query}”.</p>
                  ) : (
                    <ul className="divide-y divide-surface-100">
                      {filteredBrands.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => pickBrand(m)}
                            className="flex min-h-[52px] w-full min-w-0 items-center gap-3 rounded-lg py-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-600/30"
                          >
                            <BrandLogo name={m.name} logoUrl={m.logoUrl} size={32} />
                            <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-navy-900">{m.name}</span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-surface-300" aria-hidden />
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
              !error && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 rounded-xl" />
                  ))}
                </div>
              )
            ) : filteredModels.length === 0 ? (
              <p className="py-6 text-center text-sm text-surface-400">No model matches “{query}”.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {filteredModels.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => pickModel(m)}
                    className="flex min-h-[60px] min-w-0 flex-col items-start justify-center rounded-xl border border-surface-200 bg-white px-3 py-2 text-left transition hover:border-electric-300 hover:shadow-card focus:outline-none focus-visible:border-electric-500 focus-visible:ring-2 focus-visible:ring-electric-600/30 active:scale-[0.98]"
                  >
                    <span className="line-clamp-2 max-w-full break-words text-[15px] font-semibold leading-tight text-navy-900">{m.name}</span>
                    <span className="mt-0.5 max-w-full truncate text-xs text-surface-400">
                      {m.bodyType}
                      {m.yearTo ? ` · till ${m.yearTo}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {step === 'fuel' && brand && model && (
          <>
            <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-surface-50 p-3 ring-1 ring-inset ring-surface-200">
              <BrandLogo name={brand.name} logoUrl={brand.logoUrl} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-navy-500">{brand.name}</p>
                <p className="truncate text-base font-bold leading-snug text-navy-900">{model.name}</p>
              </div>
              {model.bodyType && (
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-navy-600 ring-1 ring-inset ring-surface-200">
                  {model.bodyType}
                </span>
              )}
            </div>

            <div className={`grid gap-3 ${fuelCols}`}>
              {fuels.map((fuel, i) => {
                const Icon = FUEL_ICONS[fuel.toLowerCase()] ?? Fuel;
                const spanBoth = fuels.length % 2 === 1 && fuels.length > 1 && i === fuels.length - 1;
                return (
                  <button
                    key={fuel}
                    ref={i === 0 ? firstFuelRef : undefined}
                    type="button"
                    onClick={() => pickFuel(fuel)}
                    className={`flex min-h-[104px] min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border border-surface-200 bg-white p-3 text-center transition hover:border-electric-400 hover:shadow-card focus:outline-none focus-visible:border-electric-500 focus-visible:ring-2 focus-visible:ring-electric-600/30 active:scale-[0.98] ${
                      spanBoth ? 'col-span-2 sm:col-span-1' : ''
                    }`}
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-50 text-electric-600" aria-hidden>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="max-w-full break-words text-[15px] font-semibold leading-tight text-navy-900">{fuel}</span>
                  </button>
                );
              })}
            </div>

            <p className="text-center text-xs leading-relaxed text-navy-400">Not sure? It&apos;s on your RC and near the fuel lid.</p>
          </>
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
  const text = hasValue
    ? `${value?.manufacturerName ?? ''} ${value?.modelName ?? ''}${value?.fuelType ? `, ${value.fuelType}` : ''}`.trim()
    : placeholder;
  return (
    <div className={`min-w-0 ${className}`}>
      {label && <span className="mb-1.5 block text-sm font-medium text-navy-800">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        title={hasValue ? text : undefined}
        className={`flex min-h-[52px] w-full min-w-0 items-center gap-3 rounded-xl border bg-white px-3 text-left transition focus:outline-none focus-visible:border-electric-600 focus-visible:ring-2 focus-visible:ring-electric-600/30 ${
          error ? 'border-semantic-error' : 'border-surface-300 hover:border-electric-400'
        }`}
      >
        {hasValue && value?.manufacturerName ? (
          <BrandLogo name={value.manufacturerName} logoUrl={value.logoUrl} size={32} />
        ) : null}
        <span className={`min-w-0 flex-1 truncate text-[15px] ${hasValue ? 'font-semibold text-navy-900' : 'font-medium text-navy-400'}`}>
          {text}
        </span>
        <ChevronDown className="mr-0.5 h-4 w-4 shrink-0 text-navy-400" aria-hidden />
      </button>
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-semantic-error">
          {error}
        </p>
      )}
      <CarPicker isOpen={open} onClose={() => setOpen(false)} onSelect={onChange} />
    </div>
  );
};
