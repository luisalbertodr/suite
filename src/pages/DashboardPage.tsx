
import React from 'react';
import { Dashboard } from '../components/Dashboard';
import { PageWrapper } from '@/components/PageWrapper';
import { DASHBOARD_ACCESS_PERMISSIONS } from '@/lib/menuPermissions';

const DashboardPage: React.FC = () => {
  return (
    <PageWrapper anyOf={DASHBOARD_ACCESS_PERMISSIONS}>
      <Dashboard />
    </PageWrapper>
  );
};

export default DashboardPage;
