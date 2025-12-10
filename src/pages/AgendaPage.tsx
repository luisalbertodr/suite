
import React from 'react';
import { Agenda } from '../components/Agenda';
import { PageWrapper } from '@/components/PageWrapper';

const AgendaPage: React.FC = () => {
  return (
    <PageWrapper resource="agenda" action="read">
      <Agenda />
    </PageWrapper>
  );
};

export default AgendaPage;
