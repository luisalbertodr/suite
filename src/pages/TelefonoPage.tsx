import React from 'react';
import { PageWrapper } from '@/components/PageWrapper';
import { Telefono } from '@/components/Telefono';

const TelefonoPage: React.FC = () => {
  return (
    <PageWrapper resource="phone" action="read">
      <Telefono />
    </PageWrapper>
  );
};

export default TelefonoPage;
