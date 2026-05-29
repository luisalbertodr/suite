
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Download, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { PrestashopConfig } from './PrestashopConfig';
import { AppearanceConfig } from './AppearanceConfig';
import { EmailConfig } from './EmailConfig';
import { VerifactuCertificates } from './VerifactuCertificates';
import { VerifactuCompanyConfig } from './VerifactuCompanyConfig';
import { VerifactuXMLDocuments } from './VerifactuXMLDocuments';
import { SecurityAudit } from './SecurityAudit';
import { Empresas } from './Empresas';
import { RecursosCabinas } from './RecursosCabinas';
import { EmployeesConfig } from './EmployeesConfig';
import { AgendaPreferencesConfig } from './AgendaPreferencesConfig';
import { AgendaCenterHoursConfig } from './AgendaCenterHoursConfig';
import { AgendaEmployeeHoursConfig } from './AgendaEmployeeHoursConfig';
import { UserManagement } from './UserManagement';
import { MetaConfig } from './MetaConfig';
import { WhatsappConfig } from './WhatsappConfig';
import { WorkCenterAuditPanel } from './WorkCenterAuditPanel';
import { LegacyImportPanel } from './LegacyImportPanel';
import { useWorkCenter } from '@/hooks/useWorkCenter';

const VALID_TABS = [
  'general',
  'empresa',
  'empleados',
  'agenda',
  'recursos',
  'apariencia',
  'email',
  'meta',
  'whatsapp',
  'prestashop',
  'verifactu',
  'verifactu-xml',
  'seguridad',
  'usuarios-permisos',
  'centro-laboral',
] as const;

type ConfigTab = (typeof VALID_TABS)[number];

export const Configuracion: React.FC = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isGeneratingBackup, setIsGeneratingBackup] = useState(false);
  const { isMultiEntity } = useWorkCenter();

  const tabParam = searchParams.get('tab') ?? '';
  const activeTab: ConfigTab = (VALID_TABS as readonly string[]).includes(tabParam)
    ? (tabParam as ConfigTab)
    : 'general';

  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'general') {
      next.delete('tab');
    } else {
      next.set('tab', value);
    }
    setSearchParams(next, { replace: true });
  };

  const handleGenerateBackup = async () => {
    try {
      setIsGeneratingBackup(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No hay sesión activa');
      }

      const response = await supabase.functions.invoke('generate-backup', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw response.error;
      }

      const blob = new Blob([response.data], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-${Date.now()}.sql`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Copia de seguridad generada',
        description: 'El archivo SQL se ha descargado correctamente',
      });
    } catch (error) {
      console.error('Error generando backup:', error);
      toast({
        title: 'Error',
        description: 'No se pudo generar la copia de seguridad',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingBackup(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-2">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Configuración</h1>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="empleados">Empleados</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="recursos">Recursos y Cabinas</TabsTrigger>
          <TabsTrigger value="apariencia">Apariencia</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="meta">Meta</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="prestashop">PrestaShop</TabsTrigger>
          <TabsTrigger value="verifactu">Verifactu</TabsTrigger>
          <TabsTrigger value="verifactu-xml">XML Docs</TabsTrigger>
          <TabsTrigger value="seguridad">Seguridad</TabsTrigger>
          <TabsTrigger value="usuarios-permisos">Usuarios y permisos</TabsTrigger>
          {isMultiEntity && (
            <TabsTrigger value="centro-laboral">Centro laboral</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Tabs defaultValue="general-resumen" className="w-full">
            <TabsList>
              <TabsTrigger value="general-resumen">Resumen</TabsTrigger>
              <TabsTrigger value="general-importar" className="gap-1.5">
                <Database className="h-3.5 w-3.5" />
                Importar
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general-resumen" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Configuración General</CardTitle>
                  <CardDescription>Configuraciones básicas del sistema</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Copia de Seguridad</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Genera y descarga una copia de seguridad de todos los datos de tu empresa en formato SQL.
                    </p>
                    <Button onClick={handleGenerateBackup} disabled={isGeneratingBackup} className="gap-2">
                      <Download className="h-4 w-4" />
                      {isGeneratingBackup ? 'Generando...' : 'Descargar Copia de Seguridad'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="general-importar" className="mt-4">
              <LegacyImportPanel />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="empresa" className="space-y-4">
          <Empresas />
        </TabsContent>

        <TabsContent value="empleados" className="space-y-4">
          <EmployeesConfig />
        </TabsContent>

        <TabsContent value="agenda" className="space-y-4">
          <AgendaCenterHoursConfig />
          <AgendaEmployeeHoursConfig />
          <AgendaPreferencesConfig />
        </TabsContent>

        <TabsContent value="recursos" className="space-y-4">
          <RecursosCabinas />
        </TabsContent>

        <TabsContent value="apariencia" className="space-y-4">
          <AppearanceConfig />
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <EmailConfig />
        </TabsContent>

        <TabsContent value="meta" className="space-y-4">
          <MetaConfig />
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-4">
          <WhatsappConfig />
        </TabsContent>

        <TabsContent value="prestashop" className="space-y-4">
          <PrestashopConfig />
        </TabsContent>

        <TabsContent value="verifactu" className="space-y-4">
          <div className="space-y-6">
            <VerifactuCompanyConfig />
            <VerifactuCertificates />
          </div>
        </TabsContent>

        <TabsContent value="verifactu-xml" className="space-y-4">
          <VerifactuXMLDocuments />
        </TabsContent>

        <TabsContent value="seguridad" className="space-y-4">
          <SecurityAudit />
        </TabsContent>

        <TabsContent value="usuarios-permisos" className="space-y-4">
          <UserManagement />
        </TabsContent>

        {isMultiEntity && (
          <TabsContent value="centro-laboral" className="space-y-4">
            <WorkCenterAuditPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
