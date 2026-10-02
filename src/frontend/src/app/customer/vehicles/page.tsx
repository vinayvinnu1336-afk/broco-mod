'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Car,
  Plus,
  Star,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Fuel,
  Settings2,
  Calendar,
  Gauge,
  Shield,
  Layers,
  Sparkles
} from 'lucide-react';

interface CustomerVehicle {
  id: string;
  customerId: string;
  manufacturerId: string;
  make: string;
  modelId: string;
  model: string;
  variantId?: string | null;
  variantName?: string | null;
  year: number;
  fuelType: string;
  transmission: string;
  licensePlate: string;
  vin: string;
  mileage: number;
  color: string;
  isPrimary: boolean;
  isActive: boolean;
  createdAtUtc: string;
}

interface Manufacturer {
  id: string;
  name: string;
  country: string;
  logoUrl: string;
  modelsCount: number;
}

interface VehicleModel {
  id: string;
  manufacturerId: string;
  name: string;
  bodyType: string;
  yearFrom: number;
  yearTo: number | null;
  variantsCount: number;
}

interface VehicleVariant {
  id: string;
  modelId: string;
  name: string;
  transmission: string;
  fuelType: string;
  engineDisplacementCc: number | null;
  horsepower: number | null;
  yearFrom: number;
  yearTo: number | null;
}

interface FuelTypeOption {
  value: number;
  name: string;
  displayName: string;
}

const FUEL_TYPE_MAP: Record<string, number> = {
  Petrol: 1,
  Diesel: 2,
  Electric: 3,
  Hybrid: 4,
  PlugInHybrid: 5,
  CNG: 6,
  LPG: 7,
};

