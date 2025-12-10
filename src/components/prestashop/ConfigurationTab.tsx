
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TestTube, Activity } from 'lucide-react';
import { usePrestashopConfig } from '@/hooks/usePrestashopConfig';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export const ConfigurationTab: React.FC = () => {
  const { config, isLoading, saveConfig, isSaving, testConnection, isTesting } = usePrestashopConfig();

  const [formData, setFormData] = useState({
    api_url: '',
    api_key: '',
    webhook_secret: '',
    is_active: true,
    sync_frequency: 300,
  });

  useEffect(() => {
    if (config) {
      setFormData({
        api_url: config.api_url || '',
        api_key: config.api_key || '',
        webhook_secret: config.webhook_secret || '',
        is_active: config.is_active,
        sync_frequency: config.sync_frequency,
      });
    }
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveConfig({
        ...formData,
        company_id: config?.company_id || '',
      });
    } catch (error) {
      console.error('Error saving config:', error);
    }
  };

  const handleTestConnection = async () => {
    try {
      await testConnection({
        api_url: formData.api_url,
        api_key: formData.api_key,
      });
    } catch (error) {
      console.error('Error testing connection:', error);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Cargando configuración...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración de PrestaShop</CardTitle>
        <CardDescription>
          Configure su tienda PrestaShop para sincronizar productos y stock
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="api_url">URL de la API</Label>
              <Input
                id="api_url"
                type="url"
                placeholder="https://tu-tienda.com/api"
                value={formData.api_url}
                onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                type="password"
                placeholder="Clave de API de PrestaShop"
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook_secret">Webhook Secret (Opcional)</Label>
              <Input
                id="webhook_secret"
                type="password"
                placeholder="Secreto para webhooks"
                value={formData.webhook_secret}
                onChange={(e) => setFormData({ ...formData, webhook_secret: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sync_frequency">Frecuencia de Sync (segundos)</Label>
              <Input
                id="sync_frequency"
                type="number"
                min="60"
                placeholder="300"
                value={formData.sync_frequency}
                onChange={(e) => setFormData({ ...formData, sync_frequency: parseInt(e.target.value) || 300 })}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Activar integración</Label>
          </div>

          <div className="flex space-x-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar Configuración'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting || !formData.api_url || !formData.api_key}
            >
              <TestTube className="w-4 h-4 mr-2" />
              {isTesting ? 'Probando...' : 'Probar Conexión'}
            </Button>
          </div>
        </form>

        {config?.last_sync_at && (
          <Alert className="mt-4">
            <Activity className="h-4 w-4" />
            <AlertDescription>
              Última sincronización: {formatDistanceToNow(new Date(config.last_sync_at), { 
                addSuffix: true, 
                locale: es 
              })}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
