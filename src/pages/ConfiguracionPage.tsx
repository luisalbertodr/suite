
import React from 'react';
import { Configuracion } from '../components/Configuracion';
import { PageWrapper } from '@/components/PageWrapper';

const ConfiguracionPage: React.FC = () => {
  return (
    <PageWrapper resource="settings" action="read">
      <Configuracion />
    </PageWrapper>
  );
};

export default ConfiguracionPage;
