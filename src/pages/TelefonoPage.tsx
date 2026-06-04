import React from 'react';
import { PageWrapper } from '@/components/PageWrapper';
import { Telefono } from '@/components/Telefono';
import { PHONE_PERMISSION_ALL, PHONE_PERMISSION_MISSED } from '@/lib/phonePermissions';

const TelefonoPage: React.FC = () => {
  return (
    <PageWrapper anyOf={[PHONE_PERMISSION_ALL, PHONE_PERMISSION_MISSED]}>
      <Telefono />
    </PageWrapper>
  );
};

export default TelefonoPage;
