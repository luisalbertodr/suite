import React from 'react';
import { DunasoftAgenda } from '@/components/DunasoftAgenda';
import { PageWrapper } from '@/components/PageWrapper';

const DunasoftAgendaPage: React.FC = () => {
  return (
    <PageWrapper resource="agenda" action="read">
      <DunasoftAgenda />
    </PageWrapper>
  );
};

export default DunasoftAgendaPage;
