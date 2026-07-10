import React from 'react';
import { DunasoftAgenda } from '@/components/DunasoftAgenda';
import { AgendaFullViewportShell } from '@/components/AgendaFullViewportShell';
import { PageWrapper } from '@/components/PageWrapper';

const DunasoftAgendaPage: React.FC = () => {
  return (
    <PageWrapper resource="agenda" action="read">
      <AgendaFullViewportShell>
        <DunasoftAgenda />
      </AgendaFullViewportShell>
    </PageWrapper>
  );
};

export default DunasoftAgendaPage;
