import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CustomerSignup } from './CustomerSignup';
import { SignupFallback } from './_components/signup';

export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Sign up to book car service from verified garages near you.',
};

export default function RegisterPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  // Old "Register your garage" links used /register?role=garage.
  const role = searchParams.role;
  if ((Array.isArray(role) ? role[0] : role)?.toLowerCase() === 'garage') redirect('/register/garage');

  return (
    <Suspense fallback={<SignupFallback />}>
      <CustomerSignup />
    </Suspense>
  );
}
