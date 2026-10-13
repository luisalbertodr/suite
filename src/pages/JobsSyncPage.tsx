import React from 'react';
import { JobsAndSyncPanel } from '@/components/JobsAndSyncPanel';

const JobsSyncPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-3xl space-y-3 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Jobs y sync</h1>
        <p className="text-sm text-muted-foreground">
          F5 Inngest (trabajos durables) y F6 ElectricSQL (sync Postgres → cliente).
        </p>
      </div>
      <JobsAndSyncPanel />
    </div>
  );
};

export default JobsSyncPage;
