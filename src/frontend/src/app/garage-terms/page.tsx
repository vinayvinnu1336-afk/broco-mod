import type { Metadata } from 'next';
import React from 'react';
import { garageTerms } from '@/content/legal/garage-terms';
import { LegalDocument } from '../_public/LegalDocument';

export const metadata: Metadata = {
  title: 'Garage Partner Terms & Conditions',
  description:
    'The terms for independent garages and service partners that accept vehicle service jobs through the BroCo platform.',
};

export default function GarageTermsPage() {
  return <LegalDocument doc={garageTerms} path="/garage-terms" />;
}
