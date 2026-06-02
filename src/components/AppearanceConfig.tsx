
import React, { useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Palette, Check, Upload, X, Image, Moon, Sun, Volume2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  getNotificationSoundPrefs,
  setNotificationSoundPrefs,
  playNotificationSound,
} from '@/lib/notificationSounds';
import { useUserAppearance } from '@/hooks/useUserAppearance';
import { useWorkCenterBranding } from '@/hooks/useWorkCenterBranding';
import { useTheme } from 'next-themes';

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
  const { theme, setTheme } = useTheme();
  const { sidebarColor, updateSidebarColor, loading } = useUserAppearance();
  const {
    displayName,
    logoUrlLight,
    logoUrlDark,
    updateLogo,
    removeLogo,
    isLoading: brandingLoading,
    hasWorkCenter,
  } = useWorkCenterBranding();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const darkFileInputRef = useRef<HTMLInputElement>(null);

  const handleColorChange = (color: string) => {
    updateSidebarColor(color);
  };
  const isDark = theme === 'dark';
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>, variant: 'light' | 'dark') => {
    const file = event.target.files?.[0];
    if (file?.type.startsWith('image/')) {
      updateLogo.mutate({ file, variant });
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
          <h3 className="text-lg font-medium mb-4">Sonidos de notificación</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Avisos sonoros para WhatsApp, marketing y la campanita. Puedes activarlos/desactivarlos, ajustar volumen y probar cada sonido.
          </p>
          <SoundPrefsEditor />
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2">Modo nocturno</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Cambia entre tema claro y oscuro para toda la aplicación.
          </p>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={toggleTheme}
            aria-label="Cambiar modo nocturno"
          >
            {isDark ? (
              <>
                <Sun className="h-4 w-4 text-amber-500" />
                Pasar a modo claro
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 text-indigo-500" />
                Pasar a modo nocturno
              </>
            )}
          </Button>
        </div>

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
          <h4 className="text-sm font-medium mb-3">Logo app (modo día / noche)</h4>
          
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Modo día</h5>
                {logoUrlLight ? (
                  <div className="flex items-center space-x-3">
                    <div className="w-32 h-20 border border-border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                      <img
                        src={logoUrlLight}
                        alt="Logo modo día"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Cambiar
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => removeLogo.mutate('light')}
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
                        <p className="text-xs text-muted-foreground">Subir</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Modo noche</h5>
                {logoUrlDark ? (
                  <div className="flex items-center space-x-3">
                    <div className="w-32 h-20 border border-border rounded-lg overflow-hidden bg-zinc-900 flex items-center justify-center">
                      <img
                        src={logoUrlDark}
                        alt="Logo modo noche"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        onClick={() => darkFileInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Cambiar
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => removeLogo.mutate('dark')}
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
                      className="w-32 h-20 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:border-muted-foreground/50 transition-colors bg-zinc-900"
                      onClick={() => darkFileInputRef.current?.click()}
                    >
                      <div className="text-center">
                        <Image className="w-6 h-6 mx-auto text-zinc-300 mb-1" />
                        <p className="text-xs text-zinc-300">Subir</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              aria-label="Subir logo"
              accept="image/*"
              onChange={(e) => handleLogoUpload(e, 'light')}
              className="hidden"
            />
            <input
              ref={darkFileInputRef}
              type="file"
              aria-label="Subir logo nocturno"
              accept="image/*"
              onChange={(e) => handleLogoUpload(e, 'dark')}
              className="hidden"
            />
            
            <div className="p-3 bg-muted border border-border rounded-lg">
              <p className="text-xs text-muted-foreground">
                El logo de día y de noche se muestran en la barra superior según el tema activo.
                En los PDFs se usa el logo de día. Formatos: JPG, PNG, GIF.
                Tamaño recomendado: 200×100 px. Requiere permisos de administrador para guardar.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

function SoundPrefsEditor() {
  const [prefs, setPrefs] = useState(() => getNotificationSoundPrefs());
  const applyPrefs = (patch: Parameters<typeof setNotificationSoundPrefs>[0]) => {
    setNotificationSoundPrefs(patch);
    setPrefs(getNotificationSoundPrefs());
  };

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="sound-enabled" className="text-sm font-medium">
          Sonidos activos
        </Label>
        <div className="flex items-center gap-2">
          <Switch
            id="sound-enabled"
            checked={prefs.enabled}
            onCheckedChange={(checked) => applyPrefs({ enabled: checked })}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <Slider
          value={[Math.round(prefs.volume * 100)]}
          max={100}
          step={5}
          className="flex-1"
          onValueChange={([v]) => applyPrefs({ volume: (v ?? 55) / 100 })}
        />
        <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
          {Math.round(prefs.volume * 100)}%
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => playNotificationSound('whatsapp')}>
          Probar WhatsApp
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => playNotificationSound('marketing')}>
          Probar Marketing
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => playNotificationSound('bell')}>
          Probar Campanita
        </Button>
      </div>
    </div>
  );
}
