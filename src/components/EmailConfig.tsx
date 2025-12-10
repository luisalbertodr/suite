
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, ExternalLink, Info } from 'lucide-react';
import { TestEmailSection } from './TestEmailSection';

export const EmailConfig: React.FC = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <span>Configuración de Email</span>
          </CardTitle>
          <CardDescription>
            Configuración del sistema de envío de emails usando Resend
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Estado de configuración:</p>
                <p>El sistema de email está configurado y listo para usar con Resend.</p>
                <div className="mt-3">
                  <p className="text-sm">
                    <strong>Proveedor:</strong> Resend
                  </p>
                  <p className="text-sm">
                    <strong>Dominio remitente:</strong> onboarding@resend.dev
                  </p>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Información sobre Resend</h3>
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg space-y-3">
              <p className="text-sm text-gray-700">
                <strong>Resend</strong> es el servicio de email transaccional que utiliza esta aplicación 
                para enviar correos electrónicos como facturas, presupuestos y notificaciones.
              </p>
              
              <div className="space-y-2">
                <p className="text-sm text-gray-700">
                  <strong>Características principales:</strong>
                </p>
                <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                  <li>Alta deliverability y velocidad de entrega</li>
                  <li>APIs simples y potentes</li>
                  <li>Soporte para plantillas HTML personalizadas</li>
                  <li>Métricas detalladas de entrega</li>
                  <li>Integración nativa con React Email</li>
                </ul>
              </div>

              <div className="pt-2">
                <a
                  href="https://resend.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm"
                >
                  <span>Más información sobre Resend</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Configuración actual</h3>
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-green-800">Sistema activo</span>
              </div>
              <p className="text-sm text-green-700">
                El sistema de email está configurado correctamente y listo para enviar correos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <TestEmailSection />
    </div>
  );
};
