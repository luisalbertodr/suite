import React from 'react';
import { Marketing } from '@/components/Marketing';
import { PageWrapper } from '@/components/PageWrapper';
import { MarketingPermissionGate } from '@/components/marketing/MarketingPermissionGate';

const MarketingPage: React.FC = () => {
  return (
    <PageWrapper>
      <MarketingPermissionGate>
        <Marketing />
      </MarketingPermissionGate>
    </PageWrapper>
  );
};

export default MarketingPage;
