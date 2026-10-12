'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { FUELS, SEGMENTS, SEGMENT_LABELS, type CarModel, type Manufacturer } from '@/lib/catalogue';
import { ChoiceChips, FormError, ToggleField } from './FormControls';
import { BODY_TYPES, SEGMENT_FOR_BODY, adminCatalogueApi, apiError } from './catalogueAdminApi';

export interface ModelSheetProps {
  isOpen: boolean;
  brand: Manufacturer | null;
  /** null = add a new model to `brand`. */
  model: CarModel | null;
  onClose: () => void;
  onSaved: (model: CarModel) => void;
}

const CURRENT_YEAR = new Date().getFullYear();

/** Add / edit a car model: body type, pricing segment, fuels and the years it was sold. */
export function ModelSheet({ isOpen, brand, model, onClose, onSaved }: ModelSheetProps) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [bodyType, setBodyType] = useState<string>('Hatchback');
  const [segment, setSegment] = useState<string>('Hatchback');
  const [segmentTouched, setSegmentTouched] = useState(false);
  const [fuels, setFuels] = useState<string[]>(['Petrol']);
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<{ name?: string; fuels?: string; yearFrom?: string; yearTo?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(model?.name ?? '');
    setBodyType(model?.bodyType || 'Hatchback');
    setSegment(model?.segment || 'Hatchback');
    setSegmentTouched(Boolean(model));
    setFuels(model?.fuels?.length ? model.fuels : ['Petrol']);
    setYearFrom(model?.yearFrom ? String(model.yearFrom) : '');
    setYearTo(model?.yearTo ? String(model.yearTo) : '');
    setIsActive(model?.isActive ?? true);
    setErrors({});
    setFormError(null);
  }, [isOpen, model]);

  const handleBodyType = (value: string) => {
    setBodyType(value);
    if (!segmentTouched && SEGMENT_FOR_BODY[value]) setSegment(SEGMENT_FOR_BODY[value]);
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!brand) return;
    const next: typeof errors = {};
    const trimmed = name.trim();
    if (!trimmed) next.name = 'Enter the model name.';
    if (fuels.length === 0) next.fuels = 'Pick at least one fuel.';
    const from = Number(yearFrom);
    if (!Number.isInteger(from) || from < 1950 || from > 2100) next.yearFrom = 'Enter a year between 1950 and 2100.';
    let to: number | null = null;
    if (yearTo.trim()) {
      to = Number(yearTo);
      if (!Number.isInteger(to) || to < 1950 || to > 2100) next.yearTo = 'Enter a year between 1950 and 2100.';
      else if (Number.isInteger(from) && to < from) next.yearTo = 'Must be the same as or after "Sold from".';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    setFormError(null);
    const body = { name: trimmed, bodyType, segment, fuels, yearFrom: from, yearTo: to, isActive };
    const res = model ? await adminCatalogueApi.updateModel(model.id, body) : await adminCatalogueApi.createModel(brand.id, body);
    setSaving(false);
    if (!res.success || !res.data) {
      setFormError(apiError(res, 'Could not save the model. Please try again.'));
      return;
    }
    toast.success(model ? 'Model updated' : 'Model added', `${brand.name} ${res.data.name}`);
    onSaved(res.data);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => undefined : onClose}
      title={model ? `Edit ${model.name}` : `Add ${brand?.name ?? ''} model`}
      description="The pricing segment decides which bulk prices apply to this car."
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="submit" form="model-form" isLoading={saving} className="w-full sm:w-auto">
            {model ? 'Save changes' : 'Add model'}
          </Button>
        </div>
      }
    >
      <form id="model-form" onSubmit={handleSave} className="space-y-4" noValidate>
        <FormError message={formError} />
        <Input label="Model name" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="e.g. Swift" maxLength={100} autoComplete="off" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Body type"
            value={bodyType}
            onChange={(e) => handleBodyType(e.target.value)}
            options={BODY_TYPES.map((b) => ({ value: b, label: b }))}
          />
          <Select
            label="Pricing segment"
            value={segment}
            onChange={(e) => {
              setSegment(e.target.value);
              setSegmentTouched(true);
            }}
            options={SEGMENTS.map((s) => ({ value: s, label: SEGMENT_LABELS[s] ?? s }))}
          />
        </div>
        <ChoiceChips
          label="Fuels available"
          required
          multiple
          options={FUELS.map((f) => ({ value: f, label: f }))}
          value={fuels}
          onChange={setFuels}
          error={errors.fuels}
          helperText="Customers can only pick these fuels for this model."
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Sold from"
            required
            type="number"
            inputMode="numeric"
            min={1950}
            max={2100}
            placeholder={String(CURRENT_YEAR - 5)}
            value={yearFrom}
            onChange={(e) => setYearFrom(e.target.value)}
            error={errors.yearFrom}
          />
          <Input
            label="Sold until"
            type="number"
            inputMode="numeric"
            min={1950}
            max={2100}
            placeholder="Still on sale"
            value={yearTo}
            onChange={(e) => setYearTo(e.target.value)}
            error={errors.yearTo}
            helperText="Leave empty if still sold."
          />
        </div>
        <ToggleField label="Active" description="Inactive models are hidden from customers." checked={isActive} onChange={setIsActive} />
      </form>
    </Modal>
  );
}
