
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Database } from 'lucide-react';
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
import { WhatsappAutomationConfig } from './WhatsappAutomationConfig';
import { WorkCenterAuditPanel } from './WorkCenterAuditPanel';
import { WorkCenterCompaniesConfig } from './WorkCenterCompaniesConfig';
import { LegacyImportPanel } from './LegacyImportPanel';
import { InbodyCsvImportPanel } from './InbodyCsvImportPanel';
import { TpvSettingsConfig } from './TpvSettingsConfig';
import { StripeConfigPanel } from './StripeConfig';
import { ServidoresMonitorPanel } from './ServidoresMonitorPanel';
import { SmartPssEventsPanel } from './SmartPssEventsPanel';
import { ConsentimientoPlantillasConfig } from './consentimiento/ConsentimientoPlantillasConfig';
import { TabletUnlockConfig } from '@/components/tablet/TabletUnlockConfig';
import { useWorkCenter } from '@/hooks/useWorkCenter';

const VALID_TABS = [
  'general',
  'empresa',
  'agenda',
  'recursos',
  'marketing',
  'pagos',
  'prestashop',
  'verifactu',
  'verifactu-xml',
  'seguridad',
  'usuarios',
  'servidores',
  'camaras',
] as const;

type ConfigTab = (typeof VALID_TABS)[number];

/** Pestañas antiguas → pestaña principal + subpestaña */
const TAB_ALIASES: Record<string, { tab: ConfigTab; subtab: string }> = {
  meta: { tab: 'marketing', subtab: 'meta' },
  apariencia: { tab: 'general', subtab: 'apariencia' },
  email: { tab: 'marketing', subtab: 'email' },
  whatsapp: { tab: 'marketing', subtab: 'whatsapp-conexion' },
  stripe: { tab: 'pagos', subtab: 'stripe' },
  tpv: { tab: 'pagos', subtab: 'tpv' },
  empleados: { tab: 'usuarios', subtab: 'empleados' },
  'usuarios-permisos': { tab: 'usuarios', subtab: 'permisos' },
  'centro-laboral': { tab: 'seguridad', subtab: 'centro-laboral' },
};

const DEFAULT_SUBTABS: Partial<Record<ConfigTab, string>> = {
  general: 'resumen',
  marketing: 'meta',
  pagos: 'stripe',
  usuarios: 'permisos',
  seguridad: 'auditoria',
};

function resolveTab(tabParam: string): ConfigTab {
  const alias = TAB_ALIASES[tabParam];
  if (alias) return alias.tab;
  if ((VALID_TABS as readonly string[]).includes(tabParam)) {
    return tabParam as ConfigTab;
  }
  return 'general';
}

function resolveSubtab(tab: ConfigTab, tabParam: string, subtabParam: string): string {
  const alias = TAB_ALIASES[tabParam];
  if (alias && alias.tab === tab) return alias.subtab;
  if (subtabParam) return subtabParam;
  return DEFAULT_SUBTABS[tab] ?? '';
}

