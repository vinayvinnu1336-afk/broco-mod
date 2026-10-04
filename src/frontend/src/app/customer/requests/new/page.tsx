'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { CustomerVehicle, ServiceRequestDetailDto } from '@/types/serviceRequest';
import {
  Car,
  MapPin,
  Wrench,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Sparkles,
  ShieldCheck,
  Send,
  Navigation,
  Search,
  Check,
  Building,
  Layers,
  FileText
} from 'lucide-react';
import { Stepper, StepItem } from '@/components/ui/Stepper';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/LoadingState';

const CATEGORIES = [
  'Periodic Service',
  'Brakes & Suspension',
  'Engine & Performance',
  'Transmission & Clutch',
  'Electrical & Diagnostics',
  'Air Conditioning',
  'Bodywork & Paint',
  'General Inspection',
];

const POPULAR_MANUFACTURERS = [
  { id: 'bmw', name: 'BMW', models: ['3 Series', '5 Series', 'X3', 'X5', 'M340i'] },
  { id: 'audi', name: 'Audi', models: ['A4', 'A6', 'Q5', 'Q7', 'RS5'] },
  { id: 'mercedes', name: 'Mercedes-Benz', models: ['C-Class', 'E-Class', 'GLC', 'GLE'] },
  { id: 'toyota', name: 'Toyota', models: ['Camry', 'Fortuner', 'Corolla', 'Innova'] },
  { id: 'honda', name: 'Honda', models: ['Civic', 'City', 'CR-V', 'Accord'] },
  { id: 'hyundai', name: 'Hyundai', models: ['Creta', 'Verna', 'Tucson', 'Ioniq'] },
  { id: 'volkswagen', name: 'Volkswagen', models: ['Virtus', 'Taigun', 'Golf', 'Tiguan'] },
];

const LOCATION_PRESETS = [
  {
    name: 'MG Road (Central)',
    address: '100 MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
    lat: 12.9716,
    lng: 77.5946,
  },
  {
    name: 'Indiranagar (100ft Rd)',
    address: '450 100ft Road, Indiranagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560038',
    lat: 12.9784,
    lng: 77.6408,
  },
  {
    name: 'Koramangala (5th Block)',
    address: '12 80ft Road, Koramangala 5th Block',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560095',
    lat: 12.9352,
    lng: 77.6245,
  },
  {
    name: 'Whitefield (ITPL Rd)',
    address: '77 ITPL Main Road, Whitefield',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560066',
    lat: 12.9698,
    lng: 77.7499,
  },
];

