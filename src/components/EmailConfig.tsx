
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Info } from 'lucide-react';
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
            Envío vía Gmail SMTP (remitente info@lipoout.com)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Estado de configuración:</p>
                <p>
                  Los correos se envían desde <strong>info@lipoout.com</strong> usando la cuenta
                  Gmail configurada en el servidor (SMTP).
                </p>
                <div className="mt-3 text-sm space-y-1">
                  <p>
                    <strong>Proveedor:</strong> Gmail SMTP
                  </p>
                  <p>
                    <strong>Remitente:</strong> info@lipoout.com
                  </p>
                  <p>
                    <strong>Servidor:</strong> smtp.gmail.com:587
                  </p>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm font-medium text-green-800">SMTP activo</span>
            </div>
            <p className="text-sm text-green-700">
              Facturas, presupuestos, alertas del monitor de servidores y emails de prueba usan
              esta configuración.
            </p>
          </div>
        </CardContent>
      </Card>

      <TestEmailSection />
    </div>
  );
};
