import React from 'react';
import { RecursosCabinas } from '../components/RecursosCabinas';
import { PageWrapper } from '@/components/PageWrapper';

const RecursosCabinasPage: React.FC = () => {
  return (
    <PageWrapper resource="settings" action="read">
      <RecursosCabinas />
    </PageWrapper>
  );
};

export default RecursosCabinasPage;
