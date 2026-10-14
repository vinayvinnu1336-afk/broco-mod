'use client';

import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { GarageDuesBoard } from '@/components/commissions/GarageDuesBoard';

export default function AdvisorGarageDuesPage() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Garage dues"
        description="Commission plus GST garages still owe BroCo after handing cars back. Remind garages that are late; admins record payments."
      />
      <GarageDuesBoard portal="advisor" />
    </div>
  );
}
