
import React from 'react';
import { SuperuserManagement } from '@/components/SuperuserManagement';

const SuperuserManagementPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto p-6">
        <SuperuserManagement />
      </div>
    </div>
  );
};

export default SuperuserManagementPage;
