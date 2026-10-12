'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { BrandLogo } from '@/components/catalogue/BrandLogo';
import type { Manufacturer } from '@/lib/catalogue';
import { FormError, ToggleField } from './FormControls';
import { LOGO_MAX_BYTES, LOGO_TYPES, adminCatalogueApi, apiError } from './catalogueAdminApi';

export interface BrandSheetProps {
  isOpen: boolean;
  /** null = add a new brand. */
  brand: Manufacturer | null;
  nextDisplayOrder: number;
  onClose: () => void;
  onSaved: (brand: Manufacturer) => void;
}

/** Add / edit a car brand, including its logo (PNG, JPG, WEBP or SVG up to 512 KB). */
export function BrandSheet({ isOpen, brand, nextDisplayOrder, onClose, onSaved }: BrandSheetProps) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [displayOrder, setDisplayOrder] = useState('');
  const [isPopular, setIsPopular] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const [errors, setErrors] = useState<{ name?: string; displayOrder?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(brand?.name ?? '');
    setCountry(brand?.country ?? '');
    setDisplayOrder(String(brand?.displayOrder ?? nextDisplayOrder));
    setIsPopular(brand?.isPopular ?? false);
    setIsActive(brand?.isActive ?? true);
    setPendingFile(null);
    setRemoveLogo(false);
    setLogoError(null);
    setErrors({});
    setFormError(null);
  }, [isOpen, brand, nextDisplayOrder]);

  // Object URL for the chosen file's preview; revoked when it changes or the sheet closes.
  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      setLogoError('Choose a PNG, JPG, WEBP or SVG image.');
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setLogoError(`This file is ${Math.ceil(file.size / 1024)} KB. Logos must be 512 KB or smaller.`);
      return;
    }
    setLogoError(null);
    setRemoveLogo(false);
    setPendingFile(file);
  };

  const hasCurrentLogo = Boolean(brand?.logoUrl) && !removeLogo;
  const showRemove = Boolean(pendingFile) || hasCurrentLogo;

  const handleRemoveLogo = () => {
    if (pendingFile) {
      setPendingFile(null);
      return;
    }
    setRemoveLogo(true);
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const nextErrors: typeof errors = {};
    const trimmed = name.trim();
    if (!trimmed) nextErrors.name = 'Enter the brand name.';
    else if (trimmed.length > 100) nextErrors.name = 'Keep the name under 100 characters.';
    const order = Number(displayOrder);
    if (displayOrder.trim() === '' || !Number.isInteger(order) || order < 0) nextErrors.displayOrder = 'Enter a whole number, 0 or more.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    setFormError(null);
    const body = { name: trimmed, country: country.trim(), displayOrder: order, isActive, isPopular };
    const res = brand ? await adminCatalogueApi.updateManufacturer(brand.id, body) : await adminCatalogueApi.createManufacturer(body);
    if (!res.success || !res.data) {
      setSaving(false);
      setFormError(apiError(res, 'Could not save the brand. Please try again.'));
      return;
    }

    let saved = res.data;
    if (pendingFile) {
      const up = await adminCatalogueApi.uploadLogo(saved.id, pendingFile);
      if (up.success && up.data) saved = up.data;
      else toast.warning('Brand saved, but the logo was not uploaded', apiError(up, 'Try uploading the logo again.'));
    } else if (removeLogo && brand?.logoUrl) {
      const del = await adminCatalogueApi.removeLogo(saved.id);
      if (del.success && del.data) saved = del.data;
      else toast.warning('Brand saved, but the logo was not removed', apiError(del, 'Please try again.'));
    }

    setSaving(false);
    toast.success(brand ? 'Brand updated' : 'Brand added', saved.name);
    onSaved(saved);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => undefined : onClose}
      title={brand ? `Edit ${brand.name}` : 'Add brand'}
      description="Brands appear in the car picker on the website and in the customer app."
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="submit" form="brand-form" isLoading={saving} className="w-full sm:w-auto">
            {brand ? 'Save changes' : 'Add brand'}
          </Button>
        </div>
      }
    >
      <form id="brand-form" onSubmit={handleSave} className="space-y-4" noValidate>
        <FormError message={formError} />

        {/* Logo */}
        <div>
          <div className="mb-1.5 text-sm font-medium text-navy-800">Logo</div>
          <div className="flex items-center gap-3 rounded-xl border border-surface-200 p-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-surface-200 bg-white">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="New logo preview" className="h-12 w-12 object-contain" />
              ) : (
                <BrandLogo name={name || brand?.name || '?'} logoUrl={hasCurrentLogo ? brand?.logoUrl : null} size={56} />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xs text-navy-500">
                {pendingFile
                  ? `${pendingFile.name} · ${Math.ceil(pendingFile.size / 1024)} KB, uploads when you save`
                  : removeLogo
                    ? 'The logo will be removed when you save. Initials are shown instead.'
                    : 'PNG, JPG, WEBP or SVG, up to 512 KB. Square images look best.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] sm:min-h-[36px]"
                  leftIcon={<ImagePlus className="h-4 w-4" />}
                  onClick={() => fileInput.current?.click()}
                >
                  {pendingFile || hasCurrentLogo ? 'Replace' : 'Upload logo'}
                </Button>
                {showRemove && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-[44px] text-red-600 hover:bg-red-50 hover:text-red-700 sm:min-h-[36px]"
                    leftIcon={<Trash2 className="h-4 w-4" />}
                    onClick={handleRemoveLogo}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleFile}
            aria-label="Choose logo file"
          />
          {logoError && <p className="mt-1.5 text-xs font-medium text-semantic-error">{logoError}</p>}
        </div>

        <Input label="Brand name" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="e.g. Maruti Suzuki" maxLength={100} autoComplete="off" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. India" maxLength={100} autoComplete="off" />
          <Input
            label="Display order"
            type="number"
            inputMode="numeric"
            min={0}
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            error={errors.displayOrder}
            helperText="Lower numbers are listed first."
          />
        </div>
        <div className="space-y-2">
          <ToggleField label="Popular brand" description="Shown in the top row of the car picker." checked={isPopular} onChange={setIsPopular} />
          <ToggleField label="Active" description="Inactive brands are hidden from customers." checked={isActive} onChange={setIsActive} />
        </div>
      </form>
    </Modal>
  );
}
