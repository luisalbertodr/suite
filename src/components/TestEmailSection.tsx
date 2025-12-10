
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Send, TestTube } from 'lucide-react';
import { useTestEmail } from '@/hooks/useTestEmail';

export const TestEmailSection: React.FC = () => {
  const [testEmail, setTestEmail] = useState('');
  const { sendTestEmail, isLoading } = useTestEmail();

  const handleSendTest = async () => {
    if (!testEmail.trim()) return;
    
    try {
      await sendTestEmail.mutateAsync({
        destinationEmail: testEmail.trim()
      });
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TestTube className="w-5 h-5 text-blue-600" />
          <span>Prueba de Envío de Email</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <p className="text-blue-800 text-sm">
            <strong>Función de prueba:</strong> Esta herramienta envía un email de prueba básico 
            sin adjuntos para verificar que la configuración de email funciona correctamente.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="test-email" className="text-base font-medium">
              Email de Destino para Prueba
            </Label>
            <p className="text-sm text-gray-600 mb-2">
              Introduce una dirección de email válida donde recibir el email de prueba
            </p>
            <div className="flex space-x-2">
              <div className="flex-1">
                <Input
                  id="test-email"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="ejemplo@email.com"
                  className="w-full"
                />
              </div>
              <Button
                onClick={handleSendTest}
                disabled={isLoading || !testEmail.trim() || !isValidEmail(testEmail.trim())}
                className="flex items-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <Mail className="w-4 h-4 animate-pulse" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Enviar Test</span>
                  </>
                )}
              </Button>
            </div>
            {testEmail.trim() && !isValidEmail(testEmail.trim()) && (
              <p className="text-sm text-red-600 mt-1">
                Por favor, introduce un email válido
              </p>
            )}
          </div>

          <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">¿Qué hace esta prueba?</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Verifica que la configuración de Resend API está correcta</li>
              <li>• Comprueba que el email remitente está configurado</li>
              <li>• Envía un email simple sin adjuntos</li>
              <li>• Confirma que el sistema de autenticación funciona</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
