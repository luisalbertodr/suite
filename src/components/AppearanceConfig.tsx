
import React, { useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Palette, Check, Upload, X, Image } from 'lucide-react';
import { useUserAppearance } from '@/hooks/useUserAppearance';
import { useWorkCenterBranding } from '@/hooks/useWorkCenterBranding';

const colorOptions = [
  { name: 'blue', label: 'Azul', bgClass: 'bg-blue-600' },
  { name: 'green', label: 'Verde', bgClass: 'bg-green-600' },
  { name: 'purple', label: 'Morado', bgClass: 'bg-purple-600' },
  { name: 'red', label: 'Rojo', bgClass: 'bg-red-600' },
  { name: 'gray', label: 'Gris', bgClass: 'bg-gray-600' },
  { name: 'indigo', label: 'Índigo', bgClass: 'bg-indigo-600' },
  { name: 'teal', label: 'Verde azulado', bgClass: 'bg-teal-600' },
  { name: 'orange', label: 'Naranja', bgClass: 'bg-orange-600' },
];

export const AppearanceConfig: React.FC = () => {
  const { sidebarColor, updateSidebarColor, loading } = useUserAppearance();
  const {
    displayName,
    logoUrl,
    updateLogo,
    removeLogo,
    isLoading: brandingLoading,
    hasWorkCenter,
  } = useWorkCenterBranding();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleColorChange = (color: string) => {
    updateSidebarColor(color);
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file?.type.startsWith('image/')) {
      updateLogo.mutate(file);
    }
    event.target.value = '';
  };

  if (loading || brandingLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center p-8">
          <p>Cargando configuración de apariencia...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Palette className="h-5 w-5" />
          <span>Configuración de Apariencia</span>
        </CardTitle>
        <CardDescription>
          Personaliza el aspecto visual de la aplicación
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-lg font-medium mb-4">Color del Sidebar</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Selecciona el color que prefieras para el sidebar de navegación
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {colorOptions.map((color) => (
              <Button
                key={color.name}
                variant={sidebarColor === color.name ? "default" : "outline"}
                className="h-16 flex flex-col items-center justify-center space-y-2 relative"
                onClick={() => handleColorChange(color.name)}
              >
                <div className={`w-8 h-8 rounded-full ${color.bgClass}`} />
                <span className="text-xs">{color.label}</span>
                {sidebarColor === color.name && (
                  <Check className="absolute top-1 right-1 h-4 w-4" />
                )}
              </Button>
            ))}
          </div>

          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">Color actual</Badge>
              <span className="text-sm text-blue-800 dark:text-blue-200">
                {colorOptions.find(c => c.name === sidebarColor)?.label || 'Azul'}
              </span>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
              Los cambios se aplican inmediatamente y se guardan para tu usuario.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Centro de trabajo</h3>
          <p className="text-sm text-muted-foreground mb-2">
            Nombre y logo que se muestran en la barra superior de la aplicación
            {hasWorkCenter ? ' (centro laboral compartido)' : ''}.
          </p>
          <p className="text-sm font-medium text-foreground mb-4">{displayName}</p>
          <h4 className="text-sm font-medium mb-3">Logo</h4>
          
          <div className="space-y-4">
            {logoUrl ? (
              <div className="flex items-center space-x-4">
                <div className="w-32 h-20 border border-border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                  <img 
                    src={logoUrl} 
                    alt="Logo de la empresa" 
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Cambiar Logo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => removeLogo.mutate()}
                    disabled={removeLogo.isPending}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Eliminar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-sm">
                <div 
                  className="w-32 h-20 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="text-center">
                    <Image className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">Subir Logo</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 w-32"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Seleccionar
                </Button>
              </div>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
            
            <div className="p-3 bg-muted border border-border rounded-lg">
              <p className="text-xs text-muted-foreground">
                El logo se verá a la izquierda de la barra superior junto al nombre del centro,
                y también en los PDFs de presupuestos. Formatos: JPG, PNG, GIF.
                Tamaño recomendado: 200×100 px. Requiere permisos de administrador para guardar.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
