
import React from 'react';
import { Dashboard } from '../components/Dashboard';
import { PageWrapper } from '@/components/PageWrapper';

const DashboardPage: React.FC = () => {
  return (
    <PageWrapper resource="dashboard" action="read">
      <Dashboard />
    </PageWrapper>
  );
};

export default DashboardPage;
