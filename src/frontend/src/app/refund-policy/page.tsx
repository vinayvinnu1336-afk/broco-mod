import type { Metadata } from 'next';
import React from 'react';
import { refundPolicy } from '@/content/legal/refund-policy';
import { LegalDocument } from '../_public/LegalDocument';

export const metadata: Metadata = {
  title: 'Cancellation & Refund Policy',
  description:
    'How to cancel a BroCo booking, when cancellation charges of 7% (garage visit) or 10% (pick-up & drop) may apply, and how refunds are calculated and processed.',
};

export default function RefundPolicyPage() {
  return <LegalDocument doc={refundPolicy} path="/refund-policy" />;
}
