'use client';

import React from 'react';
import { CarFront, Database, Check } from 'lucide-react';

export default function AdminVehicleMasterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Vehicle Master Database</h1>
        <p className="text-xs text-navy-600 mt-1">
          Standardized OEM make, model, trim, and engine displacement reference schemas.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-surface-100">
          <div className="w-10 h-10 rounded-xl bg-surface-100 text-navy-800 flex items-center justify-center">
            <CarFront className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-navy-900">OEM Model Master Index</h3>
            <p className="text-xs text-navy-600">Standardized European, Asian, and Domestic performance catalogs</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-surface-50 border border-surface-200">
            <span className="font-bold text-navy-900 block mb-1">BMW</span>
            <span className="text-navy-600">3-Series (G20), M3 (G80), M4, M5, X3 M, X5 M</span>
          </div>
          <div className="p-4 rounded-xl bg-surface-50 border border-surface-200">
            <span className="font-bold text-navy-900 block mb-1">Audi / VW</span>
            <span className="text-navy-600">RS3, RS6 Avant, Golf R, GTI, S4, S5</span>
          </div>
          <div className="p-4 rounded-xl bg-surface-50 border border-surface-200">
            <span className="font-bold text-navy-900 block mb-1">Mercedes-AMG</span>
            <span className="text-navy-600">C63 AMG, A45 AMG, E63S AMG, GT Coupe</span>
          </div>
        </div>
      </div>
    </div>
  );
}
