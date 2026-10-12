import type { Metadata } from 'next';
import React, { Suspense } from 'react';
import { PublicHeader } from '../../_public/PublicHeader';
import { PublicFooter } from '../../_public/PublicFooter';
import { CarServiceContent, CarServiceSkeleton } from './CarServiceContent';

export const metadata: Metadata = {
  title: 'Car service packages in Hyderabad',
  description:
    'Basic, Standard and Premium car service packages with a fixed price for your car. Pay 10% online to book and the rest at the garage after the service.',
};

export default function CarServicePage() {
  return (
    <div className="min-h-screen bg-surface-50 text-navy-900">
      <PublicHeader />
      <main>
        <Suspense fallback={<CarServiceSkeleton />}>
          <CarServiceContent />
        </Suspense>
      </main>
      <PublicFooter />
      {/* Room for the phone booking bar so it never covers the footer. */}
      <div className="h-[92px] bg-navy-950 md:hidden" aria-hidden />
    </div>
  );
}
