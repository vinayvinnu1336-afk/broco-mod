'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { Car, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { BrandLogo } from '@/components/catalogue/BrandLogo';
import { CarSelectField, CarSelection } from '@/components/catalogue/CarPicker';
import { catalogueApi } from '@/lib/catalogue';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

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

/** The brand / model / fuel chosen in the car picker. */
interface CarChoice {
  manufacturerId: string;
  manufacturerName: string;
  logoUrl?: string | null;
  modelId: string;
  modelName: string;
  yearFrom: number;
  yearTo: number | null;
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

const TRANSMISSIONS = [
  { value: 'Automatic', label: 'Automatic' },
  { value: 'Manual', label: 'Manual' },
  { value: 'Dual-Clutch', label: 'Dual-clutch (DCT)' },
  { value: 'Direct Drive', label: 'Direct drive (EV)' },
];

export default function CustomerVehiclesPage() {
  const toast = useToast();
  const [vehicles, setVehicles] = useState<CustomerVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CustomerVehicle | null>(null);
  const [editLoadingId, setEditLoadingId] = useState<string | null>(null);

  // Brand logos for the list
  const [logos, setLogos] = useState<Record<string, string>>({});

  // Modal & edit state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);

  // Form fields
  const [car, setCar] = useState<CarChoice | null>(null);
  const [availableVariants, setAvailableVariants] = useState<VehicleVariant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);

  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [year, setYear] = useState<number | ''>('');
  const [fuelType, setFuelType] = useState<string>('Petrol');
  const [transmission, setTransmission] = useState<string>('Automatic');
  const [licensePlate, setLicensePlate] = useState<string>('');
  const [vin, setVin] = useState<string>('');
  const [mileage, setMileage] = useState<number>(0);
  const [color, setColor] = useState<string>('');
  const [isPrimary, setIsPrimary] = useState<boolean>(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadVehicles = useCallback(async () => {
    const res = await apiFetch<CustomerVehicle[]>('/customer/vehicles');
    if (res.success && res.data) {
      setVehicles(res.data);
      setLoadError(null);
    } else {
      setLoadError(res.message || 'Unable to load your vehicles.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadVehicles();

    catalogueApi.manufacturers().then((res) => {
      if (res.success && res.data) {
        setLogos(Object.fromEntries(res.data.map((m) => [m.id, m.logoUrl])));
      }
    });
  }, [loadVehicles]);

  const loadVariants = async (modelId: string) => {
    setAvailableVariants([]);
    setLoadingVariants(true);
    const res = await apiFetch<VehicleVariant[]>(`/vehicle-models/${modelId}/variants`);
    if (res.success && res.data) {
      setAvailableVariants(res.data);
    }
    setLoadingVariants(false);
  };

  const handleCarPicked = (sel: CarSelection) => {
    const modelChanged = sel.model.id !== car?.modelId;
    const maxYear = sel.model.yearTo ?? new Date().getFullYear();
    setCar({
      manufacturerId: sel.manufacturer.id,
      manufacturerName: sel.manufacturer.name,
      logoUrl: sel.manufacturer.logoUrl,
      modelId: sel.model.id,
      modelName: sel.model.name,
      yearFrom: sel.model.yearFrom,
      yearTo: sel.model.yearTo,
    });
    setFuelType(sel.fuelType);
    setYear((y) => (y !== '' && y >= sel.model.yearFrom && y <= maxYear ? y : ''));
    if (modelChanged) {
      setSelectedVariantId('');
      loadVariants(sel.model.id);
    } else {
      // Same model, different fuel: drop a variant that no longer fits.
      const v = availableVariants.find((x) => x.id === selectedVariantId);
      if (v?.fuelType && v.fuelType.toLowerCase() !== sel.fuelType.toLowerCase()) setSelectedVariantId('');
    }
  };

  const handleVariantChange = (variantId: string) => {
    setSelectedVariantId(variantId);
    if (!variantId) return;

    const chosenVariant = availableVariants.find((v) => v.id === variantId);
    if (chosenVariant?.transmission) setTransmission(chosenVariant.transmission);
  };

  // Variants that match the chosen fuel (all of them if none are tagged with it).
  const fuelVariants = useMemo(() => {
    const matching = availableVariants.filter((v) => !v.fuelType || v.fuelType.toLowerCase() === fuelType.toLowerCase());
    return matching.length > 0 ? matching : availableVariants;
  }, [availableVariants, fuelType]);

  const yearRange = useMemo(() => {
    if (!car) return [];
    const max = car.yearTo ?? new Date().getFullYear();
    const years: number[] = [];
    for (let y = max; y >= car.yearFrom; y--) {
      years.push(y);
    }
    return years;
  }, [car]);

  const openAddModal = () => {
    setEditingVehicleId(null);
    setCar(null);
    setSelectedVariantId('');
    setAvailableVariants([]);
    setYear('');
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

  const openEditModal = async (v: CustomerVehicle) => {
    setEditLoadingId(v.id);
    setEditingVehicleId(v.id);
    setFormError(null);

    const [mRes] = await Promise.all([catalogueApi.model(v.modelId), loadVariants(v.modelId)]);
    const model = mRes.success && mRes.data ? mRes.data : null;
    setCar({
      manufacturerId: v.manufacturerId,
      manufacturerName: v.make,
      logoUrl: logos[v.manufacturerId] ?? null,
      modelId: v.modelId,
      modelName: v.model,
      // If the model can't be loaded, still allow the saved year.
      yearFrom: model ? Math.min(model.yearFrom, v.year) : v.year,
      yearTo: model ? (model.yearTo !== null ? Math.max(model.yearTo, v.year) : null) : v.year,
    });

    setSelectedVariantId(v.variantId || '');
    setYear(v.year);
    setFuelType(v.fuelType);
    setTransmission(v.transmission);
    setLicensePlate(v.licensePlate);
    setVin(v.vin || '');
    setMileage(v.mileage || 0);
    setColor(v.color || '');
    setIsPrimary(v.isPrimary);
    setEditLoadingId(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!car) {
      setFormError('Please choose your car brand, model and fuel.');
      return;
    }

    if (year === '') {
      setFormError('Please choose the year.');
      return;
    }

    if (!licensePlate.trim()) {
      setFormError('Number plate is required.');
      return;
    }

    setFormSubmitting(true);

    const payload = {
      manufacturerId: car.manufacturerId,
      modelId: car.modelId,
      variantId: selectedVariantId || null,
      year: Number(year),
      fuelType,
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
      toast.success(editingVehicleId ? 'Vehicle updated' : 'Vehicle added');
      await loadVehicles();
    } else {
      setFormError(res.message || res.errors?.[0] || 'Could not save the vehicle. Please check the details.');
    }
  };

  const handleSetPrimary = async (vehicleId: string) => {
    setActionLoading(vehicleId);
    const res = await apiFetch(`/customer/vehicles/${vehicleId}/set-primary`, {
      method: 'POST',
    });
    setActionLoading(null);

    if (res.success) {
      toast.success('Primary vehicle updated');
      await loadVehicles();
    } else {
      toast.error('Could not update primary vehicle', res.message || res.errors?.[0]);
    }
  };

  const handleDelete = async (vehicleId: string) => {
    setActionLoading(vehicleId);
    const res = await apiFetch(`/customer/vehicles/${vehicleId}`, {
      method: 'DELETE',
    });
    setActionLoading(null);
    setPendingDelete(null);

    if (res.success) {
      toast.success('Vehicle removed');
      await loadVehicles();
    } else {
      toast.error('Could not remove vehicle', res.message || res.errors?.[0]);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <PageHeader
        title="My vehicles"
        description="The cars you can book a service for."
        actions={
          vehicles.length > 0 ? (
            <Button variant="primary" onClick={openAddModal} leftIcon={<Plus className="h-4 w-4" />}>
              Add vehicle
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading vehicles">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : loadError && vehicles.length === 0 ? (
        <ErrorState
          title="Could not load your vehicles"
          error={loadError}
          onRetry={() => {
            setLoading(true);
            loadVehicles();
          }}
        />
      ) : vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No vehicles yet"
          description="Add your car once and use it for every booking."
          action={
            <Button variant="primary" onClick={openAddModal} leftIcon={<Plus className="h-4 w-4" />}>
              Add your vehicle
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {vehicles.map((v) => {
            const busy = actionLoading === v.id || editLoadingId === v.id;
            const specs = [
              v.transmission,
              typeof v.mileage === 'number' ? `${v.mileage.toLocaleString('en-IN')} km` : null,
              v.color,
            ].filter(Boolean);
            return (
              <Card key={v.id} className={`p-4 sm:p-5 ${v.isPrimary ? 'border-electric-200' : ''}`}>
                <div className="flex items-start gap-3">
                  <BrandLogo name={v.make} logoUrl={logos[v.manufacturerId]} size={44} className="border border-surface-100" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="min-w-0 text-[15px] font-semibold leading-snug text-navy-900">
                        {v.year} {v.make} {v.model}
                      </h2>
                      {v.isPrimary && (
                        <Badge variant="blue" className="shrink-0">
                          Primary
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-sm text-navy-500">{[v.fuelType, v.variantName].filter(Boolean).join(' · ')}</p>
                    <span className="mt-1.5 inline-block rounded-md border border-navy-900/80 bg-surface-50 px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-navy-900">
                      {v.licensePlate}
                    </span>
                  </div>
                </div>

                {specs.length > 0 && <p className="mt-3 text-sm text-navy-600">{specs.join(' · ')}</p>}
                {v.vin && <p className="mt-1 truncate font-mono text-xs text-navy-400">VIN {v.vin}</p>}

                <div className="mt-3 flex items-center gap-2 border-t border-surface-200 pt-3">
                  {!v.isPrimary && (
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => handleSetPrimary(v.id)}
                      leftIcon={<Star className="h-4 w-4" />}
                      className="-ml-2"
                    >
                      Make primary
                    </Button>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      variant="outline"
                      disabled={busy}
                      isLoading={editLoadingId === v.id}
                      onClick={() => openEditModal(v)}
                      leftIcon={<Pencil className="h-4 w-4" />}
                    >
                      Edit
                    </Button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setPendingDelete(v)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      aria-label={`Remove ${v.make} ${v.model} ${v.licensePlate}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Remove confirmation */}
      <ConfirmationDialog
        isOpen={pendingDelete !== null}
        onClose={() => !actionLoading && setPendingDelete(null)}
        onConfirm={() => pendingDelete && handleDelete(pendingDelete.id)}
        title="Remove this vehicle?"
        message={
          pendingDelete
            ? `${pendingDelete.year} ${pendingDelete.make} ${pendingDelete.model} (${pendingDelete.licensePlate}) will be removed from your profile.`
            : ''
        }
        confirmText="Remove"
        cancelText="Keep"
        variant="danger"
        isLoading={pendingDelete !== null && actionLoading === pendingDelete.id}
      />

      {/* Add / edit */}
      <Modal
        isOpen={modalOpen}
        onClose={() => !formSubmitting && setModalOpen(false)}
        title={editingVehicleId ? 'Edit vehicle' : 'Add vehicle'}
        description="Choose the brand, model and fuel, then add the number plate."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={formSubmitting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button type="submit" form="vehicle-form" variant="primary" isLoading={formSubmitting} className="w-full sm:w-auto">
              {editingVehicleId ? 'Save changes' : 'Add vehicle'}
            </Button>
          </div>
        }
      >
        <form id="vehicle-form" onSubmit={handleSubmit} className="space-y-4">
          {formError && <Alert type="error">{formError}</Alert>}

          <CarSelectField
            label="Car"
            value={car ? { manufacturerName: car.manufacturerName, modelName: car.modelName, fuelType, logoUrl: car.logoUrl ?? logos[car.manufacturerId] } : null}
            onChange={handleCarPicked}
            placeholder="Select brand, model and fuel"
          />

          <Select
            id="vehicle-year"
            label="Year"
            value={year}
            onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')}
            disabled={!car}
            required
          >
            <option value="" disabled>
              {car ? 'Select year' : 'Choose your car first'}
            </option>
            {yearRange.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>

          <Select
            id="vehicle-variant"
            label="Variant (optional)"
            value={selectedVariantId}
            onChange={(e) => handleVariantChange(e.target.value)}
            disabled={!car || loadingVariants}
          >
            <option value="">
              {loadingVariants
                ? 'Loading variants…'
                : !car
                ? 'Choose your car first'
                : fuelVariants.length === 0
                ? 'No variants listed'
                : 'Not sure / base model'}
            </option>
            {fuelVariants.map((v) => (
              <option key={v.id} value={v.id}>
                {[v.name, v.transmission, v.fuelType, v.horsepower ? `${v.horsepower} hp` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </option>
            ))}
          </Select>

          <Select
            id="vehicle-transmission"
            label="Transmission"
            value={transmission}
            onChange={(e) => setTransmission(e.target.value)}
            options={TRANSMISSIONS}
          />

          <Input
            id="vehicle-plate"
            label="Number plate"
            value={licensePlate}
            onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
            placeholder="e.g. KA 01 AB 1234"
            autoCapitalize="characters"
            autoComplete="off"
            className="font-mono uppercase"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              id="vehicle-mileage"
              label="Odometer (km)"
              type="number"
              inputMode="numeric"
              min={0}
              max={2000000}
              value={mileage}
              onChange={(e) => setMileage(Number(e.target.value))}
            />
            <Input
              id="vehicle-color"
              label="Colour"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="e.g. White"
            />
          </div>

          <Input
            id="vehicle-vin"
            label="VIN / chassis number (optional)"
            value={vin}
            onChange={(e) => setVin(e.target.value.toUpperCase())}
            placeholder="17 characters"
            autoCapitalize="characters"
            autoComplete="off"
            className="font-mono uppercase"
          />

          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm text-navy-800">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="h-5 w-5 rounded border-surface-300 accent-electric-600"
            />
            <span>Use this as my main vehicle for bookings</span>
          </label>
        </form>
      </Modal>
    </div>
  );
}