export const Configuracion: React.FC = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isGeneratingBackup, setIsGeneratingBackup] = useState(false);
  const { isMultiEntity } = useWorkCenter();

  const tabParam = searchParams.get('tab') ?? '';
  const subtabParam = searchParams.get('subtab') ?? '';
  const activeTab = resolveTab(tabParam);
  const activeSubtab = resolveSubtab(activeTab, tabParam, subtabParam);

  const setConfigNav = (tab: string, subtab?: string) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'general' && !subtab) {
      next.delete('tab');
      next.delete('subtab');
    } else {
      next.set('tab', tab);
      if (subtab) next.set('subtab', subtab);
      else next.delete('subtab');
    }
    setSearchParams(next, { replace: true });
  };

  const handleTabChange = (value: string) => {
    const tab = value as ConfigTab;
    const defaultSub = DEFAULT_SUBTABS[tab];
    setConfigNav(tab, defaultSub || undefined);
  };

  const handleSubTabChange = (subtab: string) => {
    setConfigNav(activeTab, subtab);
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
    <div className="container mx-auto p-6 pt-0 space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="recursos">Recursos y Cabinas</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
          <TabsTrigger value="prestashop">PrestaShop</TabsTrigger>
          <TabsTrigger value="verifactu">Verifactu</TabsTrigger>
          <TabsTrigger value="verifactu-xml">XML Docs</TabsTrigger>
          <TabsTrigger value="seguridad">Seguridad</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="servidores">Servidores</TabsTrigger>
          <TabsTrigger value="camaras">Cámaras</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Tabs
            value={activeSubtab || 'resumen'}
            onValueChange={handleSubTabChange}
            className="w-full"
          >
            <TabsList>
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="importar" className="gap-1.5">
                <Database className="h-3.5 w-3.5" />
                Importar
              </TabsTrigger>
              <TabsTrigger value="apariencia">Apariencia</TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="space-y-4 mt-4">
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

            <TabsContent value="importar" className="mt-4 space-y-6">
              <InbodyCsvImportPanel />
              <LegacyImportPanel />
            </TabsContent>

            <TabsContent value="apariencia" className="mt-4 space-y-4">
              <AppearanceConfig />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="empresa" className="space-y-4">
          <WorkCenterCompaniesConfig />
          <Empresas />
          <TabletUnlockConfig />
          <ConsentimientoPlantillasConfig />
        </TabsContent>

        <TabsContent value="agenda" className="space-y-4">
          <AgendaCenterHoursConfig />
          <AgendaEmployeeHoursConfig />
          <AgendaPreferencesConfig />
        </TabsContent>

        <TabsContent value="recursos" className="space-y-4">
          <RecursosCabinas />
        </TabsContent>

        <TabsContent value="marketing" className="space-y-4">
          <Tabs
            value={activeSubtab || 'meta'}
            onValueChange={handleSubTabChange}
            className="w-full"
          >
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="meta">Meta / Leads</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="whatsapp-conexion">WhatsApp conexión</TabsTrigger>
              <TabsTrigger value="whatsapp-automatizacion">WhatsApp (citas y alertas)</TabsTrigger>
            </TabsList>
            <TabsContent value="meta" className="mt-4 space-y-4">
              <MetaConfig />
            </TabsContent>
            <TabsContent value="email" className="mt-4 space-y-4">
              <EmailConfig />
            </TabsContent>
            <TabsContent value="whatsapp-conexion" className="mt-4 space-y-4">
              <WhatsappConfig />
            </TabsContent>
            <TabsContent value="whatsapp-automatizacion" className="mt-4 space-y-4">
              <WhatsappAutomationConfig />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="pagos" className="space-y-4">
          <Tabs
            value={activeSubtab || 'stripe'}
            onValueChange={handleSubTabChange}
            className="w-full"
          >
            <TabsList>
              <TabsTrigger value="stripe">Stripe</TabsTrigger>
              <TabsTrigger value="tpv">TPV</TabsTrigger>
            </TabsList>
            <TabsContent value="stripe" className="mt-4 space-y-4">
              <StripeConfigPanel />
            </TabsContent>
            <TabsContent value="tpv" className="mt-4 space-y-4">
              <TpvSettingsConfig />
            </TabsContent>
          </Tabs>
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
          <Tabs
            value={
              activeSubtab === 'centro-laboral' && !isMultiEntity
                ? 'auditoria'
                : activeSubtab || 'auditoria'
            }
            onValueChange={handleSubTabChange}
            className="w-full"
          >
            <TabsList>
              <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
              {isMultiEntity && (
                <TabsTrigger value="centro-laboral">Centro laboral</TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="auditoria" className="mt-4 space-y-4">
              <SecurityAudit />
            </TabsContent>
            {isMultiEntity && (
              <TabsContent value="centro-laboral" className="mt-4 space-y-4">
                <WorkCenterAuditPanel />
              </TabsContent>
            )}
          </Tabs>
        </TabsContent>

        <TabsContent value="usuarios" className="space-y-4">
          <Tabs
            value={activeSubtab || 'permisos'}
            onValueChange={handleSubTabChange}
            className="w-full"
          >
            <TabsList>
              <TabsTrigger value="permisos">Usuarios y permisos</TabsTrigger>
              <TabsTrigger value="empleados">Empleados</TabsTrigger>
            </TabsList>
            <TabsContent value="permisos" className="mt-4 space-y-4">
              <UserManagement />
            </TabsContent>
            <TabsContent value="empleados" className="mt-4 space-y-4">
              <EmployeesConfig />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="servidores" className="space-y-4">
          <ServidoresMonitorPanel />
        </TabsContent>

        <TabsContent value="camaras" className="space-y-4">
          <SmartPssEventsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};
