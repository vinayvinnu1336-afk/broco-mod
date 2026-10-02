'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Car, Plus, ShieldCheck, Gauge, Hash, Check } from 'lucide-react';

interface Vehicle {
  id: string;
  customerId: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  vin: string;
  mileage: number;
}

export default function CustomerVehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [make, setMake] = useState('BMW');
  const [model, setModel] = useState('M340i xDrive');
  const [year, setYear] = useState(2022);
  const [licensePlate, setLicensePlate] = useState('BROCO-01');
  const [vin, setVin] = useState('WBA5U7C06NF123456');
  const [mileage, setMileage] = useState(24500);
  const [submitting, setSubmitting] = useState(false);

  const loadVehicles = async () => {
    const res = await apiFetch<Vehicle[]>('/customer/vehicles');
    if (res.success && res.data) {
      setVehicles(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await apiFetch<Vehicle>('/customer/vehicles', {
      method: 'POST',
      body: JSON.stringify({ make, model, year, licensePlate, vin, mileage }),
    });
    if (res.success) {
      await loadVehicles();
      setShowAddModal(false);
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">My Registered Vehicles</h1>
          <p className="text-xs text-navy-600 mt-1">
            Registered vehicles in your BroCo Mod garage for service and modification matching.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-electric-500 hover:bg-electric-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Vehicle</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-navy-600">Loading vehicles...</div>
      ) : vehicles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {vehicles.map((v) => (
            <div
              key={v.id}
              className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-bold text-electric-600 uppercase tracking-wider">
                    {v.year} Model
                  </div>
                  <h3 className="text-xl font-extrabold text-navy-900 mt-0.5">
                    {v.make} {v.model}
                  </h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-surface-100 border border-surface-200 flex items-center justify-center text-navy-700">
                  <Car className="w-6 h-6" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-surface-100 text-xs">
                <div>
                  <span className="text-navy-600 block">License Plate</span>
                  <span className="font-mono font-bold text-navy-900 bg-surface-100 px-2 py-0.5 rounded">
                    {v.licensePlate}
                  </span>
                </div>
                <div>
                  <span className="text-navy-600 block">Odometer</span>
                  <span className="font-semibold text-navy-900">{v.mileage.toLocaleString()} KM</span>
                </div>
                <div className="col-span-2">
                  <span className="text-navy-600 block">Vehicle VIN</span>
                  <span className="font-mono text-navy-700 text-[11px] truncate block">{v.vin || 'VIN Not Disclosed'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 bg-white rounded-2xl border border-dashed border-surface-300 text-center p-8">
          <Car className="w-12 h-12 text-navy-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-900">No Vehicles Registered</h3>
          <p className="text-xs text-navy-600 mt-1 max-w-sm mx-auto mb-4">
            Add your car to request service diagnostics and performance upgrades from certified garages.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-electric-500 hover:bg-electric-600 text-white rounded-xl text-xs font-semibold"
          >
            Register Vehicle Now
          </button>
        </div>
      )}

      {/* Add Vehicle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-navy-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-surface-200">
            <h3 className="text-lg font-bold text-navy-900 mb-1">Add Vehicle to Garage</h3>
            <p className="text-xs text-navy-600 mb-4">Enter specifications of your vehicle.</p>

            <form onSubmit={handleAddVehicle} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-navy-700 uppercase mb-1">Make</label>
                  <input
                    type="text"
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    className="w-full px-3 py-2 border border-surface-300 rounded-xl text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-navy-700 uppercase mb-1">Model</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 border border-surface-300 rounded-xl text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-navy-700 uppercase mb-1">Year</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-surface-300 rounded-xl text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-navy-700 uppercase mb-1">License Plate</label>
                  <input
                    type="text"
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    className="w-full px-3 py-2 border border-surface-300 rounded-xl text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-navy-700 uppercase mb-1">VIN (Optional)</label>
                <input
                  type="text"
                  value={vin}
                  onChange={(e) => setVin(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-300 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-navy-700 uppercase mb-1">Current Mileage (KM)</label>
                <input
                  type="number"
                  value={mileage}
                  onChange={(e) => setMileage(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-surface-300 rounded-xl text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-surface-200 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-surface-300 text-navy-700 text-xs font-semibold rounded-xl hover:bg-surface-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-electric-500 hover:bg-electric-600 text-white text-xs font-semibold rounded-xl"
                >
                  {submitting ? 'Saving...' : 'Add Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
