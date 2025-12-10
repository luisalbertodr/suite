
import React from 'react';
import { Reportes } from '../components/Reportes';
import { PageWrapper } from '@/components/PageWrapper';

const ReportesPage: React.FC = () => {
  return (
    <PageWrapper resource="reports" action="read">
      <Reportes />
    </PageWrapper>
  );
};

export default ReportesPage;
