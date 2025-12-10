
import React from 'react';
import { Empresas } from '../components/Empresas';
import { PageWrapper } from '@/components/PageWrapper';

const EmpresasPage: React.FC = () => {
  return (
    <PageWrapper resource="companies" action="read">
      <Empresas />
    </PageWrapper>
  );
};

export default EmpresasPage;
