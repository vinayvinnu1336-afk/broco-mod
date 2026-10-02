'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  CarFront,
  Database,
  Search,
  ChevronRight,
  Shield,
  Layers,
  Fuel,
  Cpu,
  Globe
} from 'lucide-react';

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

export default function AdminVehicleMasterPage() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [selectedManufacturer, setSelectedManufacturer] = useState<Manufacturer | null>(null);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [variants, setVariants] = useState<VehicleVariant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);

  // Load Manufacturers
  const loadManufacturers = async (searchTerm = '') => {
    setLoading(true);
    const url = searchTerm
      ? `/vehicle-manufacturers?search=${encodeURIComponent(searchTerm)}`
      : '/vehicle-manufacturers';
    const res = await apiFetch<Manufacturer[]>(url);
    if (res.success && res.data) {
      setManufacturers(res.data);
      if (!selectedManufacturer && res.data.length > 0) {
        handleSelectManufacturer(res.data[0]);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadManufacturers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectManufacturer = async (m: Manufacturer) => {
    setSelectedManufacturer(m);
    setSelectedModel(null);
    setVariants([]);
    setLoadingModels(true);

    const res = await apiFetch<VehicleModel[]>(`/vehicle-manufacturers/${m.id}/models`);
    if (res.success && res.data) {
      setModels(res.data);
      if (res.data.length > 0) {
        handleSelectModel(res.data[0]);
      }
    }
    setLoadingModels(false);
  };

  const handleSelectModel = async (mod: VehicleModel) => {
    setSelectedModel(mod);
    setLoadingVariants(true);

    const res = await apiFetch<VehicleVariant[]>(`/vehicle-models/${mod.id}/variants`);
    if (res.success && res.data) {
      setVariants(res.data);
    }
    setLoadingVariants(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadManufacturers(search);
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy-900 uppercase tracking-tight">
            Vehicle Master Catalog
          </h1>
          <p className="text-xs text-navy-600 mt-1">
            Centralized OEM reference database: Manufacturers, Model Lines, Trim Variants, and Fuel Specifications.
          </p>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search manufacturer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-surface-300 rounded-xl text-xs text-navy-900 focus:outline-none focus:ring-2 focus:ring-electric-500"
          />
          <Search className="w-4 h-4 text-navy-400 absolute left-3 top-2.5" />
        </form>
      </div>

      {/* 3-Column Catalog Explorer */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Column 1: Manufacturers (4 cols) */}
        <div className="md:col-span-4 bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden flex flex-col h-[650px]">
          <div className="p-4 border-b border-surface-100 bg-surface-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-electric-600" />
              <span className="text-xs font-bold text-navy-900 uppercase tracking-wider">
                Manufacturers ({manufacturers.length})
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-surface-100 p-2">
            {loading ? (
              <div className="p-8 text-center text-xs text-navy-600">Loading catalog...</div>
            ) : manufacturers.length === 0 ? (
              <div className="p-8 text-center text-xs text-navy-600">No manufacturers found</div>
            ) : (
              manufacturers.map((m) => {
                const isSelected = selectedManufacturer?.id === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectManufacturer(m)}
                    className={`w-full p-3.5 rounded-xl text-left flex items-center justify-between transition ${
                      isSelected
                        ? 'bg-electric-50 border border-electric-300 text-electric-950 font-bold'
                        : 'hover:bg-surface-50 text-navy-900'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-bold">{m.name}</div>
                      <div className="text-[11px] text-navy-600 flex items-center gap-2 mt-0.5">
                        <span>{m.country}</span>
                        <span>•</span>
                        <span>{m.modelsCount} Models</span>
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 transition ${
                        isSelected ? 'text-electric-600 translate-x-0.5' : 'text-surface-300'
                      }`}
                    />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: Models (4 cols) */}
        <div className="md:col-span-4 bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden flex flex-col h-[650px]">
          <div className="p-4 border-b border-surface-100 bg-surface-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CarFront className="w-4 h-4 text-electric-600" />
              <span className="text-xs font-bold text-navy-900 uppercase tracking-wider">
                Models {selectedManufacturer ? `(${models.length})` : ''}
              </span>
            </div>
            {selectedManufacturer && (
              <span className="text-[10px] font-mono text-electric-600 font-bold uppercase bg-electric-100/50 px-2 py-0.5 rounded">
                {selectedManufacturer.name}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-surface-100 p-2">
            {!selectedManufacturer ? (
              <div className="p-8 text-center text-xs text-navy-600">Select a manufacturer to inspect models</div>
            ) : loadingModels ? (
              <div className="p-8 text-center text-xs text-navy-600">Loading models...</div>
            ) : models.length === 0 ? (
              <div className="p-8 text-center text-xs text-navy-600">No models found for this manufacturer</div>
            ) : (
              models.map((mod) => {
                const isSelected = selectedModel?.id === mod.id;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => handleSelectModel(mod)}
                    className={`w-full p-3.5 rounded-xl text-left flex items-center justify-between transition ${
                      isSelected
                        ? 'bg-electric-50 border border-electric-300 text-electric-950 font-bold'
                        : 'hover:bg-surface-50 text-navy-900'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-bold">{mod.name}</div>
                      <div className="text-[11px] text-navy-600 flex items-center gap-2 mt-0.5">
                        <span className="capitalize">{mod.bodyType}</span>
                        <span>•</span>
                        <span>{mod.yearFrom}–{mod.yearTo || 'Present'}</span>
                        <span>•</span>
                        <span>{mod.variantsCount} Trims</span>
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 transition ${
                        isSelected ? 'text-electric-600 translate-x-0.5' : 'text-surface-300'
                      }`}
                    />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Column 3: Variants / Trims (4 cols) */}
        <div className="md:col-span-4 bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden flex flex-col h-[650px]">
          <div className="p-4 border-b border-surface-100 bg-surface-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-electric-600" />
              <span className="text-xs font-bold text-navy-900 uppercase tracking-wider">
                Variants & Trims {selectedModel ? `(${variants.length})` : ''}
              </span>
            </div>
            {selectedModel && (
              <span className="text-[10px] font-mono text-electric-600 font-bold uppercase bg-electric-100/50 px-2 py-0.5 rounded">
                {selectedModel.name}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-surface-100 p-2">
            {!selectedModel ? (
              <div className="p-8 text-center text-xs text-navy-600">Select a model line to inspect variants</div>
            ) : loadingVariants ? (
              <div className="p-8 text-center text-xs text-navy-600">Loading variant specifications...</div>
            ) : variants.length === 0 ? (
              <div className="p-8 text-center text-xs text-navy-600">No specific trim variants listed</div>
            ) : (
              variants.map((v) => (
                <div key={v.id} className="p-3.5 rounded-xl hover:bg-surface-50 text-navy-900 transition">
                  <div className="text-sm font-bold text-navy-950">{v.name}</div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-[11px] text-navy-600">
                    <div className="flex items-center gap-1.5">
                      <Fuel className="w-3.5 h-3.5 text-electric-500" />
                      <span>{v.fuelType}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-navy-800">{v.transmission}</span>
                    </div>
                    {v.horsepower && (
                      <div>
                        <span className="text-navy-500">Power: </span>
                        <span className="font-semibold text-navy-900">{v.horsepower} HP</span>
                      </div>
                    )}
                    {v.engineDisplacementCc && (
                      <div>
                        <span className="text-navy-500">Displacement: </span>
                        <span className="font-semibold text-navy-900">{v.engineDisplacementCc} cc</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
