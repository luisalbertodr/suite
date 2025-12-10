
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfigurationTab } from './prestashop/ConfigurationTab';
import { SyncTab } from './prestashop/SyncTab';
import { MappingsTab } from './prestashop/MappingsTab';
import { LogsTab } from './prestashop/LogsTab';

export const PrestashopConfig: React.FC = () => {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="config">Configuración</TabsTrigger>
          <TabsTrigger value="sync">Sincronización</TabsTrigger>
          <TabsTrigger value="mappings">Mapeos</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <ConfigurationTab />
        </TabsContent>

        <TabsContent value="sync" className="space-y-4">
          <SyncTab />
        </TabsContent>

        <TabsContent value="mappings" className="space-y-4">
          <MappingsTab />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <LogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};
