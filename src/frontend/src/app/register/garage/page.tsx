import React from 'react';
import type { Metadata } from 'next';
import { GarageSignup } from './GarageSignup';

export const metadata: Metadata = {
  title: 'Register your garage',
  description: 'Partner with BroCo: get car service jobs from car owners near your workshop.',
};

// Lives under /register (not /garage), so it is outside the signed-in garage portal.
export default function GarageRegisterPage() {
  return <GarageSignup />;
}
