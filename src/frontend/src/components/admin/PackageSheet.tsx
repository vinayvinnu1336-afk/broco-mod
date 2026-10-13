'use client';

import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import type { ServicePackage } from '@/lib/catalogue';
import { FormError, ToggleField } from './FormControls';
import { adminCatalogueApi, apiError } from './catalogueAdminApi';

type NumberField = 'intervalKm' | 'intervalMonths' | 'durationHours' | 'warrantyKm' | 'warrantyDays' | 'displayOrder';

const LIMITS: Record<NumberField, { label: string; max: number; suffix?: string }> = {
  intervalKm: { label: 'Every (km)', max: 100_000 },
  intervalMonths: { label: 'Or every (months)', max: 60 },
  durationHours: { label: 'Takes (hours)', max: 72 },
  warrantyKm: { label: 'Warranty (km)', max: 100_000 },
  warrantyDays: { label: 'Warranty (days)', max: 3650 },
  displayOrder: { label: 'Display order', max: 1000 },
};

interface Item {
  key: number;
  text: string;
}

let itemKey = 0;
const toItems = (list: string[]): Item[] => list.map((text) => ({ key: ++itemKey, text }));

export interface PackageSheetProps {
  pkg: ServicePackage | null;
  onClose: () => void;
  onSaved: (pkg: ServicePackage) => void;
}

