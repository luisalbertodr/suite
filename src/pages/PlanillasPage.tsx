
import React from 'react';
import { PageWrapper } from '@/components/PageWrapper';
import { Planillas } from '@/components/Planillas';

export default function PlanillasPage() {
  return (
    <PageWrapper resource="planillas" action="read">
      <Planillas />
    </PageWrapper>
  );
}