export default function NewServiceBookingPage() {
  const router = useRouter();

  // 7-step Booking Sequence
  // Step 1: Select Location
  // Step 2: Select Vehicle Manufacturer
  // Step 3: Select Vehicle Model
  // Step 4: Select Variant & Specs
  // Step 5: Describe Problem
  // Step 6: Review Request
  // Step 7: Submit Service Request (Success Confirmation)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Vehicles from API
  const [vehicles, setVehicles] = useState<CustomerVehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');

  // Step 1: Location Fields
  const [addressLine1, setAddressLine1] = useState('100 MG Road');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [state, setState] = useState('Karnataka');
  const [pincode, setPincode] = useState('560001');
  const [country] = useState('India');
  const [latitude, setLatitude] = useState<number>(12.9716);
  const [longitude, setLongitude] = useState<number>(77.5946);

  // Step 2: Vehicle Manufacturer
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('BMW');

  // Step 3: Vehicle Model
  const [selectedModel, setSelectedModel] = useState<string>('3 Series');

  // Step 4: Variant / Year / Specs
  const [selectedVariant, setSelectedVariant] = useState<string>('330i M-Sport');
  const [vehicleYear, setVehicleYear] = useState<number>(2023);
  const [licensePlate, setLicensePlate] = useState<string>('KA-01-MJ-2023');

  // Step 5: Describe Problem
  const [serviceCategory, setServiceCategory] = useState<string>('Periodic Service');
  const [problemDescription, setProblemDescription] = useState<string>('');
  const [preferredDate, setPreferredDate] = useState<string>('');

  // Submission State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdRequest, setCreatedRequest] = useState<ServiceRequestDetailDto | null>(null);

  // Load customer vehicles on mount
  useEffect(() => {
    async function loadVehicles() {
      try {
        const res = await apiFetch<CustomerVehicle[]>('/customer/vehicles');
        if (res.success && res.data && res.data.length > 0) {
          setVehicles(res.data);
          const primary = res.data.find((v) => v.isPrimary) || res.data[0];
          setSelectedVehicleId(primary.id);
          setSelectedManufacturer(primary.manufacturerName);
          setSelectedModel(primary.modelName);
          setSelectedVariant(primary.variantName || 'Standard');
          setVehicleYear(primary.year);
          setLicensePlate(primary.licensePlate);
        }
      } catch (err) {
        console.error('Error fetching vehicles:', err);
      } finally {
        setLoadingVehicles(false);
      }
    }
    loadVehicles();
  }, []);

  // When saved vehicle is chosen, sync details
  const handleSelectSavedVehicle = (vId: string) => {
    setSelectedVehicleId(vId);
    const found = vehicles.find((v) => v.id === vId);
    if (found) {
      setSelectedManufacturer(found.manufacturerName);
      setSelectedModel(found.modelName);
      setSelectedVariant(found.variantName || 'Standard');
      setVehicleYear(found.year);
      setLicensePlate(found.licensePlate);
    }
  };

  const handleDetectLocation = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(parseFloat(pos.coords.latitude.toFixed(6)));
          setLongitude(parseFloat(pos.coords.longitude.toFixed(6)));
        },
        () => {
          setErrorMsg('Location permission was denied. Please select a preset or enter coordinates.');
        }
      );
    }
  };

  const handleApplyPreset = (preset: (typeof LOCATION_PRESETS)[0]) => {
    setAddressLine1(preset.address);
    setCity(preset.city);
    setState(preset.state);
    setPincode(preset.pincode);
    setLatitude(preset.lat);
    setLongitude(preset.lng);
  };

  // Step Validation
  const validateCurrentStep = (): boolean => {
    setErrorMsg(null);
    if (currentStep === 1) {
      if (!addressLine1.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
        setErrorMsg('Please complete all location fields.');
        return false;
      }
      return true;
    }
    if (currentStep === 2) {
      if (!selectedManufacturer.trim()) {
        setErrorMsg('Please select a vehicle manufacturer.');
        return false;
      }
      return true;
    }
    if (currentStep === 3) {
      if (!selectedModel.trim()) {
        setErrorMsg('Please select a vehicle model.');
        return false;
      }
      return true;
    }
    if (currentStep === 4) {
      if (!licensePlate.trim()) {
        setErrorMsg('Please enter your license plate number.');
        return false;
      }
      return true;
    }
    if (currentStep === 5) {
      if (!problemDescription.trim() || problemDescription.trim().length < 5) {
        setErrorMsg('Please provide a brief problem description of at least 5 characters.');
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, 7));
    }
  };

  const handleBack = () => {
    setErrorMsg(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Submit Final Booking
  const handleSubmitBooking = async () => {
    setSubmitting(true);
    setErrorMsg(null);

    // Ensure vehicle exists in backend
    let effectiveVehicleId = selectedVehicleId;
    if (!effectiveVehicleId && vehicles.length > 0) {
      effectiveVehicleId = vehicles[0].id;
    }

    const idempotencyKey = `bm-req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const payload = {
      vehicleId: effectiveVehicleId,
      addressLine1,
      addressLine2: addressLine2 || null,
      city,
      state,
      pincode,
      country,
      latitude,
      longitude,
      problemDescription,
      serviceCategory,
      preferredServiceDate: preferredDate ? new Date(preferredDate).toISOString() : null,
    };

    try {
      const res = await apiFetch<ServiceRequestDetailDto>('/customer/requests', {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      if (res.success && res.data) {
        setCreatedRequest(res.data);
        setCurrentStep(7); // Final step
      } else {
        setErrorMsg(res.message || 'Unable to submit service request. Please check details and try again.');
      }
    } catch (err: unknown) {
      setErrorMsg('Unable to submit service request right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const stepsList: StepItem[] = [
    { id: 1, label: 'Location', description: '10 KM Radius' },
    { id: 2, label: 'Make', description: 'Manufacturer' },
    { id: 3, label: 'Model', description: 'Vehicle Series' },
    { id: 4, label: 'Variant', description: 'Specs & Plate' },
    { id: 5, label: 'Problem', description: 'Symptoms' },
    { id: 6, label: 'Review', description: 'Verify Order' },
    { id: 7, label: 'Confirmed', description: 'Dispatched' },
  ];

  const currentMfgObj = POPULAR_MANUFACTURERS.find(
    (m) => m.name.toLowerCase() === selectedManufacturer.toLowerCase()
  ) || POPULAR_MANUFACTURERS[0];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Link
            href="/customer/requests"
            className="text-xs font-bold text-navy-500 hover:text-electric-600 flex items-center gap-1 mb-1 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to My Requests</span>
          </Link>
          <h1 className="text-2xl font-black text-navy-900 tracking-tight">Book Vehicle Service</h1>
          <p className="text-xs text-navy-500 mt-0.5">
            Follow the 7-step guided workflow to broadcast your service request to verified garages within 10 KM.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="blue" dot>
            Step {currentStep} of 7
          </Badge>
        </div>
      </div>

      {/* Stepper Progress Bar */}
      <Card className="p-4 sm:p-6 bg-white overflow-x-auto">
        <Stepper
          steps={stepsList}
          currentStep={currentStep}
          onStepClick={(stepNum) => {
            if (stepNum < currentStep) setCurrentStep(stepNum);
          }}
        />
      </Card>

      {errorMsg && (
        <Alert type="error" onClose={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}

      {/* STEP 1: SELECT LOCATION */}
      {currentStep === 1 && (
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="border-b border-surface-200 pb-4">
            <span className="text-xs font-bold text-electric-600 uppercase tracking-wider">Step 1</span>
            <h2 className="text-xl font-black text-navy-900 mt-1">Select Service Pickup Location</h2>
            <p className="text-xs text-navy-500 mt-0.5">
              Workshops within a 10 KM radius of this coordinate will be matched to quote on your service.
            </p>
          </div>

          {/* Quick presets */}
          <div>
            <label className="block text-xs font-bold text-navy-800 uppercase tracking-wider mb-2">
              Popular Proximity Hubs (Bengaluru Demo)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {LOCATION_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className={`p-3 rounded-xl border text-left text-xs transition ${
                    addressLine1 === p.address
                      ? 'border-electric-600 bg-electric-50/60 font-bold text-electric-800 shadow-sm'
                      : 'border-surface-200 bg-surface-50 text-navy-700 hover:border-surface-300'
                  }`}
                >
                  <div className="font-bold truncate">{p.name}</div>
                  <div className="text-[10px] text-navy-500 mt-0.5 truncate">{p.city}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Address Line 1"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="e.g. 100 MG Road"
              leftIcon={<MapPin className="w-4 h-4" />}
              required
            />
            <Input
              label="Address Line 2 (Optional)"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="Apartment, suite, unit"
            />
            <Input
              label="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="State"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State"
                required
              />
              <Input
                label="Pincode"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="Pincode"
                required
              />
            </div>
          </div>

          {/* Coordinates Bar */}
          <div className="p-4 bg-surface-50 rounded-xl border border-surface-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <Navigation className="w-4 h-4 text-electric-600 shrink-0" />
              <div>
                <span className="font-bold text-navy-900">Spatial Coordinates: </span>
                <span className="font-mono text-navy-600">
                  {latitude.toFixed(4)}° N, {longitude.toFixed(4)}° E
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDetectLocation}
              leftIcon={<MapPin className="w-3.5 h-3.5" />}
            >
              Auto-Detect My GPS
            </Button>
          </div>

          <div className="flex justify-end pt-4 border-t border-surface-200">
            <Button size="md" variant="primary" onClick={handleNext} rightIcon={<ArrowRight className="w-4 h-4" />}>
              Continue to Vehicle Make
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 2: SELECT MANUFACTURER */}
      {currentStep === 2 && (
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="border-b border-surface-200 pb-4">
            <span className="text-xs font-bold text-electric-600 uppercase tracking-wider">Step 2</span>
            <h2 className="text-xl font-black text-navy-900 mt-1">Select Vehicle Manufacturer</h2>
            <p className="text-xs text-navy-500 mt-0.5">
              Choose from your saved garage vehicles or select your vehicle make.
            </p>
          </div>

          {/* Saved vehicles quick pick */}
          {vehicles.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-navy-800 uppercase tracking-wider mb-2">
                Your Registered Vehicles
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {vehicles.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleSelectSavedVehicle(v.id)}
                    className={`p-4 rounded-xl border text-left transition flex items-center justify-between ${
                      selectedVehicleId === v.id
                        ? 'border-electric-600 bg-electric-50/70 ring-2 ring-electric-600/20'
                        : 'border-surface-200 bg-white hover:border-surface-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm text-navy-900">
                        {v.year} {v.manufacturerName} {v.modelName}
                      </div>
                      <div className="text-xs text-navy-500 mt-0.5">Plate: {v.licensePlate}</div>
                    </div>
                    {selectedVehicleId === v.id && (
                      <CheckCircle2 className="w-5 h-5 text-electric-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manufacturer Grid */}
          <div>
            <label className="block text-xs font-bold text-navy-800 uppercase tracking-wider mb-2">
              Or Choose Make
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {POPULAR_MANUFACTURERS.map((mfg) => (
                <button
                  key={mfg.id}
                  type="button"
                  onClick={() => {
                    setSelectedManufacturer(mfg.name);
                    setSelectedModel(mfg.models[0]);
                  }}
                  className={`p-4 rounded-xl border text-center transition ${
                    selectedManufacturer.toLowerCase() === mfg.name.toLowerCase()
                      ? 'border-electric-600 bg-electric-50 font-bold text-electric-800 shadow-sm'
                      : 'border-surface-200 bg-surface-50 text-navy-800 hover:border-surface-300'
                  }`}
                >
                  <Building className="w-5 h-5 mx-auto mb-1 text-navy-500" />
                  <div className="text-sm font-bold">{mfg.name}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-surface-200">
            <Button size="md" variant="outline" onClick={handleBack} leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to Location
            </Button>
            <Button size="md" variant="primary" onClick={handleNext} rightIcon={<ArrowRight className="w-4 h-4" />}>
              Continue to Model
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 3: SELECT MODEL */}
      {currentStep === 3 && (
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="border-b border-surface-200 pb-4">
            <span className="text-xs font-bold text-electric-600 uppercase tracking-wider">Step 3</span>
            <h2 className="text-xl font-black text-navy-900 mt-1">
              Select {selectedManufacturer} Model
            </h2>
            <p className="text-xs text-navy-500 mt-0.5">
              Pick the specific model series for your {selectedManufacturer}.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {currentMfgObj.models.map((model) => (
              <button
                key={model}
                type="button"
                onClick={() => setSelectedModel(model)}
                className={`p-5 rounded-xl border text-left transition ${
                  selectedModel.toLowerCase() === model.toLowerCase()
                    ? 'border-electric-600 bg-electric-50/70 font-bold text-electric-900 shadow-sm'
                    : 'border-surface-200 bg-surface-50 text-navy-800 hover:border-surface-300'
                }`}
              >
                <Car className="w-5 h-5 mb-2 text-electric-600" />
                <div className="text-sm font-bold">{model}</div>
                <div className="text-[11px] text-navy-500 mt-0.5">{selectedManufacturer} Series</div>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-surface-200">
            <Button size="md" variant="outline" onClick={handleBack} leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to Make
            </Button>
            <Button size="md" variant="primary" onClick={handleNext} rightIcon={<ArrowRight className="w-4 h-4" />}>
              Continue to Variant & Specs
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 4: VARIANT & SPECS */}
      {currentStep === 4 && (
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="border-b border-surface-200 pb-4">
            <span className="text-xs font-bold text-electric-600 uppercase tracking-wider">Step 4</span>
            <h2 className="text-xl font-black text-navy-900 mt-1">Vehicle Variant & Registration</h2>
            <p className="text-xs text-navy-500 mt-0.5">
              Confirm model year, variant trim, and license plate for accurate workshop parts matching.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Variant / Trim"
              value={selectedVariant}
              onChange={(e) => setSelectedVariant(e.target.value)}
              placeholder="e.g. 330i M-Sport, 2.0 TDI"
              required
            />

            <Input
              label="Manufacturing Year"
              type="number"
              value={vehicleYear}
              onChange={(e) => setVehicleYear(parseInt(e.target.value) || 2023)}
              min={1990}
              max={2026}
              required
            />

            <Input
              label="License Plate Number"
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
              placeholder="e.g. KA-01-MJ-2023"
              leftIcon={<Car className="w-4 h-4" />}
              required
            />

            <Select
              label="Fuel Type"
              options={[
                { value: 'Petrol', label: 'Petrol' },
                { value: 'Diesel', label: 'Diesel' },
                { value: 'Hybrid', label: 'Hybrid' },
                { value: 'Electric', label: 'Electric (EV)' },
              ]}
              defaultValue="Petrol"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-surface-200">
            <Button size="md" variant="outline" onClick={handleBack} leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to Model
            </Button>
            <Button size="md" variant="primary" onClick={handleNext} rightIcon={<ArrowRight className="w-4 h-4" />}>
              Continue to Describe Problem
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 5: DESCRIBE PROBLEM */}
      {currentStep === 5 && (
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="border-b border-surface-200 pb-4">
            <span className="text-xs font-bold text-electric-600 uppercase tracking-wider">Step 5</span>
            <h2 className="text-xl font-black text-navy-900 mt-1">Describe Required Service or Symptoms</h2>
            <p className="text-xs text-navy-500 mt-0.5">
              Detailing the issues helps garages compile accurate initial quotes and parts estimates.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-navy-800 uppercase tracking-wider mb-2">
              Service Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setServiceCategory(cat)}
                  className={`p-3 rounded-xl border text-xs font-bold transition text-left ${
                    serviceCategory === cat
                      ? 'border-electric-600 bg-electric-50 text-electric-900 shadow-sm'
                      : 'border-surface-200 bg-surface-50 text-navy-700 hover:border-surface-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <Textarea
            label="Problem Description & Symptoms"
            value={problemDescription}
            onChange={(e) => setProblemDescription(e.target.value)}
            placeholder="e.g. Brake pedal feels spongy under hard braking; squeaking noise from front right wheel above 40 km/h; scheduled oil service due."
            rows={5}
            helperText="Include any specific concerns, warning lights, or recent symptoms."
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Preferred Service Date (Optional)"
              type="date"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-surface-200">
            <Button size="md" variant="outline" onClick={handleBack} leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to Specs
            </Button>
            <Button size="md" variant="primary" onClick={handleNext} rightIcon={<ArrowRight className="w-4 h-4" />}>
              Review Booking Summary
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 6: REVIEW REQUEST */}
      {currentStep === 6 && (
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="border-b border-surface-200 pb-4">
            <span className="text-xs font-bold text-electric-600 uppercase tracking-wider">Step 6</span>
            <h2 className="text-xl font-black text-navy-900 mt-1">Review Service Request</h2>
            <p className="text-xs text-navy-500 mt-0.5">
              Confirm all details before broadcasting to verified garages within 10 KM.
            </p>
          </div>

          <div className="space-y-4">
            {/* Vehicle Summary */}
            <div className="bg-surface-50 p-4 rounded-xl border border-surface-200">
              <div className="text-xs font-bold text-navy-400 uppercase tracking-wider mb-2">
                Vehicle Details
              </div>
              <div className="text-base font-bold text-navy-900">
                {vehicleYear} {selectedManufacturer} {selectedModel} ({selectedVariant})
              </div>
              <div className="text-xs text-navy-600 mt-0.5">License Plate: {licensePlate}</div>
            </div>

            {/* Location Summary */}
            <div className="bg-surface-50 p-4 rounded-xl border border-surface-200">
              <div className="text-xs font-bold text-navy-400 uppercase tracking-wider mb-2">
                Pickup & Dispatch Location
              </div>
              <div className="text-sm font-semibold text-navy-900">{addressLine1}</div>
              <div className="text-xs text-navy-600 mt-0.5">
                {city}, {state} - {pincode}
              </div>
              <div className="text-[11px] font-mono text-electric-700 mt-1">
                PostGIS Coordinates: {latitude.toFixed(4)}° N, {longitude.toFixed(4)}° E (10 KM Geofence Active)
              </div>
            </div>

            {/* Problem Summary */}
            <div className="bg-surface-50 p-4 rounded-xl border border-surface-200">
              <div className="text-xs font-bold text-navy-400 uppercase tracking-wider mb-2">
                Service Scope
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-full bg-electric-100 text-electric-800 text-xs font-bold mb-2">
                {serviceCategory}
              </div>
              <p className="text-xs text-navy-800 leading-relaxed">{problemDescription}</p>
            </div>
          </div>

          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 leading-relaxed">
              <strong>Advisor Protection Guaranteed:</strong> You are not committing to any charges now. Eligible workshops will submit itemized quotes, which will be audited by your assigned Service Advisor before any payment is requested.
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-surface-200">
            <Button size="md" variant="outline" onClick={handleBack} leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Make Changes
            </Button>
            <Button
              size="lg"
              variant="primary"
              onClick={handleSubmitBooking}
              isLoading={submitting}
              rightIcon={<Send className="w-4 h-4" />}
            >
              {submitting ? 'Broadcasting...' : 'Broadcast Service Request'}
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 7: CONFIRMATION SUCCESS */}
      {currentStep === 7 && (
        <Card className="p-8 sm:p-12 text-center space-y-6 bg-white">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
              Request Dispatched Successfully
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-navy-900 tracking-tight mt-1">
              Your Service Request is Live!
            </h2>
            <p className="text-xs text-navy-500 max-w-md mx-auto mt-2 leading-relaxed">
              We have broadcasted your request to verified workshops within your 10 KM geo-radius. Workshop quotes will arrive shortly for your review.
            </p>
          </div>

          {createdRequest && (
            <div className="bg-surface-50 max-w-sm mx-auto p-4 rounded-2xl border border-surface-200 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-navy-400">Request Number:</span>
                <span className="font-mono font-bold text-navy-900">{createdRequest.requestNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy-400">Vehicle:</span>
                <span className="font-bold text-navy-900">{createdRequest.vehicleSummary}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy-400">Status:</span>
                <Badge variant="blue" dot>
                  {createdRequest.status}
                </Badge>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <Link href="/customer/dashboard">
              <Button size="md" variant="primary">
                Go to Dashboard
              </Button>
            </Link>
            {createdRequest && (
              <Link href={`/customer/requests/${createdRequest.id}`}>
                <Button size="md" variant="outline">
                  Track Live Milestones
                </Button>
              </Link>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
