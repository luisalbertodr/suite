
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw } from 'lucide-react';
import { usePrestashopConfig } from '@/hooks/usePrestashopConfig';
import { usePrestashopSync } from '@/hooks/usePrestashopSync';

export const SyncTab: React.FC = () => {
  const { config } = usePrestashopConfig();
  const { syncStock, isSyncing } = usePrestashopSync();

  const handleSyncStock = async (direction: 'inbound' | 'outbound' | 'bidirectional') => {
    try {
      await syncStock(direction);
    } catch (error) {
      console.error('Error syncing stock:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sincronización de Stock</CardTitle>
        <CardDescription>
          Sincronize el stock entre su sistema y PrestaShop
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            onClick={() => handleSyncStock('inbound')}
            disabled={isSyncing || !config?.is_active}
            className="flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Desde PrestaShop</span>
          </Button>
          <Button
            onClick={() => handleSyncStock('outbound')}
            disabled={isSyncing || !config?.is_active}
            className="flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Hacia PrestaShop</span>
          </Button>
          <Button
            onClick={() => handleSyncStock('bidirectional')}
            disabled={isSyncing || !config?.is_active}
            className="flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Bidireccional</span>
          </Button>
        </div>

        {!config?.is_active && (
          <Alert>
            <AlertDescription>
              Configure y active la integración para poder sincronizar stock
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
