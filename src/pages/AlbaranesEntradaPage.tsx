
import React from 'react';
import { AlbaranesEntrada } from '../components/AlbaranesEntrada';
import { PageWrapper } from '@/components/PageWrapper';

const AlbaranesEntradaPage: React.FC = () => {
  return (
    <PageWrapper resource="delivery_notes" action="read">
      <AlbaranesEntrada />
    </PageWrapper>
  );
};

export default AlbaranesEntradaPage;
