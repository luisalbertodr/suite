
import React, { useState } from 'react';
import { createAdminUser } from '@/utils/createAdminUser';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export const AdminSetup: React.FC = () => {
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleCreateAdmin = async () => {
    setIsCreating(true);
    
    const result = await createAdminUser();
    
    if (result.success) {
      toast({
        title: "Usuario Admin Creado",
        description: "El usuario admin@moges.com ha sido creado exitosamente con la contraseña admin123",
      });
    } else {
      toast({
        title: "Error al crear usuario",
        description: result.error,
        variant: "destructive",
      });
    }
    
    setIsCreating(false);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Configuración de Administrador</CardTitle>
        <CardDescription>
          Crear usuario administrador para acceder al sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <p><strong>Email:</strong> admin@moges.com</p>
            <p><strong>Contraseña:</strong> admin123</p>
          </div>
          <Button 
            onClick={handleCreateAdmin} 
            disabled={isCreating}
            className="w-full"
          >
            {isCreating ? 'Creando usuario...' : 'Crear Usuario Admin'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
