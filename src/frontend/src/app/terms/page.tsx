import type { Metadata } from 'next';
import React from 'react';
import { customerTerms } from '@/content/legal/terms';
import { LegalDocument } from '../_public/LegalDocument';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description:
    'The terms for booking vehicle inspection, servicing and repairs through BroCo Mobility Solutions (BroCo): bookings, quotations and approvals, pick-up and drop, payments, warranty and complaints.',
};

export default function TermsPage() {
  return <LegalDocument doc={customerTerms} path="/terms" />;
}
