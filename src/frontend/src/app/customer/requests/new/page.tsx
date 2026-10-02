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
} from 'lucide-react';

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

const BANGALORE_PRESETS = [
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
    name: 'Whitefield (ITPL Main Rd)',
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

  // Wizard state: 1: Vehicle, 2: Location, 3: Problem, 4: Review, 5: Confirmation
  const [step, setStep] = useState<number>(1);
  const [vehicles, setVehicles] = useState<CustomerVehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);

  // Form Fields
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [state, setState] = useState('Karnataka');
  const [pincode, setPincode] = useState('560001');
  const [country] = useState('India');
  const [latitude, setLatitude] = useState<number>(12.9716);
  const [longitude, setLongitude] = useState<number>(77.5946);

  const [serviceCategory, setServiceCategory] = useState('Periodic Service');
  const [problemDescription, setProblemDescription] = useState('');
  const [preferredDate, setPreferredDate] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdRequest, setCreatedRequest] = useState<ServiceRequestDetailDto | null>(null);

  // Load customer vehicles on mount
  useEffect(() => {
    async function loadVehicles() {
      const res = await apiFetch<CustomerVehicle[]>('/customer/vehicles');
      if (res.success && res.data) {
        setVehicles(res.data);
        const primary = res.data.find((v) => v.isPrimary);
        if (primary) {
          setSelectedVehicleId(primary.id);
        } else if (res.data.length > 0) {
          setSelectedVehicleId(res.data[0].id);
        }
      }
      setLoadingVehicles(false);
    }
    loadVehicles();
  }, []);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);

  // Geolocation quick-detect
  const handleDetectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(parseFloat(pos.coords.latitude.toFixed(6)));
          setLongitude(parseFloat(pos.coords.longitude.toFixed(6)));
        },
        () => {
          setErrorMsg('Location access was denied. Please select a preset or enter coordinates manually.');
        }
      );
    }
  };

  const handleApplyPreset = (preset: (typeof BANGALORE_PRESETS)[0]) => {
    setAddressLine1(preset.address);
    setCity(preset.city);
    setState(preset.state);
    setPincode(preset.pincode);
    setLatitude(preset.lat);
    setLongitude(preset.lng);
  };

  // Form Validation per step
  const validateStep = (currentStep: number): boolean => {
    setErrorMsg(null);
    if (currentStep === 1) {
      if (!selectedVehicleId) {
        setErrorMsg('Please select a vehicle to proceed.');
        return false;
      }
      return true;
    }
    if (currentStep === 2) {
      if (!addressLine1.trim()) {
        setErrorMsg('Please enter Address Line 1.');
        return false;
      }
      if (!city.trim() || !state.trim() || !pincode.trim()) {
        setErrorMsg('Please complete City, State, and Pincode.');
        return false;
      }
      if (isNaN(latitude) || latitude < -90 || latitude > 90) {
        setErrorMsg('Valid Latitude between -90 and 90 is required for PostGIS 10 KM dispatch.');
        return false;
      }
      if (isNaN(longitude) || longitude < -180 || longitude > 180) {
        setErrorMsg('Valid Longitude between -180 and 180 is required for PostGIS 10 KM dispatch.');
        return false;
      }
      return true;
    }
    if (currentStep === 3) {
      if (!problemDescription.trim() || problemDescription.trim().length < 5) {
        setErrorMsg('Please provide a problem description of at least 5 characters.');
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setErrorMsg(null);
    setStep((prev) => Math.max(1, prev - 1));
  };

  // Submit Request
  const handleSubmitBooking = async () => {
    setSubmitting(true);
    setErrorMsg(null);

    const idempotencyKey = `bm-req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const payload = {
      vehicleId: selectedVehicleId,
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

    const res = await apiFetch<ServiceRequestDetailDto>('/customer/requests', {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);

    if (res.success && res.data) {
      setCreatedRequest(res.data);
      setStep(5); // Confirmation step
    } else {
      setErrorMsg(res.message || 'Failed to submit service request. Please check your details and try again.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <Link
          href="/customer/requests"
          className="text-xs font-semibold text-navy-500 hover:text-navy-800 flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to My Requests
        </Link>
        <h1 className="text-2xl font-bold text-navy-900 tracking-tight">Book a Service</h1>
        <p className="text-xs text-navy-600 mt-1">
          Broadcast your vehicle requirements to verified, high-performance garages within 10 KM.
        </p>
      </div>

      {/* Progress Steps (1 to 4) */}
      {step <= 4 && (
        <div className="grid grid-cols-4 gap-2 bg-white p-3 rounded-2xl border border-surface-200 shadow-sm text-xs font-semibold">
          {[
            { num: 1, label: 'Vehicle', icon: Car },
            { num: 2, label: 'Location', icon: MapPin },
            { num: 3, label: 'Problem', icon: Wrench },
            { num: 4, label: 'Review', icon: CheckCircle2 },
          ].map(({ num, label, icon: Icon }) => (
            <div
              key={num}
              className={`flex items-center justify-center gap-2 py-2 rounded-xl transition-all ${
                step === num
                  ? 'bg-navy-900 text-white shadow-sm'
                  : step > num
                  ? 'bg-electric-50 text-electric-700'
                  : 'text-navy-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Attention: </span>
            {errorMsg}
          </div>
        </div>
      )}

      {/* STEP 1: SELECT VEHICLE */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-navy-900">Select Your Vehicle</h2>
              <p className="text-xs text-navy-500 mt-0.5">
                Choose the vehicle requiring repair, maintenance, or custom modifications.
              </p>
            </div>
            <Link
              href="/customer/vehicles"
              className="text-xs font-bold text-electric-600 hover:text-electric-700 underline"
            >
              + Add New Vehicle
            </Link>
          </div>

          {loadingVehicles ? (
            <div className="py-12 text-center text-sm text-navy-500">Loading your saved vehicles...</div>
          ) : vehicles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {vehicles.map((v) => {
                const isSelected = selectedVehicleId === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVehicleId(v.id)}
                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-electric-600 bg-electric-50/40 shadow-sm'
                        : 'border-surface-200 hover:border-surface-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-electric-600 bg-electric-600' : 'border-surface-300'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="text-sm font-bold text-navy-900">
                          {v.year} {v.manufacturerName} {v.modelName}
                        </span>
                      </div>
                      {v.isPrimary && (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-navy-900 text-white rounded-full">
                          Primary
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-navy-600 pl-6">
                      <div>
                        <span className="text-navy-400">Plate:</span>{' '}
                        <span className="font-semibold text-navy-800">{v.licensePlate}</span>
                      </div>
                      <div>
                        <span className="text-navy-400">Fuel:</span>{' '}
                        <span className="font-semibold text-navy-800">{v.fuelType}</span>
                      </div>
                      {v.variantName && (
                        <div className="col-span-2">
                          <span className="text-navy-400">Variant:</span>{' '}
                          <span className="font-semibold text-navy-800">{v.variantName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center border-2 border-dashed border-surface-200 rounded-2xl p-6">
              <Car className="w-12 h-12 text-surface-400 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-navy-900">No Vehicles Saved in Your Garage</h3>
              <p className="text-xs text-navy-500 mt-1 max-w-sm mx-auto mb-4">
                You must add at least one vehicle to your profile before creating a service booking.
              </p>
              <Link
                href="/customer/vehicles"
                className="inline-flex items-center gap-2 px-4 py-2 bg-navy-900 text-white text-xs font-semibold rounded-xl hover:bg-navy-800 transition"
              >
                Go to Vehicle Manager
              </Link>
            </div>
          )}

          <div className="pt-4 flex justify-end">
            <button
              onClick={handleNext}
              disabled={!selectedVehicleId}
              className="flex items-center gap-2 px-6 py-2.5 bg-navy-900 text-white text-xs font-bold rounded-xl hover:bg-navy-800 disabled:opacity-50 transition shadow-sm"
            >
              Continue to Location <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: SERVICE LOCATION */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-navy-900">Service Location</h2>
            <p className="text-xs text-navy-500 mt-0.5">
              Specify where your vehicle is currently located. We use PostGIS geospatial indexing to match workshops within 10 KM.
            </p>
          </div>

          {/* Quick-Pick Presets */}
          <div>
            <label className="block text-xs font-bold text-navy-800 mb-2">Quick Fill Bangalore Hubs</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {BANGALORE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="p-2 text-left border border-surface-200 hover:border-electric-500 hover:bg-electric-50/30 rounded-xl text-[11px] font-semibold text-navy-700 transition"
                >
                  <MapPin className="w-3.5 h-3.5 text-electric-600 mb-1" />
                  <div>{preset.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Location Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-navy-800 mb-1">
                Street Address / Landmark <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="e.g. 100 MG Road, Near Metro Pillar 12"
                className="w-full px-3.5 py-2.5 text-xs bg-surface-50 border border-surface-200 rounded-xl focus:outline-none focus:border-navy-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-navy-800 mb-1">Address Line 2 (Optional)</label>
              <input
                type="text"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Apartment, suite, or unit number"
                className="w-full px-3.5 py-2.5 text-xs bg-surface-50 border border-surface-200 rounded-xl focus:outline-none focus:border-navy-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-800 mb-1">
                City <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-surface-50 border border-surface-200 rounded-xl focus:outline-none focus:border-navy-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-800 mb-1">
                State <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-surface-50 border border-surface-200 rounded-xl focus:outline-none focus:border-navy-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-800 mb-1">
                Pincode <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-surface-50 border border-surface-200 rounded-xl focus:outline-none focus:border-navy-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-800 mb-1">Country</label>
              <input
                type="text"
                value={country}
                disabled
                className="w-full px-3.5 py-2.5 text-xs bg-surface-100 border border-surface-200 rounded-xl text-navy-500 cursor-not-allowed"
              />
            </div>

            {/* Coordinates */}
            <div className="sm:col-span-2 pt-2 border-t border-surface-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-navy-800 flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-electric-600" /> Canonical PostGIS Coordinates (WGS84)
                </span>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  className="text-[11px] font-semibold text-electric-600 hover:text-electric-700 flex items-center gap-1"
                >
                  Detect from Browser
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-navy-500 mb-1">Latitude (-90 to 90)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={latitude}
                    onChange={(e) => setLatitude(parseFloat(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs bg-surface-50 border border-surface-200 rounded-xl focus:outline-none focus:border-navy-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-navy-500 mb-1">Longitude (-180 to 180)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={longitude}
                    onChange={(e) => setLongitude(parseFloat(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs bg-surface-50 border border-surface-200 rounded-xl focus:outline-none focus:border-navy-900"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-between">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-5 py-2.5 border border-surface-300 text-navy-700 text-xs font-bold rounded-xl hover:bg-surface-50 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-2.5 bg-navy-900 text-white text-xs font-bold rounded-xl hover:bg-navy-800 transition shadow-sm"
            >
              Continue to Problem Details <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: DESCRIBE PROBLEM */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-navy-900">Service Category & Problem Description</h2>
            <p className="text-xs text-navy-500 mt-0.5">
              Explain the symptoms or custom upgrades needed so partner workshops can evaluate accurately.
            </p>
          </div>

          {/* Service Category */}
          <div>
            <label className="block text-xs font-bold text-navy-800 mb-2">Service Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setServiceCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                    serviceCategory === cat
                      ? 'bg-navy-900 text-white shadow-sm'
                      : 'bg-surface-100 text-navy-700 hover:bg-surface-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Problem Description */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-navy-800">
                Detailed Problem Description <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-navy-400">Min 5 characters</span>
            </div>
            <textarea
              rows={4}
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              placeholder="e.g. Brake pedal feels spongy under high-speed deceleration. Noticed slight squeaking noise from front right rotor. Need inspection and replacement if required."
              className="w-full px-3.5 py-2.5 text-xs bg-surface-50 border border-surface-200 rounded-xl focus:outline-none focus:border-navy-900"
            />
          </div>

          {/* Preferred Service Date */}
          <div>
            <label className="block text-xs font-bold text-navy-800 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-navy-500" /> Preferred Service Date (Optional)
            </label>
            <input
              type="date"
              value={preferredDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setPreferredDate(e.target.value)}
              className="w-full sm:w-64 px-3.5 py-2 text-xs bg-surface-50 border border-surface-200 rounded-xl focus:outline-none focus:border-navy-900"
            />
          </div>

          <div className="pt-4 flex justify-between">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-5 py-2.5 border border-surface-300 text-navy-700 text-xs font-bold rounded-xl hover:bg-surface-50 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-2.5 bg-navy-900 text-white text-xs font-bold rounded-xl hover:bg-navy-800 transition shadow-sm"
            >
              Review Request <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: REVIEW & CONFIRM */}
      {step === 4 && (
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-navy-900">Review Service Request</h2>
            <p className="text-xs text-navy-500 mt-0.5">
              Please verify all details before dispatching to nearby verified workshops.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vehicle Summary */}
            <div className="p-4 bg-surface-50 rounded-xl border border-surface-200 space-y-2">
              <span className="text-[11px] font-bold text-navy-400 uppercase tracking-wider">Vehicle Selected</span>
              {selectedVehicle ? (
                <div>
                  <h3 className="text-sm font-bold text-navy-900">
                    {selectedVehicle.year} {selectedVehicle.manufacturerName} {selectedVehicle.modelName}
                  </h3>
                  <div className="mt-1 text-xs text-navy-600 space-y-0.5">
                    <div>
                      Plate: <span className="font-semibold text-navy-900">{selectedVehicle.licensePlate}</span>
                    </div>
                    <div>
                      Fuel: <span className="font-semibold text-navy-900">{selectedVehicle.fuelType}</span>
                    </div>
                    {selectedVehicle.variantName && (
                      <div>
                        Variant: <span className="font-semibold text-navy-900">{selectedVehicle.variantName}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Location Summary */}
            <div className="p-4 bg-surface-50 rounded-xl border border-surface-200 space-y-2">
              <span className="text-[11px] font-bold text-navy-400 uppercase tracking-wider">Service Location</span>
              <div>
                <h3 className="text-sm font-bold text-navy-900">
                  {city}, {state} - {pincode}
                </h3>
                <p className="text-xs text-navy-600 mt-1">{addressLine1}</p>
                {addressLine2 && <p className="text-xs text-navy-500">{addressLine2}</p>}
                <div className="mt-2 text-[11px] font-mono text-navy-500">
                  Coordinates: {latitude}, {longitude}
                </div>
              </div>
            </div>

            {/* Problem & Category */}
            <div className="md:col-span-2 p-4 bg-surface-50 rounded-xl border border-surface-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-navy-400 uppercase tracking-wider">Service Details</span>
                <span className="px-2.5 py-0.5 bg-navy-900 text-white text-[10px] font-bold rounded-full">
                  {serviceCategory}
                </span>
              </div>
              <p className="text-xs text-navy-900 font-medium whitespace-pre-wrap">{problemDescription}</p>
              {preferredDate && (
                <div className="text-xs text-navy-600 pt-1">
                  Preferred Date: <span className="font-semibold">{new Date(preferredDate).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Guarantee / Dispatch Banner */}
          <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl flex items-start gap-3 text-xs text-blue-900">
            <ShieldCheck className="w-5 h-5 text-electric-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">10 KM Spatial Matching Active: </span>
              Your request will be broadcast to verified partner garages located within 10 KM of your location. Garages will review and submit quotations for our Technical Advisor team to verify.
            </div>
          </div>

          <div className="pt-4 flex justify-between items-center">
            <button
              onClick={handleBack}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 border border-surface-300 text-navy-700 text-xs font-bold rounded-xl hover:bg-surface-50 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={handleSubmitBooking}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-electric-600 hover:bg-electric-700 text-white text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Broadcasting Request...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Confirm & Dispatch Request
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: SUCCESS / CONFIRMATION */}
      {step === 5 && createdRequest && (
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full uppercase tracking-wider">
              Request Dispatched Successfully
            </span>
            <h2 className="text-2xl font-black text-navy-900 mt-3">
              Request Number: {createdRequest.requestNumber}
            </h2>
            <p className="text-xs text-navy-600 mt-2 max-w-md mx-auto">
              Your service request has been created and broadcast to verified workshops in your area.
            </p>
          </div>

          {/* Stats Box */}
          <div className="grid grid-cols-2 max-w-sm mx-auto gap-4 p-4 bg-surface-50 rounded-xl border border-surface-200 text-left">
            <div>
              <span className="text-[10px] text-navy-400 font-bold uppercase">Status</span>
              <div className="text-xs font-bold text-navy-900">{createdRequest.status}</div>
            </div>
            <div>
              <span className="text-[10px] text-navy-400 font-bold uppercase">Workshops Matched</span>
              <div className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                {createdRequest.matchedGaragesCount} within 10 KM
              </div>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/customer/requests"
              className="w-full sm:w-auto px-6 py-2.5 bg-navy-900 text-white text-xs font-bold rounded-xl hover:bg-navy-800 transition shadow-sm"
            >
              View All Service Requests
            </Link>
            <button
              onClick={() => {
                setStep(1);
                setCreatedRequest(null);
                setProblemDescription('');
              }}
              className="w-full sm:w-auto px-6 py-2.5 border border-surface-300 text-navy-700 text-xs font-bold rounded-xl hover:bg-surface-50 transition"
            >
              Book Another Service
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