/** Edit a service package (Basic / Standard / Premium) including its checklist of included work. */
export function PackageSheet({ pkg, onClose, onSaved }: PackageSheetProps) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [numbers, setNumbers] = useState<Record<NumberField, string>>({
    intervalKm: '',
    intervalMonths: '',
    durationHours: '',
    warrantyKm: '',
    warrantyDays: '',
    displayOrder: '',
  });
  const [isActive, setIsActive] = useState(true);
  const [isRecommended, setIsRecommended] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [newItem, setNewItem] = useState('');
  const [errors, setErrors] = useState<Partial<Record<NumberField | 'name' | 'items', string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!pkg) return;
    setName(pkg.name);
    setTagline(pkg.tagline ?? '');
    setNumbers({
      intervalKm: String(pkg.intervalKm ?? 0),
      intervalMonths: String(pkg.intervalMonths ?? 0),
      durationHours: String(pkg.durationHours ?? 0),
      warrantyKm: String(pkg.warrantyKm ?? 0),
      warrantyDays: String(pkg.warrantyDays ?? 0),
      displayOrder: String(pkg.displayOrder ?? 0),
    });
    setIsActive(pkg.isActive);
    setIsRecommended(pkg.isRecommended);
    setItems(toItems(pkg.includes ?? []));
    setNewItem('');
    setErrors({});
    setFormError(null);
  }, [pkg]);

  const move = (index: number, delta: number) => {
    setItems((list) => {
      const target = index + delta;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    setItems((list) => [...list, { key: ++itemKey, text }]);
    setNewItem('');
    setErrors((e) => ({ ...e, items: undefined }));
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!pkg) return;
    const next: typeof errors = {};
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 100) next.name = 'Use 2 to 100 characters.';
    const parsed = {} as Record<NumberField, number>;
    (Object.keys(LIMITS) as NumberField[]).forEach((field) => {
      const raw = numbers[field].trim();
      const value = raw === '' ? 0 : Number(raw);
      // Duration may be in half hours (e.g. 3.5); the rest are whole numbers.
      const allowsHalf = field === 'durationHours';
      const shapeOk = allowsHalf ? Number.isInteger(value * 2) : Number.isInteger(value);
      if (!Number.isFinite(value) || !shapeOk || value < 0 || value > LIMITS[field].max) {
        next[field] = allowsHalf
          ? `Hours from 0 to ${LIMITS[field].max}, in steps of 0.5.`
          : `Whole number from 0 to ${LIMITS[field].max.toLocaleString('en-IN')}.`;
      }
      parsed[field] = value;
    });
    const includes = items.map((i) => i.text.trim()).filter(Boolean);
    if (newItem.trim()) includes.push(newItem.trim());
    if (includes.length === 0) next.items = 'Add at least one item customers get with this package.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    setFormError(null);
    const res = await adminCatalogueApi.updatePackage(pkg.id, {
      name: trimmed,
      tagline: tagline.trim(),
      ...parsed,
      includes,
      isActive,
      isRecommended,
    });
    setSaving(false);
    if (!res.success || !res.data) {
      setFormError(apiError(res, 'Could not save the package. Please try again.'));
      return;
    }
    toast.success('Package updated', res.data.name);
    onSaved(res.data);
  };

  return (
    <Modal
      isOpen={Boolean(pkg)}
      onClose={saving ? () => undefined : onClose}
      size="lg"
      title={pkg ? `Edit ${pkg.name}` : ''}
      description={pkg ? `Package code ${pkg.code}. Prices are set per car under "Prices by car".` : undefined}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="submit" form="package-form" isLoading={saving} className="w-full sm:w-auto">
            Save package
          </Button>
        </div>
      }
    >
      <form id="package-form" onSubmit={handleSave} className="space-y-5" noValidate>
        <FormError message={formError} />
        <div className="space-y-4">
          <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={100} />
          <Textarea
            label="Tagline"
            rows={2}
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            maxLength={300}
            helperText={`${tagline.length}/300 · shown under the package name`}
          />
        </div>

        <fieldset className="space-y-3">
          <legend className="text-base font-semibold text-navy-900">Schedule and warranty</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(Object.keys(LIMITS) as NumberField[]).map((field) => (
              <Input
                key={field}
                label={LIMITS[field].label}
                type="number"
                inputMode={field === 'durationHours' ? 'decimal' : 'numeric'}
                step={field === 'durationHours' ? 0.5 : 1}
                min={0}
                max={LIMITS[field].max}
                value={numbers[field]}
                onChange={(e) => setNumbers((n) => ({ ...n, [field]: e.target.value }))}
                error={errors[field]}
              />
            ))}
          </div>
        </fieldset>

        <div className="space-y-2">
          <ToggleField
            label="Recommended"
            description="Highlighted as the suggested choice for customers."
            checked={isRecommended}
            onChange={setIsRecommended}
          />
          <ToggleField label="Active" description="Inactive packages can't be booked." checked={isActive} onChange={setIsActive} />
        </div>

        <fieldset className="space-y-3">
          <legend className="text-base font-semibold text-navy-900">What&apos;s included ({items.length})</legend>
          <p className="-mt-1 text-xs text-navy-500">Start an item with a section name and a colon to group it, e.g. <span className="font-medium text-navy-700">Brake Care: Rear drum cleaning</span>.</p>
          {items.length > 0 && (
            <ol className="space-y-2">
              {items.map((item, index) => (
                <li key={item.key} className="flex items-center gap-1.5">
                  <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-navy-400">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Input
                      aria-label={`Included item ${index + 1}`}
                      value={item.text}
                      maxLength={200}
                      onChange={(e) =>
                        setItems((list) => list.map((x) => (x.key === item.key ? { ...x, text: e.target.value } : x)))
                      }
                    />
                  </div>
                  <div className="flex shrink-0">
                    <ItemButton label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </ItemButton>
                    <ItemButton label="Move down" disabled={index === items.length - 1} onClick={() => move(index, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </ItemButton>
                    <ItemButton label="Remove item" danger onClick={() => setItems((list) => list.filter((x) => x.key !== item.key))}>
                      <X className="h-4 w-4" />
                    </ItemButton>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <Input
                aria-label="New included item"
                placeholder="e.g. Brake Care: Handbrake adjustment"
                value={newItem}
                maxLength={200}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addItem();
                  }
                }}
              />
            </div>
            <Button type="button" variant="outline" onClick={addItem} leftIcon={<Plus className="h-4 w-4" />} className="shrink-0">
              Add
            </Button>
          </div>
          {errors.items && <p className="text-xs font-medium text-semantic-error">{errors.items}</p>}
        </fieldset>
      </form>
    </Modal>
  );
}

function ItemButton({
  label,
  onClick,
  disabled = false,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-11 w-9 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-30 sm:w-10 ${
        danger ? 'text-red-500 hover:bg-red-50 hover:text-red-700' : 'text-navy-500 hover:bg-surface-100 hover:text-navy-900'
      }`}
    >
      {children}
    </button>
  );
}
