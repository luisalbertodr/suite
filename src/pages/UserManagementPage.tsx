
import React from 'react';
import { UserManagement } from '../components/UserManagement';
import { PageWrapper } from '@/components/PageWrapper';

const UserManagementPage: React.FC = () => {
  return (
    <PageWrapper resource="users" action="read">
      <UserManagement />
    </PageWrapper>
  );
};

export default UserManagementPage;
