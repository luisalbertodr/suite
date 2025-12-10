
import React from 'react';
import { AlbaranesSalida } from '../components/AlbaranesSalida';
import { PageWrapper } from '@/components/PageWrapper';

const AlbaranesSalidaPage: React.FC = () => {
  return (
    <PageWrapper resource="delivery_notes_out" action="read">
      <AlbaranesSalida />
    </PageWrapper>
  );
};

export default AlbaranesSalidaPage;
