
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, ShoppingCart, Palette, Mail, Shield, FileText, Download } from 'lucide-react';
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

export const Configuracion: React.FC = () => {
  const { toast } = useToast();
  const [isGeneratingBackup, setIsGeneratingBackup] = useState(false);

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

      // Create blob and download
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

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="apariencia">Apariencia</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="prestashop">PrestaShop</TabsTrigger>
          <TabsTrigger value="verifactu">Verifactu</TabsTrigger>
          <TabsTrigger value="verifactu-xml">XML Docs</TabsTrigger>
          <TabsTrigger value="seguridad">Seguridad</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          
          <Card>
            <CardHeader>
              <CardTitle>Configuración General</CardTitle>
              <CardDescription>
                Configuraciones básicas del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2">Copia de Seguridad</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Genera y descarga una copia de seguridad de todos los datos de tu empresa en formato SQL.
                </p>
                <Button
                  onClick={handleGenerateBackup}
                  disabled={isGeneratingBackup}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  {isGeneratingBackup ? 'Generando...' : 'Descargar Copia de Seguridad'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="apariencia" className="space-y-4">
          <AppearanceConfig />
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <EmailConfig />
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
      </Tabs>
    </div>
  );
};