export default function CustomerVehiclesPage() {
  const [vehicles, setVehicles] = useState<CustomerVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Master Data state
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [fuelTypes, setFuelTypes] = useState<FuelTypeOption[]>([]);

  // Modal & Edit State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);

  // Form Fields
  const [selectedManufacturerId, setSelectedManufacturerId] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<VehicleModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [availableVariants, setAvailableVariants] = useState<VehicleVariant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);

  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [fuelType, setFuelType] = useState<string>('Petrol');
  const [transmission, setTransmission] = useState<string>('Automatic');
  const [licensePlate, setLicensePlate] = useState<string>('');
  const [vin, setVin] = useState<string>('');
  const [mileage, setMileage] = useState<number>(0);
  const [color, setColor] = useState<string>('');
  const [isPrimary, setIsPrimary] = useState<boolean>(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load customer vehicles
  const loadVehicles = async () => {
    const res = await apiFetch<CustomerVehicle[]>('/customer/vehicles');
    if (res.success && res.data) {
      setVehicles(res.data);
    }
    setLoading(false);
  };

  // Load Master Manufacturers and Fuel Types
  useEffect(() => {
    loadVehicles();

    // Fetch manufacturers
    apiFetch<Manufacturer[]>('/vehicle-manufacturers').then((res) => {
      if (res.success && res.data) {
        setManufacturers(res.data);
      }
    });

    // Fetch fuel types
    apiFetch<FuelTypeOption[]>('/vehicle-master/fuel-types').then((res) => {
      if (res.success && res.data) {
        setFuelTypes(res.data);
      }
    });
  }, []);

  // When manufacturer changes, load its models
  const handleManufacturerChange = async (manufacturerId: string) => {
    setSelectedManufacturerId(manufacturerId);
    setSelectedModelId('');
    setAvailableModels([]);
    setSelectedVariantId('');
    setAvailableVariants([]);

    if (!manufacturerId) return;

    setLoadingModels(true);
    const res = await apiFetch<VehicleModel[]>(`/vehicle-manufacturers/${manufacturerId}/models`);
    if (res.success && res.data) {
      setAvailableModels(res.data);
    }
    setLoadingModels(false);
  };

  // When model changes, load its variants
  const handleModelChange = async (modelId: string) => {
    setSelectedModelId(modelId);
    setSelectedVariantId('');
    setAvailableVariants([]);

    if (!modelId) return;

    const chosenModel = availableModels.find((m) => m.id === modelId);
    if (chosenModel) {
      setYear(chosenModel.yearFrom || new Date().getFullYear());
    }

    setLoadingVariants(true);
    const res = await apiFetch<VehicleVariant[]>(`/vehicle-models/${modelId}/variants`);
    if (res.success && res.data) {
      setAvailableVariants(res.data);
    }
    setLoadingVariants(false);
  };

  // When variant changes, auto-populate fuel type and transmission
  const handleVariantChange = (variantId: string) => {
    setSelectedVariantId(variantId);
    if (!variantId) return;

    const chosenVariant = availableVariants.find((v) => v.id === variantId);
    if (chosenVariant) {
      if (chosenVariant.fuelType) setFuelType(chosenVariant.fuelType);
      if (chosenVariant.transmission) setTransmission(chosenVariant.transmission);
    }
  };

  // Allowed year range for selected model
  const selectedModel = useMemo(() => {
    return availableModels.find((m) => m.id === selectedModelId);
  }, [availableModels, selectedModelId]);

  const yearRange = useMemo(() => {
    const min = selectedModel ? selectedModel.yearFrom : 1990;
    const max = selectedModel && selectedModel.yearTo ? selectedModel.yearTo : new Date().getFullYear() + 1;
    const years: number[] = [];
    for (let y = max; y >= min; y--) {
      years.push(y);
    }
    return years;
  }, [selectedModel]);

  // Open modal in Add mode
  const openAddModal = () => {
    setEditingVehicleId(null);
    setSelectedManufacturerId('');
    setSelectedModelId('');
    setSelectedVariantId('');
    setAvailableModels([]);
    setAvailableVariants([]);
    setYear(new Date().getFullYear());
    setFuelType('Petrol');
    setTransmission('Automatic');
    setLicensePlate('');
    setVin('');
    setMileage(0);
    setColor('');
    setIsPrimary(vehicles.length === 0);
    setFormError(null);
    setModalOpen(true);
  };

  // Open modal in Edit mode
  const openEditModal = async (v: CustomerVehicle) => {
    setEditingVehicleId(v.id);
    setFormError(null);
    setSelectedManufacturerId(v.manufacturerId);

    // Preload models for this manufacturer
    setLoadingModels(true);
    const mRes = await apiFetch<VehicleModel[]>(`/vehicle-manufacturers/${v.manufacturerId}/models`);
    if (mRes.success && mRes.data) {
      setAvailableModels(mRes.data);
    }
    setLoadingModels(false);

    setSelectedModelId(v.modelId);

    // Preload variants for this model
    setLoadingVariants(true);
    const vRes = await apiFetch<VehicleVariant[]>(`/vehicle-models/${v.modelId}/variants`);
    if (vRes.success && vRes.data) {
      setAvailableVariants(vRes.data);
    }
    setLoadingVariants(false);

    setSelectedVariantId(v.variantId || '');
    setYear(v.year);
    setFuelType(v.fuelType);
    setTransmission(v.transmission);
    setLicensePlate(v.licensePlate);
    setVin(v.vin || '');
    setMileage(v.mileage || 0);
    setColor(v.color || '');
    setIsPrimary(v.isPrimary);
    setModalOpen(true);
  };

  // Submit Add or Edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedManufacturerId || !selectedModelId) {
      setFormError('Please select both a vehicle manufacturer and model.');
      return;
    }

    if (!licensePlate.trim()) {
      setFormError('License plate is required.');
      return;
    }

    setFormSubmitting(true);

    const fuelTypeValue = FUEL_TYPE_MAP[fuelType] || 1;

    const payload = {
      manufacturerId: selectedManufacturerId,
      modelId: selectedModelId,
      variantId: selectedVariantId || null,
      year: Number(year),
      fuelType: fuelTypeValue,
      transmission: transmission.trim() || 'Automatic',
      licensePlate: licensePlate.trim().toUpperCase(),
      vin: vin.trim().toUpperCase(),
      mileage: Number(mileage),
      color: color.trim(),
      isPrimary: Boolean(isPrimary),
    };

    let res;
    if (editingVehicleId) {
      res = await apiFetch<CustomerVehicle>(`/customer/vehicles/${editingVehicleId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      res = await apiFetch<CustomerVehicle>('/customer/vehicles', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    setFormSubmitting(false);

    if (res.success) {
      setModalOpen(false);
      setStatusMessage({
        type: 'success',
        text: editingVehicleId ? 'Vehicle specifications updated.' : 'New vehicle registered successfully.',
      });
      await loadVehicles();
      setTimeout(() => setStatusMessage(null), 4000);
    } else {
      setFormError(res.message || res.errors?.[0] || 'Failed to save vehicle. Please review required specifications.');
    }
  };

  // Set as Primary Vehicle
  const handleSetPrimary = async (vehicleId: string) => {
    setActionLoading(vehicleId);
    const res = await apiFetch(`/customer/vehicles/${vehicleId}/set-primary`, {
      method: 'POST',
    });
    setActionLoading(null);

    if (res.success) {
      setStatusMessage({ type: 'success', text: 'Primary vehicle updated.' });
      await loadVehicles();
      setTimeout(() => setStatusMessage(null), 3000);
    } else {
      setStatusMessage({ type: 'error', text: res.message || res.errors?.[0] || 'Failed to update primary vehicle.' });
    }
  };

  // Delete Vehicle
  const handleDelete = async (vehicleId: string) => {
    if (!confirm('Are you sure you want to remove this vehicle from your profile?')) {
      return;
    }

    setActionLoading(vehicleId);
    const res = await apiFetch(`/customer/vehicles/${vehicleId}`, {
      method: 'DELETE',
    });
    setActionLoading(null);

    if (res.success) {
      setStatusMessage({ type: 'success', text: 'Vehicle removed from your garage.' });
      await loadVehicles();
      setTimeout(() => setStatusMessage(null), 3000);
    } else {
      setStatusMessage({ type: 'error', text: res.message || res.errors?.[0] || 'Failed to remove vehicle.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-navy-900 uppercase">My Registered Vehicles</h1>
          <p className="text-xs text-navy-600 mt-1">
            Standardized garage inventory linked to verified OEM manufacturer specifications and workshop dispatches.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2.5 bg-electric-500 hover:bg-electric-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-md shadow-electric-500/25 transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Vehicle</span>
        </button>
      </div>

      {/* Status Banners */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium flex items-center gap-2.5 border transition ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Vehicles Grid / Empty State */}
      {loading ? (
        <div className="py-16 text-center text-sm text-navy-600 flex flex-col items-center justify-center gap-2">
          <div className="w-8 h-8 border-2 border-electric-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading vehicle catalog from database...</span>
        </div>
      ) : vehicles.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {vehicles.map((v) => (
            <div
              key={v.id}
              className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden relative ${
                v.isPrimary
                  ? 'border-electric-500 shadow-md ring-1 ring-electric-500/20'
                  : 'border-surface-200 hover:border-surface-300 shadow-sm'
              }`}
            >
              {/* Primary Ribbon */}
              {v.isPrimary && (
                <div className="bg-gradient-to-r from-electric-600 to-electric-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 flex items-center gap-1.5">
                  <Star className="w-3 h-3 fill-current text-amber-300" />
                  <span>Primary Service Vehicle</span>
                </div>
              )}

              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold text-electric-600 uppercase tracking-widest">
                        {v.year}
                      </span>
                      <span className="text-surface-300">•</span>
                      <span className="text-xs font-semibold text-navy-700 uppercase">
                        {v.make}
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-navy-950 tracking-tight">
                      {v.model}
                    </h3>
                    {v.variantName && (
                      <p className="text-xs font-semibold text-electric-700 mt-0.5">
                        {v.variantName}
                      </p>
                    )}
                  </div>

                  {/* License Plate Badge */}
                  <div className="flex flex-col items-end">
                    <div className="border-2 border-navy-900 bg-surface-50 text-navy-950 font-mono font-black text-xs px-2.5 py-1 rounded-md tracking-wider shadow-inner">
                      {v.licensePlate}
                    </div>
                    {v.color && (
                      <span className="text-[11px] text-navy-600 mt-1 capitalize font-medium">
                        {v.color}
                      </span>
                    )}
                  </div>
                </div>

                {/* Specs Pill List */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5 pt-4 border-t border-surface-100 text-xs">
                  <div className="bg-surface-50 rounded-xl p-2.5 border border-surface-200/60">
                    <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-navy-600 mb-0.5">
                      <Fuel className="w-3 h-3 text-electric-500" />
                      <span>Fuel</span>
                    </div>
                    <span className="font-semibold text-navy-900">{v.fuelType}</span>
                  </div>

                  <div className="bg-surface-50 rounded-xl p-2.5 border border-surface-200/60">
                    <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-navy-600 mb-0.5">
                      <Settings2 className="w-3 h-3 text-electric-500" />
                      <span>Gearbox</span>
                    </div>
                    <span className="font-semibold text-navy-900 truncate block">{v.transmission}</span>
                  </div>

                  <div className="bg-surface-50 rounded-xl p-2.5 border border-surface-200/60">
                    <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-navy-600 mb-0.5">
                      <Gauge className="w-3 h-3 text-electric-500" />
                      <span>Mileage</span>
                    </div>
                    <span className="font-semibold text-navy-900">{v.mileage.toLocaleString()} KM</span>
                  </div>

                  <div className="bg-surface-50 rounded-xl p-2.5 border border-surface-200/60">
                    <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-navy-600 mb-0.5">
                      <Calendar className="w-3 h-3 text-electric-500" />
                      <span>Year</span>
                    </div>
                    <span className="font-semibold text-navy-900">{v.year}</span>
                  </div>
                </div>

                {/* VIN Row */}
                {v.vin && (
                  <div className="mt-3 text-[11px] text-navy-600 flex items-center gap-1.5 bg-surface-50/50 px-3 py-1.5 rounded-lg border border-surface-100">
                    <Shield className="w-3.5 h-3.5 text-navy-400" />
                    <span className="font-mono uppercase tracking-wide truncate">VIN: {v.vin}</span>
                  </div>
                )}

                {/* Card Actions */}
                <div className="flex items-center justify-between mt-5 pt-4 border-t border-surface-100 text-xs">
                  <div>
                    {!v.isPrimary && (
                      <button
                        type="button"
                        disabled={actionLoading === v.id}
                        onClick={() => handleSetPrimary(v.id)}
                        className="text-xs font-bold text-electric-600 hover:text-electric-700 flex items-center gap-1 transition"
                      >
                        <Star className="w-3.5 h-3.5" />
                        <span>Set as Default</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={actionLoading === v.id}
                      onClick={() => openEditModal(v)}
                      className="p-2 text-navy-600 hover:text-navy-950 hover:bg-surface-100 rounded-lg transition"
                      title="Edit specifications"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading === v.id}
                      onClick={() => handleDelete(v.id)}
                      className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                      title="Delete vehicle"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 bg-white rounded-2xl border border-dashed border-surface-300 text-center p-8 max-w-lg mx-auto shadow-sm">
          <div className="w-14 h-14 bg-surface-100 rounded-2xl flex items-center justify-center text-navy-400 mx-auto mb-3 border border-surface-200">
            <Car className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-navy-900">No Vehicles in Your Garage</h3>
          <p className="text-xs text-navy-600 mt-1 mb-5">
            Add your vehicle from our standardized OEM master catalog to receive custom tuning bids and service matching from certified local workshops.
          </p>
          <button
            onClick={openAddModal}
            className="px-5 py-2.5 bg-electric-500 hover:bg-electric-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add First Vehicle</span>
          </button>
        </div>
      )}

      {/* Add / Edit Vehicle Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-navy-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-surface-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-surface-100">
              <div>
                <h3 className="text-lg font-black text-navy-900 uppercase tracking-tight">
                  {editingVehicleId ? 'Edit Vehicle Specifications' : 'Add Vehicle to Garage'}
                </h3>
                <p className="text-xs text-navy-600 mt-0.5">
                  Select your OEM manufacturer, model line, and variant from the master catalog.
                </p>
              </div>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Step 1: Manufacturer */}
              <div>
                <label className="block text-xs font-bold text-navy-800 uppercase tracking-wider mb-1">
                  1. Manufacturer / Make <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedManufacturerId}
                  onChange={(e) => handleManufacturerChange(e.target.value)}
                  className="block w-full px-3 py-2.5 border border-surface-300 rounded-xl text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-electric-500"
                  required
                >
                  <option value="">-- Choose Manufacturer (e.g. BMW, Audi, Porsche) --</option>
                  {manufacturers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.country})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Model (Cascading) */}
              <div>
                <label className="block text-xs font-bold text-navy-800 uppercase tracking-wider mb-1">
                  2. Model Line <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedModelId}
                  onChange={(e) => handleModelChange(e.target.value)}
                  disabled={!selectedManufacturerId || loadingModels}
                  className="block w-full px-3 py-2.5 border border-surface-300 rounded-xl text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-electric-500 disabled:bg-surface-100 disabled:opacity-60"
                  required
                >
                  <option value="">
                    {loadingModels
                      ? 'Loading models from catalog...'
                      : !selectedManufacturerId
                      ? '-- Select manufacturer first --'
                      : '-- Choose Model Line --'}
                  </option>
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.bodyType}) [{m.yearFrom}–{m.yearTo || 'Present'}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 3: Variant (Cascading) */}
              <div>
                <label className="block text-xs font-bold text-navy-800 uppercase tracking-wider mb-1">
                  3. Variant / Trim Specification <span className="text-navy-400 font-normal">(Optional)</span>
                </label>
                <select
                  value={selectedVariantId}
                  onChange={(e) => handleVariantChange(e.target.value)}
                  disabled={!selectedModelId || loadingVariants}
                  className="block w-full px-3 py-2.5 border border-surface-300 rounded-xl text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-electric-500 disabled:bg-surface-100 disabled:opacity-60"
                >
                  <option value="">
                    {loadingVariants
                      ? 'Loading variants...'
                      : !selectedModelId
                      ? '-- Select model first --'
                      : availableVariants.length === 0
                      ? 'No specific variants listed (Base model)'
                      : '-- Choose Variant / Engine Trim --'}
                  </option>
                  {availableVariants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} • {v.transmission} • {v.fuelType}{' '}
                      {v.horsepower ? `(${v.horsepower} HP)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 4: Model Year, Fuel Type, Transmission */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-navy-800 uppercase tracking-wider mb-1">
                    Model Year <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="block w-full px-3 py-2.5 border border-surface-300 rounded-xl text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-electric-500"
                    required
                  >
                    {yearRange.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-navy-800 uppercase tracking-wider mb-1">
                    Fuel Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value)}
                    className="block w-full px-3 py-2.5 border border-surface-300 rounded-xl text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-electric-500"
                    required
                  >
                    {fuelTypes.map((ft) => (
                      <option key={ft.value} value={ft.name}>
                        {ft.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-navy-800 uppercase tracking-wider mb-1">
                    Transmission
                  </label>
                  <select
                    value={transmission}
                    onChange={(e) => setTransmission(e.target.value)}
                    className="block w-full px-3 py-2.5 border border-surface-300 rounded-xl text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-electric-500"
                  >
                    <option value="Automatic">Automatic</option>
                    <option value="Manual">Manual</option>
                    <option value="Dual-Clutch">Dual-Clutch (DCT)</option>
                    <option value="Direct Drive">Direct Drive (EV)</option>
                  </select>
                </div>
              </div>

              {/* Step 5: Identification & Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-navy-800 uppercase tracking-wider mb-1">
                    License Plate <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                    placeholder="e.g. BROCO-01"
                    className="block w-full px-3 py-2.5 border border-surface-300 rounded-xl text-sm font-mono uppercase text-navy-900 focus:outline-none focus:ring-2 focus:ring-electric-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-navy-800 uppercase tracking-wider mb-1">
                    Odometer Mileage (KM)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={2000000}
                    value={mileage}
                    onChange={(e) => setMileage(Number(e.target.value))}
                    className="block w-full px-3 py-2.5 border border-surface-300 rounded-xl text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-electric-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-navy-800 uppercase tracking-wider mb-1">
                    Exterior Color
                  </label>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="e.g. Portimao Blue, Nardo Grey"
                    className="block w-full px-3 py-2.5 border border-surface-300 rounded-xl text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-electric-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-navy-800 uppercase tracking-wider mb-1">
                    VIN (Chassis Number)
                  </label>
                  <input
                    type="text"
                    value={vin}
                    onChange={(e) => setVin(e.target.value.toUpperCase())}
                    placeholder="17-character VIN"
                    className="block w-full px-3 py-2.5 border border-surface-300 rounded-xl text-sm font-mono uppercase text-navy-900 focus:outline-none focus:ring-2 focus:ring-electric-500"
                  />
                </div>
              </div>

              {/* Step 6: Primary Checkbox */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-navy-900">
                  <input
                    type="checkbox"
                    checked={isPrimary}
                    onChange={(e) => setIsPrimary(e.target.checked)}
                    className="w-4 h-4 text-electric-600 rounded border-surface-300 focus:ring-electric-500"
                  />
                  <span>Set as primary vehicle for quotes and dispatch requests</span>
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-200 mt-5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 border border-surface-300 text-navy-700 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-surface-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2.5 bg-electric-500 hover:bg-electric-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md shadow-electric-500/25 transition disabled:opacity-50"
                >
                  {formSubmitting
                    ? 'Saving...'
                    : editingVehicleId
                    ? 'Update Vehicle'
                    : 'Register Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
