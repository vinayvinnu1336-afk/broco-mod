import type { Metadata } from 'next';
import React from 'react';
import { privacyPolicy } from '@/content/legal/privacy';
import { LegalDocument } from '../_public/LegalDocument';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How BroCo Mobility Solutions (BroCo) collects, uses, shares, retains and protects your personal and vehicle information, and the privacy rights you have.',
};

export default function PrivacyPage() {
  return <LegalDocument doc={privacyPolicy} path="/privacy" />;
}
