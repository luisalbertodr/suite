import React from 'react';
import { Marketing } from '@/components/Marketing';
import { PageWrapper } from '@/components/PageWrapper';

const MarketingPage: React.FC = () => {
  return (
    <PageWrapper resource="marketing" action="read">
      <Marketing />
    </PageWrapper>
  );
};

export default MarketingPage;
