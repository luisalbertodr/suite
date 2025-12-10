
import React from 'react';
import { TPV } from '../components/TPV';
import { PageWrapper } from '@/components/PageWrapper';

const TPVPage: React.FC = () => {
  return (
    <PageWrapper resource="sales" action="read">
      <TPV />
    </PageWrapper>
  );
};

export default TPVPage;
