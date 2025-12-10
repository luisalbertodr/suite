
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { Settings, Save, AlertCircle } from 'lucide-react';

export const VerifactuCompanyConfig: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const [isLoading, setIsLoading] = useState(false);

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['verifactu-company-config', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const { data, error } = await supabase
        .from('verifactu_company_config')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    },
    enabled: !!companyId && !companyLoading,
  });

  const [formData, setFormData] = useState({
    environment: 'test',
    nif_emisor: '',
    nombre_razon: '',
    software_name: 'Sistema de Facturación',
    software_version: '1.0',
    id_software: '',
    numero_instalacion: '',
    hash_anterior: '',
    auto_send: false,
    endpoint_url: '',
    timeout_seconds: 30,
    max_retries: 3,
    retry_delay_seconds: 60,
    enable_xades_signature: false,
    xades_signature_type: 'XAdES-BES',
    include_timestamp: false,
  });

  React.useEffect(() => {
    if (config) {
      setFormData({
        environment: config.environment || 'test',
        nif_emisor: config.nif_emisor || '',
        nombre_razon: config.nombre_razon || '',
        software_name: config.software_name || 'Sistema de Facturación',
        software_version: config.software_version || '1.0',
        id_software: config.id_software || '',
        numero_instalacion: config.numero_instalacion || '',
        hash_anterior: config.hash_anterior || '',
        auto_send: config.auto_send || false,
        endpoint_url: config.endpoint_url || (config.environment === 'production' 
          ? 'https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP'
          : 'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP'),
        timeout_seconds: config.timeout_seconds || 30,
        max_retries: config.max_retries || 3,
        retry_delay_seconds: config.retry_delay_seconds || 60,
        enable_xades_signature: config.enable_xades_signature || false,
        xades_signature_type: config.xades_signature_type || 'XAdES-BES',
        include_timestamp: config.include_timestamp || false,
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!companyId) throw new Error('No company ID');

      if (config) {
        const { error } = await supabase
          .from('verifactu_company_config')
          .update(data)
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('verifactu_company_config')
          .insert({ ...data, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Configuración guardada',
        description: 'La configuración de Verifactu ha sido guardada correctamente.',
      });
      queryClient.invalidateQueries({ queryKey: ['verifactu-company-config'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al guardar',
        description: error.message || 'Ha ocurrido un error al guardar la configuración.',
        variant: 'destructive',
      });
    },
  });

  const handleSave = async () => {
    if (!formData.nif_emisor.trim()) {
      toast({
        title: 'Campo requerido',
        description: 'El NIF del emisor es obligatorio.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.nombre_razon.trim()) {
      toast({
        title: 'Campo requerido',
        description: 'El nombre/razón social es obligatorio.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      await saveMutation.mutateAsync(formData);
    } finally {
      setIsLoading(false);
    }
  };

  if (companyLoading || configLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-8">
          <p>Cargando configuración...</p>
        </CardContent>
      </Card>
    );
  }

  if (!companyId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 space-y-4">
          <AlertCircle className="w-12 h-12 text-yellow-500" />
          <div className="text-center">
            <h3 className="text-lg font-medium">No se pudo cargar la empresa</h3>
            <p className="text-gray-600">Por favor, recarga la página.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Settings className="w-5 h-5" />
          <span>Configuración Verifactu</span>
        </CardTitle>
        <CardDescription>
          Configura los parámetros necesarios para la integración con Verifactu de la AEAT
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Environment Toggle */}
        <div className="space-y-4 p-4 border rounded-lg bg-card">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-medium">Entorno de la AEAT</Label>
              <p className="text-sm text-muted-foreground">
                {formData.environment === 'production' 
                  ? 'Entorno de Producción - Facturas reales' 
                  : 'Entorno de Pruebas - Para testing'}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`text-sm font-medium ${formData.environment === 'test' ? 'text-primary' : 'text-muted-foreground'}`}>
                Pruebas
              </span>
              <Switch
                checked={formData.environment === 'production'}
                onCheckedChange={(checked) => {
                  const newEnvironment = checked ? 'production' : 'test';
                  const newEndpointUrl = checked 
                    ? 'https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP'
                    : 'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP';
                  
                  setFormData(prev => ({ 
                    ...prev, 
                    environment: newEnvironment,
                    endpoint_url: newEndpointUrl
                  }));
                }}
                className="data-[state=checked]:bg-destructive"
              />
              <span className={`text-sm font-medium ${formData.environment === 'production' ? 'text-destructive' : 'text-muted-foreground'}`}>
                Producción
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="nif_emisor">NIF Emisor *</Label>
            <Input
              id="nif_emisor"
              value={formData.nif_emisor}
              onChange={(e) => setFormData(prev => ({ ...prev, nif_emisor: e.target.value }))}
              placeholder="12345678A"
              required
            />
          </div>

          <div>
            <Label htmlFor="nombre_razon">Nombre/Razón Social *</Label>
            <Input
              id="nombre_razon"
              value={formData.nombre_razon}
              onChange={(e) => setFormData(prev => ({ ...prev, nombre_razon: e.target.value }))}
              placeholder="Mi Empresa S.L."
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="software_name">Nombre del Software</Label>
            <Input
              id="software_name"
              value={formData.software_name}
              onChange={(e) => setFormData(prev => ({ ...prev, software_name: e.target.value }))}
              placeholder="Sistema de Facturación"
            />
          </div>

          <div>
            <Label htmlFor="software_version">Versión del Software</Label>
            <Input
              id="software_version"
              value={formData.software_version}
              onChange={(e) => setFormData(prev => ({ ...prev, software_version: e.target.value }))}
              placeholder="1.0"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="id_software">ID Software</Label>
            <Input
              id="id_software"
              value={formData.id_software}
              onChange={(e) => setFormData(prev => ({ ...prev, id_software: e.target.value }))}
              placeholder="ID proporcionado por la AEAT"
            />
          </div>

          <div>
            <Label htmlFor="numero_instalacion">Número de Instalación</Label>
            <Input
              id="numero_instalacion"
              value={formData.numero_instalacion}
              onChange={(e) => setFormData(prev => ({ ...prev, numero_instalacion: e.target.value }))}
              placeholder="Número de instalación"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="hash_anterior">Hash Anterior</Label>
          <Input
            id="hash_anterior"
            value={formData.hash_anterior}
            onChange={(e) => setFormData(prev => ({ ...prev, hash_anterior: e.target.value }))}
            placeholder="Hash de la cadena anterior (opcional para la primera factura)"
          />
        </div>

        <div>
          <Label htmlFor="endpoint_url">URL del Endpoint AEAT</Label>
          <Input
            id="endpoint_url"
            value={formData.endpoint_url}
            onChange={(e) => setFormData(prev => ({ ...prev, endpoint_url: e.target.value }))}
            placeholder="https://prewww10.aeat.es/wlpl/TIKE-CONT-WS/services/VeriFactuSistemaFacturacion"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="timeout_seconds">Timeout (segundos)</Label>
            <Input
              id="timeout_seconds"
              type="number"
              min="10"
              max="120"
              value={formData.timeout_seconds}
              onChange={(e) => setFormData(prev => ({ ...prev, timeout_seconds: parseInt(e.target.value) || 30 }))}
            />
          </div>

          <div>
            <Label htmlFor="max_retries">Máximo Reintentos</Label>
            <Input
              id="max_retries"
              type="number"
              min="1"
              max="10"
              value={formData.max_retries}
              onChange={(e) => setFormData(prev => ({ ...prev, max_retries: parseInt(e.target.value) || 3 }))}
            />
          </div>

          <div>
            <Label htmlFor="retry_delay_seconds">Retraso Reintento (seg)</Label>
            <Input
              id="retry_delay_seconds"
              type="number"
              min="30"
              max="300"
              value={formData.retry_delay_seconds}
              onChange={(e) => setFormData(prev => ({ ...prev, retry_delay_seconds: parseInt(e.target.value) || 60 }))}
            />
          </div>
        </div>

        <div className="space-y-4 border-t pt-4">
          <h3 className="text-lg font-medium">Firma Digital XAdES</h3>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="enable_xades_signature"
              checked={formData.enable_xades_signature}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enable_xades_signature: checked }))}
            />
            <Label htmlFor="enable_xades_signature">Habilitar firma XAdES</Label>
          </div>

          {formData.enable_xades_signature && (
            <div className="grid grid-cols-2 gap-4 ml-6">
              <div>
                <Label htmlFor="xades_signature_type">Tipo de Firma XAdES</Label>
                <Select 
                  value={formData.xades_signature_type} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, xades_signature_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XAdES-BES">XAdES-BES (Básica)</SelectItem>
                    <SelectItem value="XAdES-T">XAdES-T (Con Timestamp)</SelectItem>
                    <SelectItem value="XAdES-C">XAdES-C (Con Referencias)</SelectItem>
                    <SelectItem value="XAdES-X">XAdES-X (Extendida)</SelectItem>
                    <SelectItem value="XAdES-XL">XAdES-XL (Con Validación)</SelectItem>
                    <SelectItem value="XAdES-A">XAdES-A (Archival)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2 mt-6">
                <Switch
                  id="include_timestamp"
                  checked={formData.include_timestamp}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, include_timestamp: checked }))}
                />
                <Label htmlFor="include_timestamp">Incluir Timestamp (TSA)</Label>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="auto_send"
            checked={formData.auto_send}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, auto_send: checked }))}
          />
          <Label htmlFor="auto_send">Envío automático a Verifactu</Label>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isLoading}>
            <Save className="w-4 h-4 mr-2" />
            {isLoading ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
