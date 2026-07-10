
import React from 'react';
import { Agenda } from '../components/Agenda';
import { AgendaFullViewportShell } from '@/components/AgendaFullViewportShell';
import { PageWrapper } from '@/components/PageWrapper';

const AgendaPage: React.FC = () => {
  return (
    <PageWrapper resource="agenda" action="read">
      <AgendaFullViewportShell>
        <Agenda />
      </AgendaFullViewportShell>
    </PageWrapper>
  );
};

export default AgendaPage;
