'use client';

import React from 'react';
import { FileText, Radio, ShieldCheck } from 'lucide-react';

export default function AdminRequestsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Platform Service Requests</h1>
        <p className="text-xs text-navy-600 mt-1">
          Global supervision of service requests, PostGIS 10 KM radial matching, and quotes pipeline.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6">
        <div className="flex items-center gap-3 pb-4 border-b border-surface-100">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-electric-600 flex items-center justify-center">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-navy-900">Geospatial Matching Engine Status</h3>
            <p className="text-xs text-navy-600">PostGIS ST_DWithin operational (Default 10.0 KM Search Radius)</p>
          </div>
        </div>

        <div className="py-12 text-center text-xs text-navy-600">
          Requests are dispatched dynamically based on customer coordinates (EPSG:4326).
          Full request list will synchronize with live dispatches in Milestone 3.
        </div>
      </div>
    </div>
  );
}
